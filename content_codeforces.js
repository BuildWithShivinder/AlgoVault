/**
 * CodeSync Content Script for Codeforces (codeforces.com)
 */
(function () {
  console.log('[CodeSync] Codeforces content script active on:', window.location.href);

  let lastProcessedKey = null;

  function attachSubmitListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const btn = target.closest('input[type="submit"], button[type="submit"], button, .submit');
      if (btn) {
        const txt = (btn.value || btn.textContent || '').toLowerCase();
        if (txt.includes('submit')) {
          console.log('[CodeSync] Codeforces Submit button clicked! Setting submission timestamp...');
          chrome.storage.local.set({ codeforcesSubmitTime: Date.now() });
        }
      }
    }, true);
  }

  function getProblemDetailsFromRow(row) {
    let number = '--';
    let title = 'Codeforces Problem';
    let slug = 'codeforces-problem';
    let difficulty = 'Medium';
    let url = window.location.href;

    const probLink = row.querySelector('a[href*="/problem/"], a[href*="/problemset/problem/"]');
    if (probLink) {
      url = probLink.href;
      const linkText = probLink.innerText.trim();
      const match = linkText.match(/^([A-Z0-9]+)\s*-\s*(.+)/i);
      if (match) {
        number = match[1].toUpperCase();
        title = match[2].trim();
        slug = `${number}-${title.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
      } else {
        title = linkText;
      }
      
      const hrefMatch = probLink.href.match(/\/(?:problemset\/problem|contest\/(\d+)\/problem)\/(\d+)?\/?([A-Za-z0-9]+)/i) ||
                        probLink.href.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i) ||
                        probLink.href.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
      if (hrefMatch) {
        const cId = hrefMatch[1] || hrefMatch[2];
        const pIdx = (hrefMatch[3] || hrefMatch[2] || '').toUpperCase();
        if (cId && pIdx && !number.includes(cId)) {
          number = `${cId}${pIdx}`;
          slug = `${number}-${title.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
        }
      }
    }

    return { title, slug, number, difficulty, url };
  }

  function getProblemDetails() {
    let title = 'Codeforces Problem';
    let slug = 'codeforces-problem';
    let number = '--';
    let difficulty = 'Medium';
    let url = window.location.href;

    const path = window.location.pathname;

    let contestId = '';
    let problemIndex = '';

    const matchProblemset = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
    const matchContest = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
    const matchGym = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);

    if (matchProblemset) {
      contestId = matchProblemset[1];
      problemIndex = matchProblemset[2].toUpperCase();
    } else if (matchContest) {
      contestId = matchContest[1];
      problemIndex = matchContest[2].toUpperCase();
    } else if (matchGym) {
      contestId = `GYM-${matchGym[1]}`;
      problemIndex = matchGym[2].toUpperCase();
    }

    const titleEl = document.querySelector('.problem-statement .title');
    if (titleEl) {
      const fullText = titleEl.innerText.trim();
      const titleMatch = fullText.match(/^([A-Z0-9]+)\.\s*(.+)/i);
      if (titleMatch) {
        if (!problemIndex) problemIndex = titleMatch[1].toUpperCase();
        title = titleMatch[2].trim();
      } else {
        title = fullText;
      }
    }

    if (!contestId) {
      const contestLink = document.querySelector('a[href*="/contest/"], a[href*="/problemset/problem/"]');
      if (contestLink) {
        const cMatch = contestLink.href.match(/\/(?:contest|problem)\/(\d+)/);
        if (cMatch) contestId = cMatch[1];
      }
    }

    if (contestId && problemIndex) {
      number = `${contestId}${problemIndex}`;
      slug = `${contestId}-${problemIndex}`.toLowerCase();
    } else if (problemIndex) {
      number = problemIndex;
      slug = problemIndex.toLowerCase();
    } else if (contestId) {
      number = contestId;
      slug = contestId;
    }

    const tagEls = document.querySelectorAll('span.tag-box');
    tagEls.forEach(t => {
      const txt = t.innerText.trim();
      if (txt.startsWith('*')) {
        const rating = parseInt(txt.replace('*', ''), 10);
        if (rating <= 1200) difficulty = 'Easy';
        else if (rating <= 1900) difficulty = 'Medium';
        else difficulty = 'Hard';
      }
    });

    return { title, slug, number, difficulty, url };
  }

  function getLanguage() {
    const langSelect = document.querySelector('select[name="programTypeId"]');
    if (langSelect && langSelect.selectedOptions.length > 0) {
      return langSelect.selectedOptions[0].innerText.trim();
    }

    const firstRow = document.querySelector('table.status-frame-datatable tr[data-submission-id], .datatable tr:nth-child(2)');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 5) {
        const langText = cells[4].innerText.trim();
        if (langText && !langText.includes('Accepted')) return langText;
      }
    }

    return 'C++';
  }

  function extractCode() {
    const textarea = document.querySelector('textarea[name="source"], #sourceCodeTextarea, textarea');
    if (textarea && textarea.value && textarea.value.trim()) return textarea.value;

    const sourcePre = document.querySelector('#program-source-text, pre.prettyprint, pre.program-source');
    if (sourcePre && sourcePre.innerText) return sourcePre.innerText;

    const codeEls = document.querySelectorAll('.program-source pre, code');
    if (codeEls && codeEls.length > 0) {
      return Array.from(codeEls).map(l => l.innerText).join('\n');
    }

    return '// Solution Code';
  }

  function checkCodeforcesAccepted() {
    chrome.storage.local.get(['codeforcesSubmitTime'], (data) => {
      const submitTime = data.codeforcesSubmitTime || 0;
      const isRecentlySubmitted = (Date.now() - submitTime) < 180000; // Within last 3 minutes

      if (!isRecentlySubmitted) return;

      const acceptedCell = document.querySelector('span.verdict-accepted, td.status-verdictCell span.verdict-accepted, .verdict-accepted');
      if (acceptedCell) {
        const parentRow = acceptedCell.closest('tr');
        let payload = null;

        if (parentRow) {
          payload = getProblemDetailsFromRow(parentRow);
          payload.platform = 'Codeforces';
          payload.language = getLanguage();
          payload.code = extractCode();
          payload.timestamp = Date.now();
        } else {
          const prob = getProblemDetails();
          payload = {
            platform: 'Codeforces',
            number: prob.number,
            title: prob.title,
            slug: prob.slug,
            difficulty: prob.difficulty,
            language: getLanguage(),
            code: extractCode(),
            url: prob.url,
            timestamp: Date.now()
          };
        }

        const currentKey = `${payload.slug}-${payload.language}`;
        if (lastProcessedKey === currentKey) return;

        lastProcessedKey = currentKey;
        chrome.storage.local.remove(['codeforcesSubmitTime']);

        console.log('🎉 [CodeSync] Codeforces Solution ACCEPTED after submit:', payload.title);

        if (window.CodeSyncToast) {
          window.CodeSyncToast.show({
            type: 'syncing',
            title: 'CodeSync',
            message: `Syncing "${payload.title}" to GitHub...`,
            duration: 3000
          });
        }

        chrome.runtime.sendMessage({ type: 'SUBMISSION_ACCEPTED', data: payload }, (response) => {
          if (response && response.result && response.result.success) {
            const commitUrl = `https://github.com/${response.result.repo}/tree/main/Codeforces/${response.result.folder}`;
            if (window.CodeSyncToast) {
              window.CodeSyncToast.show({
                type: 'success',
                title: 'Committed to GitHub',
                message: `Saved ${payload.title} (${payload.language})`,
                commitUrl: commitUrl,
                duration: 7000
              });
            }
          }
        });
      }
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_AND_SYNC') {
      const payload = getProblemDetails();
      payload.platform = 'Codeforces';
      payload.language = getLanguage();
      payload.code = extractCode();
      sendResponse({ success: true, data: payload });
    }
    return true;
  });

  setTimeout(() => {
    attachSubmitListeners();
    const observer = new MutationObserver(() => checkCodeforcesAccepted());
    observer.observe(document.body, { childList: true, subtree: true });
    checkCodeforcesAccepted();
  }, 1000);
})();
