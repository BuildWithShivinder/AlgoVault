// AlgoVault Background Service Worker

importScripts('ai_engine.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AlgoVault] Service worker active.');
});

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return atob(str);
  }
}

function formatLocalTimestamp(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return formatLocalTimestamp(Date.now());

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function isCFamilyLanguage(language) {
  return /^(javascript|typescript|c\+\+|c|java|c#|go|rust|swift|kotlin|scala|php)$/i.test(String(language || '').trim().toLowerCase());
}

function hasBalancedDelimiters(code) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let braces = 0;
  let parens = 0;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inSingleQuote) {
      if (char === '\\') { i++; } else if (char === "'") { inSingleQuote = false; }
      continue;
    }
    if (inDoubleQuote) {
      if (char === '\\') { i++; } else if (char === '"') { inDoubleQuote = false; }
      continue;
    }
    if (inTemplate) {
      if (char === '\\') { i++; } else if (char === '`') { inTemplate = false; }
      continue;
    }

    if (char === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }

    switch (char) {
      case "'": inSingleQuote = true; break;
      case '"': inDoubleQuote = true; break;
      case '`': inTemplate = true; break;
      case '{': braces++; break;
      case '}': braces--; break;
      case '(': parens++; break;
      case ')': parens--; break;
    }

    if (braces < 0 || parens < 0) return false;
  }

  return braces === 0 && parens === 0;
}

function getIncompleteCodeReason(code, language) {
  if (!code || !code.trim()) return 'code capture was empty';
  const trimmed = code.trim();
  if (trimmed === '// Solution Code') return 'code capture was a placeholder stub';
  if (trimmed.length < 30) return 'code capture was too short';

  if (isCFamilyLanguage(language) && !hasBalancedDelimiters(trimmed)) {
    return 'code capture had unbalanced delimiters';
  }

  return null;
}

function normalizePlatform(p) {
  if (!p) return 'LeetCode';
  const s = String(p).toLowerCase().trim();
  if (s.includes('gfg') || s.includes('geeks')) return 'GeeksforGeeks';
  if (s.includes('hacker')) return 'HackerRank';
  if (s.includes('codeforce') || s.includes('forces')) return 'Codeforces';
  return 'LeetCode';
}

function getFileExtension(language) {
  const langMap = {
    'c++': 'cpp', 'cpp': 'cpp', 'gnu c++17': 'cpp', 'c++17': 'cpp', 'c++20': 'cpp',
    'java': 'java', 'java 8': 'java', 'java 11': 'java', 'java 17': 'java',
    'python': 'py', 'python3': 'py', 'pypy3': 'py',
    'c#': 'cs', 'csharp': 'cs',
    'javascript': 'js', 'typescript': 'ts',
    'c': 'c', 'go': 'go', 'ruby': 'rb', 'swift': 'swift',
    'rust': 'rs', 'kotlin': 'kt', 'scala': 'scala', 'php': 'php', 'sql': 'sql'
  };
  const key = (language || '').toLowerCase().trim();
  return langMap[key] || 'cpp';
}

function getFolderName(data) {
  const platform = data.platform ? String(data.platform).toLowerCase() : '';
  const slug = (data.slug || 'problem').toLowerCase().replace(/[^a-z0-9-]+/g, '-');

  if (platform.includes('codeforce') || platform.includes('gfg') || platform.includes('hackerrank')) {
    return slug;
  }

  const numStr = data.number && !isNaN(parseInt(data.number, 10)) ? String(data.number).padStart(4, '0') : '';
  return numStr ? `${numStr}-${slug}` : slug;
}

function renderProgressBar(percentage) {
  const totalBars = 16;
  const filledBars = Math.round((percentage / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  return '█'.repeat(Math.max(0, filledBars)) + '░'.repeat(Math.max(0, emptyBars));
}

async function uploadFileToGitHub(token, owner, repo, branch, path, commitMessage, content) {
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  let existingSha = null;

  try {
    const getRes = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      existingSha = getJson.sha;
    }
  } catch (e) {
    console.warn('[AlgoVault] File fetch warning:', e);
  }

  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const bodyData = {
    message: commitMessage,
    content: utf8ToBase64(content),
    branch: branch
  };

  if (existingSha) {
    bodyData.sha = existingSha;
  }

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyData)
  });

  if (!putRes.ok) {
    const errJson = await putRes.json();
    throw new Error(errJson.message || `GitHub API returned ${putRes.status}`);
  }

  return await putRes.json();
}

