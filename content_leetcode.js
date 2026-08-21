/**
 * CodeSync Content Script for LeetCode (leetcode.com & leetcode.cn)
 */
(function () {
  console.log('[CodeSync] LeetCode content script active on:', window.location.href);

  let isSubmitting = false;
  let lastProcessedSubmissionKey = null;

  function extractCode() {
    // Strategy 1: Monaco Editor view lines
    const lines = document.querySelectorAll('.monaco-editor .view-line');
    if (lines && lines.length > 0) {
      const codeLines = Array.from(lines).map(line => line.textContent.replace(/\u00a0/g, ' '));
      if (codeLines.join('\n').trim()) {
        return codeLines.join('\n');
      }
    }

    // Strategy 2: Inputarea / textarea
    const textarea = document.querySelector('.monaco-editor textarea, textarea.inputarea, .CodeMirror');
    if (textarea && textarea.value) {
      return textarea.value;
    }

    // Strategy 3: General code block
    const codeEl = document.querySelector('code, pre');
    if (codeEl && codeEl.innerText) {
      return codeEl.innerText;
    }

    return '// Solution Code';
  }

  function extractLanguage() {
    const knownLanguages = [
      'C++', 'Java', 'Python3', 'Python', 'C#', 'JavaScript', 
      'TypeScript', 'C', 'Go', 'Ruby', 'Swift', 'Rust', 'Scala', 
      'Kotlin', 'PHP', 'SQL', 'MySQL', 'PostgreSQL'
    ];

    const langSelectors = [
      'button[id^="headlessui-listbox-button"]',
      'div[class*="editor"] button',
      'div[class*="language-select"]',
      'button[class*="bg-fill"]',
      '[data-cy="lang-select"]',
      'button[aria-haspopup="listbox"]',
      'button[aria-haspopup="dialog"]'
    ];

    for (const selector of langSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el && el.textContent) {
          const text = el.textContent.trim();
          for (const lang of knownLanguages) {
            if (text.toLowerCase() === lang.toLowerCase()) {
              return lang;
            }
          }
        }
      }
    }

    const code = extractCode();
    if (/#include|std::|vector</i.test(code)) return 'C++';
    if (/public\s+class|public\s+static/i.test(code)) return 'Java';
    if (/def\s+\w+\(self/i.test(code)) return 'Python3';
    if (/function\s+\w+|const\s+\w+\s*=/i.test(code)) return 'JavaScript';
    if (/impl\s+Solution/i.test(code)) return 'Rust';
    if (/func\s+\w+\(/i.test(code)) return 'Go';

    return 'C++';
  }

  function getProblemMetadata() {
    const url = window.location.href;
    const match = url.match(/\/problems\/([a-z0-9-]+)/i);
    if (!match) return null;

    const slug = match[1];
    let title = '';
    let number = null;

    const titleEl = document.querySelector('.text-title-large, div[data-cy="question-title"], a[href^="/problems/' + slug + '"], h4');
    let rawTitle = titleEl ? titleEl.textContent.trim() : '';

    if (!rawTitle) {
      rawTitle = document.title.replace(/\s*-\s*LeetCode\s*/i, '').trim();
    }

    const numMatch = rawTitle.match(/^(\d+)\.\s*(.+)/);
    if (numMatch) {
      number = parseInt(numMatch[1], 10);
      title = numMatch[2].trim();
    } else {
      title = rawTitle || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    let difficulty = 'Medium';
    const diffEls = document.querySelectorAll('[class*="text-difficulty-"], [class*="text-sd-"], div.text-sd-easy, div.text-sd-medium, div.text-sd-hard');
    for (const el of diffEls) {
      const txt = el.textContent ? el.textContent.trim() : '';
      if (/easy/i.test(txt)) { difficulty = 'Easy'; break; }
      if (/medium/i.test(txt)) { difficulty = 'Medium'; break; }
      if (/hard/i.test(txt)) { difficulty = 'Hard'; break; }
    }

    return {
      platform: 'LeetCode',
      slug: slug,
      title: title,
      number: number,
      difficulty: difficulty,
      language: extractLanguage(),
      code: extractCode(),
      url: `https://leetcode.com/problems/${slug}/`,
      timestamp: Date.now()
    };
  }

  function attachSubmitButtonListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const btn = target.closest('button[data-e2e-locator="console-submit-button"], button[class*="submit"], button');
      if (btn && btn.textContent && /submit/i.test(btn.textContent)) {
        console.log('[CodeSync] Submit button clicked on LeetCode!');
        isSubmitting = true;
      }
    }, true);
  }

  function checkForAcceptedSubmission() {
    // STRICT GUARD: Only check for accepted submission if user explicitly clicked Submit
    if (!isSubmitting) return;

    const resultSelectors = [
      '[data-e2e-locator="submission-result"]',
      'span[data-e2e-locator="submission-result-status"]',
      'span[class*="text-green"]',
      'div[class*="result"]',
      'div[class*="success"]',
      '[data-cy="submission-result"]'
    ];

    let acceptedFound = false;

    for (const selector of resultSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el && el.textContent && el.textContent.trim().toLowerCase() === 'accepted') {
          acceptedFound = true;
          break;
        }
      }
      if (acceptedFound) break;
    }

    if (!acceptedFound) {
      const resContainer = document.querySelector('div[class*="submission-result"], div[class*="result-container"]');
      if (resContainer && /accepted/i.test(resContainer.textContent)) {
        acceptedFound = true;
      }
    }

    if (acceptedFound) {
      const payload = getProblemMetadata();
      if (!payload) return;

      const codeSnippet = payload.code ? payload.code.slice(0, 30) : '';
      const submissionKey = `${payload.slug}-${payload.language}-${codeSnippet}`;

      if (lastProcessedSubmissionKey === submissionKey) {
        isSubmitting = false;
        return;
      }

      lastProcessedSubmissionKey = submissionKey;
      isSubmitting = false; // Reset submitting flag after capturing

      console.log('[CodeSync] Solution ACCEPTED after submit:', payload.title);

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
          const commitUrl = `https://github.com/${response.result.repo}/tree/main/LeetCode/${response.result.folder}`;
          if (window.CodeSyncToast) {
            window.CodeSyncToast.show({
              type: 'success',
              title: 'Committed to GitHub',
              message: `Saved ${payload.title} (${payload.language})`,
              commitUrl: commitUrl,
              duration: 7000
            });
          }
        } else {
            if(window.CodeSyncToast) {
              window.CodeSyncToast.show({
                type: 'error',
                title: 'CodeSync Error',
                message: `Failed to sync "${payload.title}" to GitHub. ${response?.result?.error || 'Please check your GitHub configuration.'}`,
                duration: 7000
              });
            }
          }
      });
    }
  }

  function observeDOM() {
    const observer = new MutationObserver(() => {
      checkForAcceptedSubmission();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_AND_SYNC') {
      const payload = getProblemMetadata();
      if (payload) {
        sendResponse({ success: true, data: payload });
      } else {
        sendResponse({ success: false, error: 'Not on a valid LeetCode problem page.' });
      }
    }
    return true;
  });

  setTimeout(() => {
    attachSubmitButtonListeners();
    observeDOM();
  }, 1000);
})();
