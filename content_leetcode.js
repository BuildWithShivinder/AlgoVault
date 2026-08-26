/**
 * CodeSync Content Script for LeetCode (leetcode.com & leetcode.cn)
 */
(function () {
  console.log('[CodeSync] LeetCode content script active on:', window.location.href);

  let isSubmitting = false;
  let lastProcessedSubmissionKey = null;
  let captureInFlight = false;

  const MONACO_BRIDGE_SOURCE = 'AlgoVaultMonacoBridge';
  const monacoBridgeResolvers = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== MONACO_BRIDGE_SOURCE) return;
    const resolver = monacoBridgeResolvers.get(data.requestId);
    if (!resolver) return;
    monacoBridgeResolvers.delete(data.requestId);
    clearTimeout(resolver.timer);
    resolver.resolve(typeof data.code === 'string' ? data.code : '');
  });

  function injectMonacoModelReader(requestId) {
    try {
      const injected = document.createElement('script');
      injected.textContent =
        "(function () {" +
        "  var code = '';" +
        "  try {" +
        "    var models = (window.monaco && window.monaco.editor && window.monaco.editor.getModels)" +
        "      ? window.monaco.editor.getModels() : [];" +
        "    for (var i = 0; i < models.length; i++) {" +
        "      var value = '';" +
        "      try { value = models[i].getValue() || ''; } catch (e) {}" +
        "      if (value.length > code.length) code = value;" +
        "    }" +
        "  } catch (e) {}" +
        "  window.postMessage({ source: '" + MONACO_BRIDGE_SOURCE + "', requestId: '" + requestId + "', code: code }, window.location.origin);" +
        "})();";
      (document.head || document.documentElement).appendChild(injected);
      injected.remove();
    } catch (e) {
      console.warn('[CodeSync] Monaco bridge injection failed:', e);
    }
  }

  function fetchFullEditorBuffer() {
    return new Promise((resolve) => {
      const requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        monacoBridgeResolvers.delete(requestId);
        resolve('');
      }, 250);

      monacoBridgeResolvers.set(requestId, { resolve: resolve, timer: timer });
      injectMonacoModelReader(requestId);
    });
  }

  async function extractCode() {
    // Strategy 1: Full Monaco buffer via page-world bridge (immune to viewport virtualization)
    const bridgedCode = await fetchFullEditorBuffer();
    if (bridgedCode.trim()) {
      return bridgedCode;
    }

    // Strategy 2: Monaco view lines (partial fallback; sort by rendered position)
    const lines = document.querySelectorAll('.monaco-editor .view-line');
    if (lines && lines.length > 0) {
      const codeLines = Array.from(lines)
        .map(line => ({
          top: parseInt(line.style.top, 10) || 0,
          text: line.textContent.replace(/\u00a0/g, ' ')
        }))
        .sort((a, b) => a.top - b.top)
        .map(entry => entry.text);
      const joined = codeLines.join('\n');
      if (joined.trim()) {
        return joined;
      }
    }

    // Strategy 3: Inputarea / textarea (mirrors only the active line under Monaco)
    const textarea = document.querySelector('.monaco-editor textarea, textarea.inputarea, .CodeMirror');
    if (textarea && textarea.value) {
      return textarea.value;
    }

    // Strategy 4: General code block
    const codeEl = document.querySelector('code, pre');
    if (codeEl && codeEl.innerText) {
      return codeEl.innerText;
    }

    return '// Solution Code';
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

  function isPlausibleCompleteCode(code, language) {
    if (!code) return false;
    const trimmed = code.trim();
    if (!trimmed) return false;
    if (trimmed === '// Solution Code') return false;
    if (trimmed.length < 30) return false;

    if (isCFamilyLanguage(language)) {
      return hasBalancedDelimiters(trimmed);
    }

    return true;
  }

  function extractLanguage(code) {
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

    if (/#include|std::|vector</i.test(String(code))) return 'C++';
    if (/public\s+class|public\s+static/i.test(code)) return 'Java';
    if (/def\s+\w+\(self/i.test(code)) return 'Python3';
    if (/function\s+\w+|const\s+\w+\s*=/i.test(code)) return 'JavaScript';
    if (/impl\s+Solution/i.test(code)) return 'Rust';
    if (/func\s+\w+\(/i.test(code)) return 'Go';

    return 'C++';
  }

  async function getProblemMetadata() {
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

    const code = await extractCode();

    return {
      platform: 'LeetCode',
      slug: slug,
      title: title,
      number: number,
      difficulty: difficulty,
      language: extractLanguage(code),
      code: code,
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function sendAcceptedSubmission(payload) {
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

  async function captureValidPayload(maxAttempts, retryDelayMs) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const payload = await getProblemMetadata();
      if (payload && isPlausibleCompleteCode(payload.code, payload.language)) {
        return payload;
      }
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }
    return null;
  }

  async function checkForAcceptedSubmission() {
    // STRICT GUARD: Only check for accepted submission if user explicitly clicked Submit,
    // and never run overlapping capture loops while awaiting extraction retries
    if (!isSubmitting || captureInFlight) return;

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
      captureInFlight = true;
      try {
        const payload = await captureValidPayload(6, 400);
        isSubmitting = false;

        if (!payload) {
          lastProcessedSubmissionKey = null;
          console.warn('[CodeSync] Captured code looked incomplete after retries. Sync skipped.');
          if (window.CodeSyncToast) {
            window.CodeSyncToast.show({
              type: 'error',
              title: 'Capture incomplete',
              message: 'Could not read the full solution from the editor. Sync skipped — open the AlgoVault popup and press Sync to retry.',
              duration: 8000
            });
          }
          return;
        }

        const codeSnippet = payload.code ? payload.code.slice(0, 30) : '';
        const submissionKey = `${payload.slug}-${payload.language}-${codeSnippet}`;

        if (lastProcessedSubmissionKey === submissionKey) {
          return;
        }

        lastProcessedSubmissionKey = submissionKey;
        sendAcceptedSubmission(payload);
      } finally {
        captureInFlight = false;
      }
    }
  }

  function observeDOM() {
    const observer = new MutationObserver(() => {
      checkForAcceptedSubmission().catch(err => console.warn('[CodeSync] Submission check failed:', err));
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_AND_SYNC') {
      getProblemMetadata()
        .then((payload) => {
          if (payload) {
            sendResponse({ success: true, data: payload });
          } else {
            sendResponse({ success: false, error: 'Not on a valid LeetCode problem page.' });
          }
        })
        .catch((err) => {
          console.warn('[CodeSync] Manual extraction failed:', err);
          sendResponse({ success: false, error: 'Failed to extract solution from the page.' });
        });
    }
    return true;
  });

  setTimeout(() => {
    attachSubmitButtonListeners();
    observeDOM();
  }, 1000);
})();
