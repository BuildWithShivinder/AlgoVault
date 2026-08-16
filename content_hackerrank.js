/**
 * CodeSync Content Script for HackerRank (hackerrank.com)
 */
(function () {
  console.log('[CodeSync] HackerRank script initialized.');

  let isSubmitting = false;
  let lastProcessedKey = null;

  function getProblemDetails() {
    let title = 'HackerRank Challenge';
    let difficulty = 'Medium';
    let slug = 'hackerrank-challenge';

    const path = window.location.pathname;
    const match = path.match(/\/challenges\/([a-z0-9-]+)/i);
    if (match) slug = match[1];

    const titleEl = document.querySelector('h1.ui-icon-label, h1.page-title, .challenge-title');
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else if (slug) {
      title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const diffEl = document.querySelector('.difficulty-badge, span[class*="difficulty"]');
    if (diffEl) {
      const txt = diffEl.innerText.trim();
      if (/easy/i.test(txt)) difficulty = 'Easy';
      else if (/medium/i.test(txt)) difficulty = 'Medium';
      else if (/hard/i.test(txt)) difficulty = 'Hard';
    }

    return { title, slug, difficulty };
  }

  function getLanguage() {
    const langSelector = document.querySelector('.select-language span, div[class*="language"]');
    if (langSelector) return langSelector.innerText.trim();
    return 'C++';
  }

  function extractCode() {
    const lines = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
    if (lines && lines.length > 0) {
      return Array.from(lines).map(l => l.innerText.replace(/\u00a0/g, ' ')).join('\n');
    }
    const monaco = document.querySelectorAll('.monaco-editor .view-line');
    if (monaco && monaco.length > 0) {
      return Array.from(monaco).map(l => l.innerText.replace(/\u00a0/g, ' ')).join('\n');
    }
    return '// Solution Code';
  }

  function getPayload() {
    const prob = getProblemDetails();
    return {
      platform: 'HackerRank',
      number: null,
      title: prob.title,
      slug: prob.slug,
      difficulty: prob.difficulty,
      language: getLanguage(),
      code: extractCode(),
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  function attachSubmitListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const btn = target.closest('button[class*="submit"], button.hr-monaco-submit, button');
      if (btn && btn.textContent && /submit/i.test(btn.textContent)) {
        console.log('[CodeSync] HackerRank Submit button clicked!');
        isSubmitting = true;
      }
    }, true);
  }

  function checkHackerRankAccepted() {
    // STRICT GUARD: Only trigger sync if user clicked Submit button
    if (!isSubmitting) return;

    const congratsBanner = document.querySelector('.congrats-wrapper, div[class*="congratulations"], .submission-result-accepted');
    const isSuccessText = document.body.innerText.includes('Congratulations') && document.body.innerText.includes('You passed all test cases');

    if (congratsBanner || isSuccessText) {
      const payload = getPayload();
      const currentKey = `${payload.slug}-${payload.language}`;

      if (lastProcessedKey === currentKey) {
        isSubmitting = false;
        return;
      }

      lastProcessedKey = currentKey;
      isSubmitting = false;

      console.log('[CodeSync] HackerRank Solution ACCEPTED after submit:', payload.title);

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
          const commitUrl = `https://github.com/${response.result.repo}/tree/main/HackerRank/${response.result.folder}`;
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
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_AND_SYNC') {
      const payload = getPayload();
      sendResponse({ success: true, data: payload });
    }
    return true;
  });

  setTimeout(() => {
    attachSubmitListeners();
    const observer = new MutationObserver(() => checkHackerRankAccepted());
    observer.observe(document.body, { childList: true, subtree: true });
  }, 1000);
})();
