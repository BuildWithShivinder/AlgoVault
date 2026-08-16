/**
 * AlgoVault AI Engine Module
 * Hybrid Engine: Gemini 1.5 Flash API + Zero-Latency Static Heuristic Fallback
 */

const staticRecommendations = {
  'Binary Search': { title: 'Search in Rotated Sorted Array', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/', difficulty: 'Medium', reason: 'Extends binary search to rotated sorted arrays.' },
  'Two Pointers': { title: '3Sum', url: 'https://leetcode.com/problems/3sum/', difficulty: 'Medium', reason: 'Applies two pointers technique to find 3-element sum triplets.' },
  'Sliding Window': { title: 'Longest Substring Without Repeating Characters', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', difficulty: 'Medium', reason: 'Practices dynamic variable-length sliding window logic.' },
  'Dynamic Programming': { title: 'House Robber', url: 'https://leetcode.com/problems/house-robber/', difficulty: 'Medium', reason: 'Strengthens 1D tabulation and state transition skills.' },
  'Graph / Tree Traversal': { title: 'Number of Islands', url: 'https://leetcode.com/problems/number-of-islands/', difficulty: 'Medium', reason: 'Practices grid-based BFS/DFS matrix traversal.' },
  'Arrays & Hashing': { title: 'Group Anagrams', url: 'https://leetcode.com/problems/group-anagrams/', difficulty: 'Medium', reason: 'Master hash map grouping with string keys.' }
};

function staticAnalyzeCode(code, language, title) {
  const c = code || '';
  const l = (language || '').toLowerCase();
  const t = (title || '').toLowerCase();

  let timeComplexity = 'O(N)';
  let spaceComplexity = 'O(1)';
  let pattern = 'Arrays & Hashing';
  let intuition = 'Iterates through input elements to compute result efficiently.';
  let edgeCases = 'Handles standard constraints, empty inputs, and boundary values.';

  // Pattern detection
  if (/binary[\s_]?search|mid\s*=|low\s*<=|left\s*<=/i.test(c) || /binary-search/i.test(t)) {
    pattern = 'Binary Search';
    timeComplexity = 'O(log N)';
    intuition = 'Uses binary search to halve the search space at each iteration.';
  } else if (/two[\s_]?pointer|left\s*<\s*right|while\s*\(\s*l\s*<\s*r/i.test(c) || /two-pointers/i.test(t)) {
    pattern = 'Two Pointers';
    timeComplexity = 'O(N)';
    intuition = 'Uses two pointers moving inward to find matching elements in linear time.';
  } else if (/sliding[\s_]?window|window[\s_]?size|left\s*\+\+/i.test(c) || /sliding-window/i.test(t)) {
    pattern = 'Sliding Window';
    timeComplexity = 'O(N)';
    spaceComplexity = 'O(1)';
    intuition = 'Maintains a dynamic window over contiguous elements to compute rolling statistics.';
  } else if (/dp\[|memo\[|tabulation|recursion|fibonacci|knapsack/i.test(c) || /dynamic-programming/i.test(t)) {
    pattern = 'Dynamic Programming';
    timeComplexity = 'O(N)';
    spaceComplexity = 'O(N)';
    intuition = 'Breaks down problem into overlapping subproblems using memoization/tabulation.';
  } else if (/dfs|bfs|queue<|stack<|grid|graph|tree/i.test(c) || /tree|graph/i.test(t)) {
    pattern = 'Graph / Tree Traversal';
    timeComplexity = 'O(V + E)';
    spaceComplexity = 'O(V)';
    intuition = 'Traverses nodes/vertices recursively or iteratively to visit all connected states.';
  }

  // Sorting detection
  if (/\.sort\(|std::sort|Arrays\.sort|Collections\.sort|qsort/i.test(c)) {
    if (timeComplexity === 'O(N)' || timeComplexity === 'O(1)') {
      timeComplexity = 'O(N log N)';
    }
    intuition += ' Involves initial array sorting.';
  }

  // Nested loop detection
  const loopMatches = c.match(/for\s*\(|while\s*\(/g);
  if (loopMatches && loopMatches.length >= 2 && !/binary/i.test(pattern)) {
    if (timeComplexity === 'O(N)') {
      timeComplexity = 'O(N²)';
      intuition = 'Uses nested iterations over the input dataset.';
    }
  }

  // Space complexity detection
  if (/unordered_map|unordered_set|HashMap|HashSet|vector<vector|new\s+int\[/i.test(c)) {
    if (spaceComplexity === 'O(1)') spaceComplexity = 'O(N)';
  }

  const recommendedNext = staticRecommendations[pattern] || staticRecommendations['Arrays & Hashing'];

  return {
    timeComplexity,
    spaceComplexity,
    pattern,
    intuition,
    edgeCases,
    recommendedNext,
    source: 'Static AI Engine'
  };
}

async function analyzeCodeWithGemini(code, language, title, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return staticAnalyzeCode(code, language, title);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

  const promptText = `
You are an expert Competitive Programming Code Reviewer & DSA Coach.
Analyze the following ${language} solution for problem "${title}".

Source Code:
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Respond ONLY with a valid raw JSON object (no markdown formatting, no code blocks) matching this exact schema:
{
  "timeComplexity": "Big-O Time Complexity (e.g. O(N log N))",
  "spaceComplexity": "Big-O Space Complexity (e.g. O(1))",
  "pattern": "Algorithmic Pattern (e.g. Two Pointers / Binary Search / DP)",
  "intuition": "2-sentence explanation of why this approach works.",
  "edgeCases": "Brief mention of key edge cases handled.",
  "recommendedNext": {
    "title": "Next recommended problem to practice",
    "url": "Direct link to recommended problem (LeetCode/GFG/Codeforces)",
    "difficulty": "Easy / Medium / Hard",
    "reason": "1-sentence reason why this problem builds on the current technique"
  }
}
`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!res.ok) {
      console.warn('[AlgoVault AI] Gemini API returned error, falling back to static engine:', res.status);
      return staticAnalyzeCode(code, language, title);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      const cleanJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        timeComplexity: parsed.timeComplexity || 'O(N)',
        spaceComplexity: parsed.spaceComplexity || 'O(1)',
        pattern: parsed.pattern || 'Arrays & Hashing',
        intuition: parsed.intuition || 'Analyzed via Gemini 1.5 Flash.',
        edgeCases: parsed.edgeCases || 'Standard constraints handled.',
        recommendedNext: parsed.recommendedNext || staticRecommendations['Arrays & Hashing'],
        source: 'Gemini 1.5 Flash AI'
      };
    }
  } catch (err) {
    console.warn('[AlgoVault AI] Gemini API exception, falling back to static engine:', err);
  }

  return staticAnalyzeCode(code, language, title);
}

if (typeof self !== 'undefined') {
  self.analyzeCodeWithGemini = analyzeCodeWithGemini;
  self.staticAnalyzeCode = staticAnalyzeCode;
}
