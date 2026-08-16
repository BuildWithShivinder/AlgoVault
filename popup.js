/**
 * AlgoVault Extension Popup Logic
 */
// GitHub API Error Handling
function getFriendlyGitHubError(status, message) {
  if (status === 401) {
    return "GitHub authentication failed. Please check your Personal Access Token.";
  } else if (status === 403) {
    return "GitHub denied the request. Please check your token permissions or rate limit.";
  } else if (status === 404) {
    return "GitHub repository not found. Please check the username and repository name.";
  } else {
    return `GitHub request failed${message ? `: ${message}` : "."}`;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // Tab Bar Switching
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Password Visibility Toggle
  const tokenInput = document.getElementById('ghToken');
  const toggleTokenBtn = document.getElementById('toggleTokenBtn');

  toggleTokenBtn.addEventListener('click', () => {
    if (tokenInput.type === 'password') {
      tokenInput.type = 'text';
      toggleTokenBtn.textContent = 'Hide';
    } else {
      tokenInput.type = 'password';
      toggleTokenBtn.textContent = 'Show';
    }
  });

  // UI Elements
  const ghOwnerInput = document.getElementById('ghOwner');
  const ghRepoInput = document.getElementById('ghRepo');
  const ghBranchInput = document.getElementById('ghBranch');
  const geminiKeyInput = document.getElementById('geminiKey');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnBtn = document.getElementById('testConnBtn');
  const statusMsg = document.getElementById('statusMessage');
  const connPill = document.getElementById('connectionStatus');

  const problemTitle = document.getElementById('problemTitle');
  const problemDiff = document.getElementById('problemDiff');
  const problemPlatform = document.getElementById('problemPlatform');
  const problemLang = document.getElementById('problemLang');

  // AI Elements
  const aiTimeComp = document.getElementById('aiTimeComp');
  const aiSpaceComp = document.getElementById('aiSpaceComp');
  const aiPattern = document.getElementById('aiPattern');
  const aiIntuition = document.getElementById('aiIntuition');
  const aiEdgeCases = document.getElementById('aiEdgeCases');
  const aiSource = document.getElementById('aiSource');

  // AI Recommendation Elements
  const recLink = document.getElementById('recLink');
  const recDiff = document.getElementById('recDiff');
  const recReason = document.getElementById('recReason');

  function normalizePlatform(p) {
    if (!p) return 'LeetCode';
    const s = String(p).toLowerCase().trim();
    if (s.includes('gfg') || s.includes('geeks')) return 'GeeksforGeeks';
    if (s.includes('hacker')) return 'HackerRank';
    if (s.includes('codeforce') || s.includes('forces')) return 'Codeforces';
    return 'LeetCode';
  }

  function showStatus(text, type = 'success') {
    statusMsg.textContent = text;
    statusMsg.className = `notification-box ${type}`;
    statusMsg.classList.remove('hidden');
  }

  function setConnectionBadge(connected) {
    if (connected) {
      connPill.className = 'connection-pill connected';
      connPill.querySelector('.status-label').textContent = 'Connected';
    } else {
      connPill.className = 'connection-pill disconnected';
      connPill.querySelector('.status-label').textContent = 'Disconnected';
    }
  }

  // Load Saved Settings & Storage
  chrome.storage.local.get(['ghToken', 'ghOwner', 'ghRepo', 'ghBranch', 'geminiKey', 'syncHistory', 'solvedMap', 'currentDetectedProblem', 'lastAiAnalysis'], (data) => {
    if (data.ghToken) tokenInput.value = data.ghToken;
    if (data.ghOwner) ghOwnerInput.value = data.ghOwner;
    if (data.ghRepo) ghRepoInput.value = data.ghRepo || 'DSA-Problem-Vault';
    if (data.ghBranch) ghBranchInput.value = data.ghBranch || 'main';
    if (data.geminiKey) geminiKeyInput.value = data.geminiKey;

    if (data.ghToken && data.ghOwner && data.ghRepo) {
      setConnectionBadge(true);
      fetchCsvFromGitHub(data.ghToken, data.ghOwner, data.ghRepo, data.ghBranch || 'main');
    } else {
      setConnectionBadge(false);
    }

    renderActiveProblem(data.currentDetectedProblem);
    renderAnalytics(data.syncHistory || [], data.solvedMap || {});
    renderActivity(data.syncHistory || []);
    renderAiAnalysis(data.lastAiAnalysis);
  });

  // Query current active browser tab for live problem details
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_AND_SYNC' }, (response) => {
        if (!chrome.runtime.lastError && response && response.success && response.data) {
          response.data.platform = normalizePlatform(response.data.platform);
          renderActiveProblem(response.data);
          chrome.storage.local.set({ currentDetectedProblem: response.data });
        }
      });
    }
  });

  function renderActiveProblem(prob) {
    if (!prob || !prob.title) {
      problemTitle.textContent = 'Not on a recognized problem page';
      problemDiff.textContent = 'Inactive';
      problemDiff.className = 'badge';
      problemPlatform.textContent = 'Platform: --';
      problemLang.textContent = 'Language: --';
      return;
    }

    const platform = normalizePlatform(prob.platform);
    problemTitle.textContent = prob.title;
    problemDiff.textContent = prob.difficulty || 'Medium';

    const diff = (prob.difficulty || '').toLowerCase();
    if (diff === 'easy') problemDiff.className = 'badge diff-easy';
    else if (diff === 'hard') problemDiff.className = 'badge diff-hard';
    else problemDiff.className = 'badge diff-medium';

    problemPlatform.textContent = `Platform: ${platform}`;
    problemLang.textContent = `Language: ${prob.language || 'C++'}`;
  }

  function renderAiAnalysis(ai) {
    if (!ai) {
      aiTimeComp.textContent = '--';
      aiSpaceComp.textContent = '--';
      aiPattern.textContent = 'Arrays & Hashing';
      aiIntuition.textContent = 'Solve a problem on LeetCode, GFG, HackerRank or Codeforces to view AI solution analysis.';
      aiEdgeCases.textContent = 'Boundary conditions and constraints analysis.';
      aiSource.textContent = 'Engine: Zero-Latency Local AI';

      recLink.textContent = '3Sum';
      recLink.href = 'https://leetcode.com/problems/3sum/';
      recDiff.textContent = 'Medium';
      recDiff.className = 'badge diff-medium';
      recReason.textContent = 'Builds on two-pointers to find 3-element sum triplets.';
      return;
    }

    aiTimeComp.textContent = ai.timeComplexity || 'O(N)';
    aiSpaceComp.textContent = ai.spaceComplexity || 'O(1)';
    aiPattern.textContent = ai.pattern || 'Arrays & Hashing';
    aiIntuition.textContent = ai.intuition || 'Analyzed solution structure.';
    aiEdgeCases.textContent = ai.edgeCases || 'Standard boundary constraints.';
    aiSource.textContent = `Engine: ${ai.source || 'AlgoVault AI Engine'}`;

    const rec = ai.recommendedNext || {};
    recLink.textContent = rec.title || '3Sum';
    recLink.href = rec.url || 'https://leetcode.com/problems/3sum/';
    recDiff.textContent = rec.difficulty || 'Medium';
    
    const rDiff = (rec.difficulty || '').toLowerCase();
    if (rDiff === 'easy') recDiff.className = 'badge diff-easy';
    else if (rDiff === 'hard') recDiff.className = 'badge diff-hard';
    else recDiff.className = 'badge diff-medium';

    recReason.textContent = rec.reason || 'Recommended follow-up problem.';
  }

  // Save Settings Handler
  saveSettingsBtn.addEventListener('click', () => {
    const config = {
      ghToken: tokenInput.value.trim(),
      ghOwner: ghOwnerInput.value.trim(),
      ghRepo: ghRepoInput.value.trim() || 'DSA-Problem-Vault',
      ghBranch: ghBranchInput.value.trim() || 'main',
      geminiKey: geminiKeyInput.value.trim()
    };

    chrome.storage.local.set(config, () => {
      showStatus('Configuration saved successfully.', 'success');
      if (config.ghToken && config.ghOwner && config.ghRepo) {
        setConnectionBadge(true);
        fetchCsvFromGitHub(config.ghToken, config.ghOwner, config.ghRepo, config.ghBranch);
      }
    });
  });

  // Test Connection Handler
  testConnBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const owner = ghOwnerInput.value.trim();
    const repo = ghRepoInput.value.trim() || 'DSA-Problem-Vault';
    const branch = ghBranchInput.value.trim() || 'main';

    if (!token || !owner || !repo) {
      showStatus('Please enter PAT token, username, and repository.', 'error');
      return;
    }

    testConnBtn.disabled = true;
    testConnBtn.textContent = 'Testing...';

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (res.ok) {
        showStatus(`Connected to repository ${owner}/${repo}`, 'success');
        setConnectionBadge(true);
        chrome.storage.local.set({ ghToken: token, ghOwner: owner, ghRepo: repo, ghBranch: branch });
        fetchCsvFromGitHub(token, owner, repo, branch);
      } else {
        const errData = await res.json();
        showStatus(`Connection failed: ${getFriendlyGitHubError(res.status, errData.message)}`, 'error');
        setConnectionBadge(false);
      }
    } catch (err) {
      showStatus(`Error connecting to GitHub: ${err.message}`, 'error');
      setConnectionBadge(false);
    } finally {
      testConnBtn.disabled = false;
      testConnBtn.textContent = 'Test Connection';
    }
  });

  /**
   * Fetches `submissions.csv` directly from GitHub to populate exact solved counts.
   */
  async function fetchCsvFromGitHub(token, owner, repo, branch) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/submissions.csv?ref=${branch}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.content) {
          const raw = atob(json.content.replace(/\s/g, ''));
          const lines = raw.trim().split('\n');
          const solvedMap = {};

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',');
            if (parts.length >= 4) {
              const platform = normalizePlatform(parts[0]);
              let title = parts[2] ? parts[2].replace(/"/g, '').trim() : '';
              let diff = parts[3] ? parts[3].replace(/"/g, '').trim() : 'Medium';
              if (parts.length === 6) {
                title = parts[1] ? parts[1].replace(/"/g, '').trim() : '';
                diff = parts[2] ? parts[2].replace(/"/g, '').trim() : 'Medium';
              }

              if (title) {
                const key = `${platform}_${title.toLowerCase()}`;
                solvedMap[key] = { platform, title, difficulty: diff };
              }
            }
          }

          chrome.storage.local.set({ solvedMap: solvedMap }, () => {
            chrome.storage.local.get(['syncHistory'], (d) => {
              renderAnalytics(d.syncHistory || [], solvedMap);
            });
          });
        }
      }
    } catch (e) {
      console.warn('[AlgoVault] CSV fetch notice:', e);
    }
  }

  function renderAnalytics(history, solvedMap = {}) {
    const uniqueMap = new Map();

    Object.keys(solvedMap).forEach(key => {
      const item = solvedMap[key];
      const platform = normalizePlatform(item.platform);
      uniqueMap.set(`${platform}_${item.title.toLowerCase()}`, {
        platform: platform,
        difficulty: item.difficulty || 'Medium'
      });
    });

    history.forEach(item => {
      if (item.status === 'Success' && item.title) {
        const platform = normalizePlatform(item.platform);
        const key = `${platform}_${item.title.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            platform: platform,
            difficulty: item.difficulty || 'Medium'
          });
        }
      }
    });

    const platformCounts = { LeetCode: 0, GeeksforGeeks: 0, HackerRank: 0, Codeforces: 0 };
    let easy = 0, med = 0, hard = 0;

    uniqueMap.forEach(prob => {
      const p = normalizePlatform(prob.platform);
      if (platformCounts[p] !== undefined) {
        platformCounts[p]++;
      }

      const d = (prob.difficulty || '').toLowerCase();
      if (d === 'easy') easy++;
      else if (d === 'hard') hard++;
      else med++;
    });

    document.getElementById('statLeetcode').textContent = platformCounts.LeetCode;
    document.getElementById('statGfg').textContent = platformCounts.GeeksforGeeks;
    document.getElementById('statHackerRank').textContent = platformCounts.HackerRank;
    document.getElementById('statCodeforces').textContent = platformCounts.Codeforces;

    const total = easy + med + hard || 1;
    document.getElementById('countEasy').textContent = easy;
    document.getElementById('countMedium').textContent = med;
    document.getElementById('countHard').textContent = hard;

    document.getElementById('barEasy').style.width = `${((easy / total) * 100).toFixed(0)}%`;
    document.getElementById('barMedium').style.width = `${((med / total) * 100).toFixed(0)}%`;
    document.getElementById('barHard').style.width = `${((hard / total) * 100).toFixed(0)}%`;
  }

  function renderActivity(history) {
    const list = document.getElementById('activityList');
    if (!history || history.length === 0) {
      list.innerHTML = `<div class="empty-feed">No recorded submissions yet.</div>`;
      return;
    }

    list.innerHTML = history.slice(0, 15).map(item => {
      const isOk = item.status === 'Success';
      const statusText = isOk ? 'Synced' : 'Failed';
      const platform = normalizePlatform(item.platform);
      return `
        <div class="feed-item">
          <div>
            <div class="feed-title">[${platform}] ${item.title}</div>
            <div class="feed-meta">Language: ${item.language || 'C++'} | Difficulty: ${item.difficulty || 'Medium'} | ${statusText}</div>
          </div>
        </div>
      `;
    }).join('');
  }
});
