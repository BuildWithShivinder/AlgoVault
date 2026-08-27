/**
 * CodeSync Content Script for LeetCode (leetcode.com & leetcode.cn)
 */
(function () {
  console.log('[CodeSync] LeetCode content script active on:', window.location.href);

  let isSubmitting = false;
  let submitClickedAt = 0;
  let lastProcessedSubmissionKey = null;
  let captureInFlight = false;
  let apiInFlight = false;

  const GRAPHQL_ENDPOINT = location.origin + '/graphql/';
  const API_TIMEOUT_MS = 10000;
  const RATE_LIMIT_RETRY_DELAY_MS = 1500;
  const SUBMISSION_POLL_LIMIT = 20;
  const CLICK_GRACE_MS = 5 * 60 * 1000; // ignore accepts recorded >5min before the click

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

  // ---------------------------------------------------------------------------
  // LeetCode GraphQL API layer
  // Pulls the exact code that was judged, immune to editor/DOM rendering issues.
  // Same-origin request: session cookies flow automatically, csrf comes from a
  // readable (non-httpOnly) cookie. Works for both leetcode.com and leetcode.cn.
  // ---------------------------------------------------------------------------

  // One roundtrip answers auth state AND latest attempts for this slug.
  const SUBMISSION_LIST_QUERY = `
    query algovaultProbe($offset: Int!, $limit: Int!, $questionSlug: String!) {
      userStatus {
        isSignedIn
      }
      submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
        submissions {
          id
          statusDisplay
          lang
          timestamp
        }
      }
    }
  `;

  // submissionDetails.lang is a LanguageNode object on the current gateway
  // (scalar "lang" 400s with: Field "lang" of type "LanguageNode!" must have
  // a sub-selection). Variants tried in order; first that validates wins and
  // is remembered for the session.
  const SUBMISSION_DETAILS_QUERIES = [
    `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
        lang { name }
        question {
          questionFrontendId
          title
          titleSlug
          difficulty
        }
      }
    }
  `,
    `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
        lang
        question {
          questionFrontendId
          title
          titleSlug
          difficulty
        }
      }
    }
  `
  ];
  let preferredDetailsQueryIndex = 0;

  function getCsrftokenCandidates() {
    // LeetCode often has TWO csrftoken cookies (host + .leetcode.com domain).
    // document.cookie lists both; sending the wrong one as x-csrftoken makes
    // the gateway fail the CSRF check with HTTP 400 when signed in.
    const matches = document.cookie.match(/(?:^|;\s*)csrftoken=[^;]*/g) || [];
    const seen = new Set();
    for (const m of matches) {
      try {
        seen.add(decodeURIComponent(m.split('=')[1]));
      } catch (e) {
        seen.add(m.split('=')[1]);
      }
    }
    return Array.from(seen);
  }

  function getCsrftoken() {
    const candidates = getCsrftokenCandidates();
    return candidates.length ? candidates[0] : '';
  }

  async function lcGraphql(query, variables, retryAttempt = 0) {
    const csrfCandidates = getCsrftokenCandidates();
    if (!csrfCandidates.length) {
      throw new Error('missing csrftoken cookie (not logged in?)');
    }

    // Try every csrf candidate; finally try with no header at all.
    const headerVariants = csrfCandidates.concat([null]);
    let lastHttpError = null;

    for (let v = 0; v < headerVariants.length; v++) {
      const csrf = headerVariants[v];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      let response;
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (csrf) headers['x-csrftoken'] = csrf;
        response = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          credentials: 'include',
          headers: headers,
          body: JSON.stringify({ query: query, variables: variables }),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timer);
        throw new Error('network error: ' + (err && err.name === 'AbortError' ? 'timeout' : err));
      }
      clearTimeout(timer);

      if (response.status === 429 && retryAttempt < 1) {
        console.warn('[CodeSync] GraphQL rate limited, retrying once...');
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        return lcGraphql(query, variables, retryAttempt + 1);
      }

      if (!response.ok) {
        let snippet = '';
        try {
          const text = await response.text();
          snippet = text.replace(/\s+/g, ' ').slice(0, 200);
        } catch (e) { void e; }
        lastHttpError = new Error('HTTP ' + response.status + (snippet ? ' — ' + snippet : ''));
        console.warn('[CodeSync] GraphQL HTTP ' + response.status + (csrf ? ' (with csrf[' + v + '])' : ' (no csrf header)'), snippet || '');
        continue; // try next csrf variant
      }

      let json;
      try {
        json = await response.json();
      } catch (err) {
        throw new Error('invalid JSON response');
      }
      if (json.errors && json.errors.length) {
        throw new Error('graphql: ' + (json.errors[0] && json.errors[0].message ? json.errors[0].message : 'unknown error'));
      }
      return json.data || null;
    }

    throw lastHttpError || new Error('HTTP error');
  }

  function langSlugToDisplayName(slug) {
    const map = {
      'cpp': 'C++',
      'c++': 'C++',
      'java': 'Java',
      'python': 'Python',
      'python3': 'Python3',
      'c': 'C',
      'csharp': 'C#',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'dart': 'Dart',
      'golang': 'Go',
      'ruby': 'Ruby',
      'scala': 'Scala',
      'rust': 'Rust',
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'oraclesql': 'Oracle SQL',
      'bash': 'Bash',
      'pandas': 'Pandas'
    };
    return map[String(slug || '').toLowerCase()] || null;
  }

  // Returns { isSignedIn, submission } for the newest fresh accepted attempt.
  async function fetchLatestAcceptedSubmission(slug, sinceUnixSec) {
    const data = await lcGraphql(SUBMISSION_LIST_QUERY, {
      offset: 0,
      limit: SUBMISSION_POLL_LIMIT,
      questionSlug: slug
    });

    const isSignedIn = !!(data && data.userStatus && data.userStatus.isSignedIn);

    const subs = data && data.submissionList && Array.isArray(data.submissionList.submissions)
      ? data.submissionList.submissions
      : [];

    let submission = null;
    for (const sub of subs) {
      if (!sub || !sub.id) continue;
      if (sub.statusDisplay !== 'Accepted') continue;
      const ts = parseInt(sub.timestamp, 10) || 0;
      if (sinceUnixSec > 0 && ts < sinceUnixSec) continue;
      submission = { id: sub.id, lang: sub.lang, timestamp: ts };
      break;
    }
    return { isSignedIn: isSignedIn, submission: submission };
  }

  async function fetchSubmissionDetails(submissionId) {
    const numericId = parseInt(String(submissionId).replace(/[^0-9]/g, ''), 10);
    if (!numericId) throw new Error('non-numeric submission id');

    for (let attempt = 0; attempt < SUBMISSION_DETAILS_QUERIES.length; attempt++) {
      const idx = (preferredDetailsQueryIndex + attempt) % SUBMISSION_DETAILS_QUERIES.length;
      try {
        const data = await lcGraphql(SUBMISSION_DETAILS_QUERIES[idx], { submissionId: numericId });
        preferredDetailsQueryIndex = idx; // remember the working variant
        return data ? data.submissionDetails : null;
      } catch (err) {
        // Cycle variants only on schema-shape errors (HTTP 400 with a GraphQL
        // errors body). Network/5xx/429 failures are transient — the next
        // poll retries the same variant.
        const msg = err && err.message ? err.message : String(err);
        const transient = /^network error/.test(msg) || /HTTP 5\d\d/.test(msg) || /HTTP 429/.test(msg);
        if (!transient && attempt < SUBMISSION_DETAILS_QUERIES.length - 1) {
          console.warn('[CodeSync] Details query variant ' + idx + ' rejected, trying next:', err.message);
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  function getSlugFromUrl() {
    const match = window.location.href.match(/\/problems\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
  }

  function normalizeLangValue(lang) {
    // Handles both scalar ("python3") and LanguageNode ({ name: "python3" }).
    if (typeof lang === 'string') return lang;
    if (lang && typeof lang === 'object' && typeof lang.name === 'string') return lang.name;
    return '';
  }

  async function getApiPayload() {
    const slug = getSlugFromUrl();
    if (!slug) return { isSignedIn: null, payload: null };

    const sinceSec = submitClickedAt > 0 ? Math.floor((submitClickedAt - CLICK_GRACE_MS) / 1000) : 0;
    const list = await fetchLatestAcceptedSubmission(slug, sinceSec);
    if (!list.isSignedIn || !list.submission) {
      return { isSignedIn: list.isSignedIn, payload: null };
    }

    // Keep the signedIn signal even when details fail (schema/network), so
    // the caller never misreads a signed-in session as anonymous.
    let details = null;
    try {
      details = await fetchSubmissionDetails(list.submission.id);
    } catch (err) {
      console.warn('[CodeSync] Submission details fetch failed for id', list.submission.id, ':', err.message);
      return { isSignedIn: true, payload: null };
    }
    if (!details || typeof details.code !== 'string' || !details.code.trim()) {
      console.warn('[CodeSync] Submission details came back empty for id', list.submission.id);
      return { isSignedIn: true, payload: null };
    }

    const q = details.question || {};
    const titleSlug = q.titleSlug || slug;
    const fallbackTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const payload = {
      platform: 'LeetCode',
      slug: titleSlug,
      number: q.questionFrontendId ? parseInt(q.questionFrontendId, 10) : null,
      title: q.title || fallbackTitle,
      difficulty: q.difficulty || '',
      language: langSlugToDisplayName(normalizeLangValue(details.lang) || normalizeLangValue(list.submission.lang)),
      code: details.code,
      url: `${location.origin}/problems/${titleSlug}/`,
      timestamp: Date.now(),
      source: 'api',
      submissionId: String(list.submission.id)
    };

    // Fill any gaps the API left with DOM metadata (rare; selectors unchanged)
    if (!payload.difficulty || !payload.language || !payload.number) {
      try {
        const domMeta = await getProblemMetadata();
        if (domMeta) {
          if (!payload.number) payload.number = domMeta.number;
          if (!payload.difficulty) payload.difficulty = domMeta.difficulty;
          if (!payload.language) payload.language = domMeta.language;
        }
      } catch (err) {
        console.warn('[CodeSync] DOM metadata gap-fill failed:', err);
      }
    }

    return { isSignedIn: true, payload: payload };
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
        submitClickedAt = Date.now();
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

  // Acceptance-window polling: LeetCode's submissionList index can lag the
  // Accepted verdict by several seconds, so one query is never enough.
  // Resolves { payload, signedIn } — signedIn distinguishes "logged in but
  // nothing usable came back" (refuse weak DOM guesses) from "API cannot
  // serve this session" (DOM fallback is the only option left).
  async function waitForApiPayload(maxAttempts, delayMs) {
    let payload = null;
    let signedIn = false;
    let probeSucceeded = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!apiInFlight) {
        apiInFlight = true;
        try {
          const result = await getApiPayload();
          if (result.isSignedIn === true) { signedIn = true; probeSucceeded = true; }
          if (result.payload && isPlausibleCompleteCode(result.payload.code, result.payload.language)) {
            console.log('[CodeSync] Captured solution via LeetCode API (submission', result.payload.submissionId + ').');
            return { payload: result.payload, signedIn: true };
          }
          if (attempt === maxAttempts) {
            console.warn(
              '[CodeSync] API diagnostics: signedIn=' + result.isSignedIn +
              ', attempts=' + attempt +
              (result.payload ? ' (last details unusable)' : ' (no fresh accepted in list)')
            );
          }
        } catch (err) {
          console.warn('[CodeSync] API attempt ' + attempt + '/' + maxAttempts + ' failed:', err.message);
          if (/missing csrftoken/.test(err.message)) {
            console.warn('[CodeSync] csrftoken cookie unreadable; treating session as anonymous.');
            break;
          }
        } finally {
          apiInFlight = false;
        }
      }
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }

    void probeSucceeded;
    return { payload: payload, signedIn: signedIn };
  }

  // Clipped-capture guard: a viewport-only slice of C-family code can be
  // delimiter-balanced yet incomplete (e.g. missing its opening/closing brace
  // lines). Reject captures that don't terminate like finished code.
  function looksTruncatedTail(code) {
    const lines = String(code).split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return true;
    const lastLine = lines[lines.length - 1].trim();
    return !/[});]$/.test(lastLine);
  }

  function domCaptureIsTrustworthy(code, language) {
    if (!isPlausibleCompleteCode(code, language)) return false;
    if (isCFamilyLanguage(language) && looksTruncatedTail(code)) {
      console.warn('[CodeSync] DOM capture rejected: tail looks clipped (virtualized editor).');
      return false;
    }
    return true;
  }

  async function captureValidPayload(maxAttempts, retryDelayMs) {
    // Phase A: source of truth — poll the GraphQL API until the judged code shows up.
    const { payload: apiPayload, signedIn } = await waitForApiPayload(8, 700);

    if (apiPayload) {
      return { payload: apiPayload, skipReason: null };
    }
    if (signedIn) {
      const skipReason = 'You are signed in on LeetCode but the judged code never appeared via the API within ~6s of polling.';
      console.warn('[CodeSync] Refusing DOM fallback while signed in: DOM extraction has committed truncated code before.');
      return { payload: null, skipReason: skipReason };
    }

    // Phase B: API unavailable for this session (anonymous cookie jar / logged
    // out). DOM best-effort with strict completeness guards.
    console.warn('[CodeSync] LeetCode API unavailable for this session; falling back to DOM extraction.');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const payload = await getProblemMetadata();
      if (payload && domCaptureIsTrustworthy(payload.code, payload.language)) {
        console.log('[CodeSync] Captured solution via DOM fallback extraction.');
        return { payload: payload, skipReason: null };
      }
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }
    return { payload: null, skipReason: 'Could not read a complete solution from the editor (anonymous session, DOM fallback rejected the capture).' };
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
        const { payload, skipReason } = await captureValidPayload(6, 400);
        isSubmitting = false;

        if (!payload) {
          lastProcessedSubmissionKey = null;
          console.warn('[CodeSync] Sync skipped:', skipReason);
          if (window.CodeSyncToast) {
            window.CodeSyncToast.show({
              type: 'error',
              title: 'Capture incomplete',
              message: `${skipReason} Open the AlgoVault popup and press Sync to retry.`,
              duration: 8000
            });
          }
          return;
        }

        const codeSnippet = payload.code ? payload.code.slice(0, 30) : '';
        const submissionKey = payload.submissionId
          ? `${payload.slug}-${payload.language}-${payload.submissionId}`
          : `${payload.slug}-${payload.language}-${codeSnippet}`;

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
      captureValidPayload(2, 500)
        .then(({ payload }) => {
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