async function updateCsvMasterLog(token, owner, repo, branch, sub) {
  const path = 'submissions.csv';
  const header = 'Platform,Problem ID,Title,Difficulty,Language,URL,Timestamp';

  let existingContent = '';
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  try {
    const getRes = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      if (getJson.content) {
        const cleanContent = getJson.content.replace(/\s/g, '');
        existingContent = base64ToUtf8(cleanContent);
      }
    }
  } catch (e) {
    console.log('[AlgoVault] Creating submissions.csv...');
  }

  const rowsMap = new Map();

  if (existingContent && existingContent.trim()) {
    const lines = existingContent.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const p = parseCsvLine(line);

      let platform = 'LeetCode', probId = '--', title = '', diff = 'Medium', lang = 'C++', url = '', ts = formatLocalTimestamp(Date.now());

      if (p.length >= 9) {
        platform = normalizePlatform(p[0]);
        probId = p[1].replace(/"/g, '').trim();
        title = p[2].replace(/"/g, '').trim();
        diff = p[3].replace(/"/g, '').trim();
        lang = p[4].replace(/"/g, '').trim();
        url = p[7].replace(/"/g, '').trim();
        ts = p[8] ? p[8].replace(/"/g, '').trim() : formatLocalTimestamp(Date.now());
      } else if (p.length >= 7) {
        platform = normalizePlatform(p[0]);
        probId = p[1].replace(/"/g, '').trim();
        title = p[2].replace(/"/g, '').trim();
        diff = p[3].replace(/"/g, '').trim();
        lang = p[4].replace(/"/g, '').trim();
        url = p[5].replace(/"/g, '').trim();
        ts = p[6] ? p[6].replace(/"/g, '').trim() : formatLocalTimestamp(Date.now());
      } else if (p.length >= 5) {
        platform = 'LeetCode';
        probId = p[0].replace(/"/g, '').trim();
        title = p[1].replace(/"/g, '').trim();
        diff = p[2].replace(/"/g, '').trim();
        lang = p[3].replace(/"/g, '').trim();
        url = p[4].replace(/"/g, '').trim();
        ts = p[5] ? p[5].replace(/"/g, '').trim() : formatLocalTimestamp(Date.now());
      }

      if (title) {
        const uniqueKey = `${platform}_${probId !== '--' && probId !== '0' ? probId : title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
        rowsMap.set(uniqueKey, { platform, probId, title, diff, lang, url, ts });
      }
    }
  }

  const normPlatform = normalizePlatform(sub.platform);
  const currentProbId = sub.number ? String(sub.number) : (sub.slug || '--');
  const currentKey = `${normPlatform}_${currentProbId !== '--' ? currentProbId : sub.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

  rowsMap.set(currentKey, {
    platform: normPlatform,
    probId: currentProbId,
    title: sub.title || 'Problem',
    diff: sub.difficulty || 'Medium',
    lang: sub.language || 'C++',
    url: sub.url || '',
    ts: formatLocalTimestamp(sub.timestamp || Date.now())
  });

  const sortedRows = Array.from(rowsMap.values());

  let updatedCsv = header + '\n';
  for (const r of sortedRows) {
    const titleEsc = `"${r.title.replace(/"/g, '""')}"`;
    updatedCsv += `${r.platform},${r.probId},${titleEsc},${r.diff},${r.lang},${r.url},${r.ts}\n`;
  }

  const commitMsg = `Update [${normPlatform}] ${sub.title}`;
  await uploadFileToGitHub(token, owner, repo, branch, path, commitMsg, updatedCsv);
  return updatedCsv;
}

async function updateRootDashboard(token, owner, repo, branch, csvContent) {
  const path = 'README.md';
  const lines = (csvContent || '').trim().split('\n');
  const items = [];

  const platformCounts = { LeetCode: 0, GeeksforGeeks: 0, HackerRank: 0, Codeforces: 0 };
  let easyCount = 0, mediumCount = 0, hardCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const p = parseCsvLine(line);
    if (p.length >= 5) {
      let platform = 'LeetCode', probId = '--', title = '', diff = 'Medium', lang = 'C++', url = '';
      if (p.length >= 7) {
        platform = normalizePlatform(p[0]);
        probId = p[1].replace(/"/g, '').trim();
        title = p[2].replace(/"/g, '').trim();
        diff = p[3].replace(/"/g, '').trim();
        lang = p[4].replace(/"/g, '').trim();
        url = p[5].replace(/"/g, '').trim();
      } else {
        platform = 'LeetCode';
        probId = p[0].replace(/"/g, '').trim();
        title = p[1].replace(/"/g, '').trim();
        diff = p[2].replace(/"/g, '').trim();
        lang = p[3].replace(/"/g, '').trim();
        url = p[4].replace(/"/g, '').trim();
      }

      if (platformCounts[platform] !== undefined) platformCounts[platform]++;
      else platformCounts[platform] = 1;

      const dLower = diff.toLowerCase();
      if (dLower === 'easy') easyCount++;
      else if (dLower === 'medium') mediumCount++;
      else if (dLower === 'hard') hardCount++;
      else mediumCount++;

      const slug = url.match(/\/problems\/([a-z0-9-]+)/i) ? url.match(/\/problems\/([a-z0-9-]+)/i)[1] : title.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const folderName = probId && !isNaN(parseInt(probId, 10)) ? `${String(probId).padStart(4, '0')}-${slug}` : slug;

      items.push({ platform, probId, title, diff, lang, url, folderName });
    }
  }

  const total = items.length || 1;

  const tableRows = items.map(item => {
    return `| **${item.platform}** | ${item.probId} | [${item.title}](${item.url}) | ${item.diff} | \`${item.lang}\` | [\`${item.folderName}\`](./${item.platform}/${item.folderName}/) |`;
  }).join('\n');

  const dashboardMarkdown = `# ⚡ DSA Problem Vault

<p align="center">
  <img src="https://img.shields.io/badge/Total%20Solved-${total}-10b981?style=for-the-badge&logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/LeetCode-${platformCounts.LeetCode}-ffa116?style=for-the-badge&logo=leetcode&logoColor=white" />
  <img src="https://img.shields.io/badge/GeeksforGeeks-${platformCounts.GeeksforGeeks}-2e7d32?style=for-the-badge&logo=geeksforgeeks&logoColor=white" />
  <img src="https://img.shields.io/badge/HackerRank-${platformCounts.HackerRank}-00ea64?style=for-the-badge&logo=hackerrank&logoColor=white" />
  <img src="https://img.shields.io/badge/Codeforces-${platformCounts.Codeforces}-3182ce?style=for-the-badge&logo=codeforces&logoColor=white" />
  <img src="https://img.shields.io/badge/Synced%20With-AlgoVault%20AI-38bdf8?style=for-the-badge" />
</p>

> A personal competitive programming archive containing accepted solutions across **LeetCode**, **GeeksforGeeks**, **HackerRank**, and **Codeforces** — automatically captured, formatted, analyzed, and committed via **[AlgoVault](https://github.com/${owner}/AlgoVault)**.

---

## 📊 Problem Solving Statistics

<div align="center">

| Platform | Solved | Ratio | Visual Distribution |
| :--- | :---: | :---: | :--- |
| 🟧 **LeetCode** | **${platformCounts.LeetCode}** | ${((platformCounts.LeetCode/total)*100).toFixed(1)}% | \`${renderProgressBar((platformCounts.LeetCode/total)*100)}\` |
| 🟩 **GeeksforGeeks** | **${platformCounts.GeeksforGeeks}** | ${((platformCounts.GeeksforGeeks/total)*100).toFixed(1)}% | \`${renderProgressBar((platformCounts.GeeksforGeeks/total)*100)}\` |
| 🟢 **HackerRank** | **${platformCounts.HackerRank}** | ${((platformCounts.HackerRank/total)*100).toFixed(1)}% | \`${renderProgressBar((platformCounts.HackerRank/total)*100)}\` |
| 🟦 **Codeforces** | **${platformCounts.Codeforces}** | ${((platformCounts.Codeforces/total)*100).toFixed(1)}% | \`${renderProgressBar((platformCounts.Codeforces/total)*100)}\` |
| 🏆 **Total Unique** | **${total}** | 100% | \`████████████████████\` |

</div>

---

## 📁 Solved Problems Index

| Platform | ID | Problem Title | Difficulty | Language | Solution Folder |
| :---: | :---: | :--- | :---: | :---: | :---: |
${tableRows}

---

## 📄 Master Submission Log
All distinct submission records are updated in real-time in the central sheet: [\`submissions.csv\`](./submissions.csv).

---
*Automated with ❤️ by [AlgoVault](https://github.com/${owner}/AlgoVault)*
`;

  const commitMsg = `Update README.md (${total} unique problems solved)`;
  return await uploadFileToGitHub(token, owner, repo, branch, path, commitMsg, dashboardMarkdown);
}

async function syncSolutionToGitHub(subData) {
  const config = await new Promise(resolve => {
    chrome.storage.local.get(['ghToken', 'ghOwner', 'ghRepo', 'ghBranch', 'geminiKey'], resolve);
  });

  const { ghToken, ghOwner, ghRepo, ghBranch = 'main', geminiKey = '' } = config;

  if (!ghToken || !ghOwner || !ghRepo) {
    throw new Error('GitHub credentials missing. Set Token, Username, and Repo in extension popup.');
  }

  const platform = normalizePlatform(subData.platform);
  subData.platform = platform;

  const folderName = getFolderName(subData);
  const ext = getFileExtension(subData.language);

  const solutionPath = `${platform}/${folderName}/solution.${ext}`;
  const readmePath = `${platform}/${folderName}/README.md`;

  const solutionCode = subData.code || '// Solution Code';

  console.log('[AlgoVault AI] Running AI analysis & recommendation engine...');
  const aiAnalysis = await analyzeCodeWithGemini(solutionCode, ext, subData.title, geminiKey);
  const rec = aiAnalysis.recommendedNext || {};

  const readmeContent = `# ${subData.number ? subData.number + '. ' : ''}${subData.title}\n\n` +
    `* **Platform**: ${platform}\n` +
    `* **Difficulty**: ${subData.difficulty || 'Medium'}\n` +
    `* **Language**: ${subData.language || 'C++'}\n` +
    `* **Problem Link**: [${subData.title}](${subData.url})\n\n` +
    `## 🧠 AI Complexity Analysis\n\n` +
    `* ⏱️ **Time Complexity**: \`${aiAnalysis.timeComplexity}\`\n` +
    `* 💾 **Space Complexity**: \`${aiAnalysis.spaceComplexity}\`\n` +
    `* 🧩 **Pattern**: \`${aiAnalysis.pattern}\`\n` +
    `* 💡 **Intuition**: ${aiAnalysis.intuition}\n` +
    `* 🎯 **Edge Cases**: ${aiAnalysis.edgeCases}\n` +
    `* 🤖 *Engine: ${aiAnalysis.source}*\n\n` +
    `## 🚀 What You Should Try Next\n\n` +
    `* 🎯 **Recommended Practice**: [${rec.title || 'Next Problem'}](${rec.url || '#'}) (${rec.difficulty || 'Medium'})\n` +
    `* 💡 **Why Try Next**: ${rec.reason || 'Builds on this pattern.'}\n\n` +
    `## Solution Code\n\`\`\`${ext}\n${solutionCode}\n\`\`\`\n`;

  const commitMsg = `Sync ${platform}: ${subData.title} (AI: ${aiAnalysis.timeComplexity})`;

  await uploadFileToGitHub(ghToken, ghOwner, ghRepo, ghBranch, solutionPath, commitMsg, solutionCode);
  await uploadFileToGitHub(ghToken, ghOwner, ghRepo, ghBranch, readmePath, `Update README ${subData.title}`, readmeContent);

  const csvContent = await updateCsvMasterLog(ghToken, ghOwner, ghRepo, ghBranch, subData);
  await updateRootDashboard(ghToken, ghOwner, ghRepo, ghBranch, csvContent);

  chrome.storage.local.set({ lastAiAnalysis: { ...aiAnalysis, problemTitle: subData.title, platform: platform } });

  return {
    success: true,
    platform: platform,
    folder: folderName,
    repo: `${ghOwner}/${ghRepo}`,
    aiAnalysis: aiAnalysis,
    timestamp: formatLocalTimestamp(Date.now())
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'PONG', timestamp: Date.now() });
  } else if (request.type === 'PROBLEM_DETECTED') {
    if (request.data && request.data.platform) {
      request.data.platform = normalizePlatform(request.data.platform);
    }
    chrome.storage.local.set({ currentDetectedProblem: request.data });
    sendResponse({ status: 'STORED' });
  } else if (request.type === 'SUBMISSION_ACCEPTED') {
    console.log('[AlgoVault] Processing accepted submission:', request.data);

    if (request.data && request.data.platform) {
      request.data.platform = normalizePlatform(request.data.platform);
    }

    const incompleteReason = getIncompleteCodeReason(request.data && request.data.code, request.data && request.data.language);
    if (incompleteReason) {
      console.warn('[AlgoVault] Blocked incomplete code capture:', incompleteReason);
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

      const skippedError = `Incomplete code capture (${incompleteReason}). Open the AlgoVault popup and press Sync to retry.`;
      chrome.storage.local.get(['syncHistory'], (data) => {
        let history = data.syncHistory || [];
        const normPlatform = normalizePlatform(request.data.platform);
        const uniqueKey = `${normPlatform}_${(request.data.title || '').toLowerCase()}`;
        history = history.filter(item => `${normalizePlatform(item.platform)}_${(item.title || '').toLowerCase()}` !== uniqueKey);
        history.unshift({ ...request.data, platform: normPlatform, status: 'Failed', error: skippedError });
        chrome.storage.local.set({ syncHistory: history.slice(0, 50), lastSyncResult: { success: false, error: skippedError } });
      });

      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
      sendResponse({ status: 'ERROR', result: { success: false, error: skippedError } });
      return true;
    }

    chrome.action.setBadgeText({ text: 'SYNC' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });

    syncSolutionToGitHub(request.data).then(res => {
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

      chrome.storage.local.get(['syncHistory', 'solvedMap'], (data) => {
        let history = data.syncHistory || [];
        const solvedMap = data.solvedMap || {};
        const normPlatform = normalizePlatform(request.data.platform);
        const uniqueKey = `${normPlatform}_${request.data.title.toLowerCase()}`;

        solvedMap[uniqueKey] = {
          platform: normPlatform,
          title: request.data.title,
          difficulty: request.data.difficulty || 'Medium',
          language: request.data.language || 'C++',
          timestamp: Date.now()
        };

        history = history.filter(item => `${normalizePlatform(item.platform)}_${item.title.toLowerCase()}` !== uniqueKey);
        history.unshift({ ...request.data, platform: normPlatform, status: 'Success', result: res });

        chrome.storage.local.set({ 
          syncHistory: history.slice(0, 50), 
          solvedMap: solvedMap,
          lastSyncResult: res,
          currentDetectedProblem: { ...request.data, platform: normPlatform, synced: true }
        });
      });

      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
      sendResponse({ status: 'SUCCESS', result: res });
    }).catch(err => {
      console.error('[AlgoVault] Sync error:', err);
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

      chrome.storage.local.get(['syncHistory'], (data) => {
        let history = data.syncHistory || [];
        const normPlatform = normalizePlatform(request.data.platform);
        const uniqueKey = `${normPlatform}_${request.data.title.toLowerCase()}`;
        history = history.filter(item => `${normalizePlatform(item.platform)}_${item.title.toLowerCase()}` !== uniqueKey);
        history.unshift({ ...request.data, platform: normPlatform, status: 'Failed', error: err.message });
        chrome.storage.local.set({ syncHistory: history.slice(0, 50), lastSyncResult: { success: false, error: err.message } });
      });

      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
      sendResponse({ status: 'ERROR', result: { success: false, error: err.message } });
    });

    return true;
  }
});
