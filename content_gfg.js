/**
 * CodeSync Content Script for GeeksforGeeks Practice (geeksforgeeks.org)
 */
(function () {
  console.log('[CodeSync] GeeksforGeeks script initialized.');

  let isSubmitting = false;
  let lastProcessedKey = null;

  function getProblemDetails() {
    let title = 'GFG Problem';
    let difficulty = 'Medium';
    let slug = 'gfg-problem';

    const path = window.location.pathname;
    const match = path.match(/\/problems\/([a-z0-9-]+)/i);
    if (match) slug = match[1];

    const titleEl = document.querySelector('h3.problem-tab_title, div[class*="problems_header_content"] h3, .problems_header_content__title');
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else if (slug) {
      title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const diffEl = document.querySelector('span[class*="problem-tab_difficulty"], div[class*="difficultyTag"]');
    if (diffEl) {
      const txt = diffEl.innerText.trim();
      if (/basic|easy/i.test(txt)) difficulty = 'Easy';
      else if (/medium/i.test(txt)) difficulty = 'Medium';
      else if (/hard/i.test(txt)) difficulty = 'Hard';
    }

    return { title, slug, difficulty };
  }

  function getLanguage() {
    const langBtn = document.querySelector('div[class*="language-selector"], div[class*="editor-header"] button, select.language-select');
    if (langBtn) {
      return langBtn.innerText.trim().split('\n')[0] || 'C++';
    }
    return 'C++';
  }

  function extractCode() {
    const lines = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
    if (lines && lines.length > 0) {
      return Array.from(lines).map(line => line.innerText.replace(/\u00a0/g, ' ')).join('\n');
    }
    const monacoLines = document.querySelectorAll('.monaco-editor .view-line');
    if (monacoLines && monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.innerText.replace(/\u00a0/g, ' ')).join('\n');
    }
    const textarea = document.querySelector('textarea.editor-input, textarea');
    if (textarea && textarea.value) return textarea.value;

    return '// Solution Code';
  }

  function getPayload() {
    const prob = getProblemDetails();
    return {
      platform: 'GeeksforGeeks',
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
      const btn = target.closest('button[class*="submit"], button.problems_submit_btn, button');
      if (btn && btn.textContent && /submit/i.test(btn.textContent)) {
        console.log('[CodeSync] GFG Submit button clicked!');
        isSubmitting = true;
      }
    }, true);
  }

  function checkGfgAccepted() {
    // STRICT GUARD: Only trigger sync if user clicked Submit button
    if (!isSubmitting) return;

    const resultBanner = document.querySelector(
      'div[class*="problem-polar-status-success"], ' +
      'div[class*="results_heading_success"], ' +
      'div[class*="congrats_message"], ' +
      'span[class*="success_tag"]'
    );

    const isSuccessText = document.body.innerText.includes('Problem Solved Successfully') ||
                          document.body.innerText.includes('Correct Answer');

    if (resultBanner || isSuccessText) {
      const payload = getPayload();
      const currentKey = `${payload.slug}-${payload.language}`;

      if (lastProcessedKey === currentKey) {
        isSubmitting = false;
        return;
      }

      lastProcessedKey = currentKey;
      isSubmitting = false;

      console.log('[CodeSync] GFG Solution ACCEPTED after submit:', payload.title);

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
          const commitUrl = `https://github.com/${response.result.repo}/tree/main/GeeksforGeeks/${response.result.folder}`;
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
    const observer = new MutationObserver(() => checkGfgAccepted());
    observer.observe(document.body, { childList: true, subtree: true });
  }, 1000);
})();
