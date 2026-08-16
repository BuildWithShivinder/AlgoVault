# ⚡ AlgoVault v1.1 — AI-Powered Multi-Platform DSA Sync

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension%20(MV3)-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Version-1.1.0-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI-Gemini%201.5%20Flash%20%7C%20Local-8b5cf6?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Zero-Backend-ffa116?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

> An AI-powered, zero-backend Chrome Extension (Manifest V3) that automatically captures accepted Data Structures & Algorithms solutions across **LeetCode**, **GeeksforGeeks**, **HackerRank**, and **Codeforces** — organizing source code, generating AI Big-O complexity analysis, recommending next-level practice problems, and committing a dynamic dashboard directly to your GitHub repository!

---

## 🌟 Key Features in v1.1

* 🚀 **Multi-Platform Support**: Auto-detects accepted submissions on **LeetCode**, **GeeksforGeeks**, **HackerRank**, and **Codeforces**.
* 🧠 **AI Complexity Analysis**: Automatically calculates **Time Complexity**, **Space Complexity**, **Algorithmic Patterns**, and **Intuition Summaries** for every accepted solution.
* 🎯 **"What You Should Try Next" AI Recommendations**: Suggests the ideal next practice problem based on the solved question's pattern and difficulty.
* ⚡ **Hybrid AI Engine**: Gemini 1.5 Flash API support with a zero-latency local static heuristic analyzer fallback.
* 🔒 **100% Private & Local**: Operates strictly inside your browser via Manifest V3 Service Workers. Credentials stay local in `chrome.storage.local`.
* 🎯 **Submit-Only Triggers**: Ignores casual page views or local code runs; only syncs when you explicitly click **Submit** and achieve an **Accepted** verdict.
* 📁 **Deduplicated Repositories**: Multiple submissions of the same problem update the existing solution file while keeping your overall solved count accurate (1 problem = 1 count).
* 📊 **Auto-Generated Dashboard (`README.md`)**: Automatically updates your GitHub repository's main `README.md` with Shields.io badges, visual progress bars, and a master problem index table.
* 🎨 **Obsidian Dark Theme Popup**: Displays real-time active problem details, unique problem analytics, connection diagnostic tools, and an interactive **AI Assist** tab.

---

## 🛠️ System Architecture

```text
               ┌─────────────────────────────────────────────────────────┐
               │              Coding Platforms (In-Browser)               │
               │  [LeetCode]   [GeeksforGeeks]   [HackerRank]   [Codeforces] │
               └────────────────────────────┬────────────────────────────┘
                                            │ DOM MutationObservers (Submit Trigger)
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │            Content Script Platform Adapters             │
               │  • content_leetcode.js     • content_gfg.js              │
               │  • content_hackerrank.js   • content_codeforces.js       │
               └────────────────────────────┬────────────────────────────┘
                                            │ chrome.runtime messaging
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │        Background Service Worker & Hybrid AI Engine      │
               │  • ai_engine.js (Gemini 1.5 Flash + Local Fallback)     │
               │  • Big-O Analysis & "Try Next" Recommendation Engine   │
               │  • UTF-8 / Base64 Encoder   • Root README Dashboard Gen   │
               └────────────────────────────┬────────────────────────────┘
                                            │ HTTPS / Bearer PAT
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │              User's Personal GitHub Repository           │
               │  LeetCode/  |  GeeksforGeeks/  |  HackerRank/  |  Codeforces/│
               │  submissions.csv  |  README.md (Multi-Platform Dashboard) │
               └────────────────└────────────────────────────────────────┘
```

---

## 📥 Installation Guide

Follow these steps to install **AlgoVault v1.1** in **Google Chrome**:

### Step 1: Clone / Download this Repository
```bash
git clone https://github.com/shivinders12/AlgoVault.git
```

### Step 2: Load Unpacked Extension in Chrome
1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. Turn **ON** **Developer mode** (top-right toggle).
3. Click **Load unpacked** (top-left button).
4. Select the downloaded **`AlgoVault`** directory.
5. Click **Select Folder**. The extension icon will appear in your toolbar!

---

## 🔑 GitHub Personal Access Token (PAT) & Gemini API Setup

1. Go to your [GitHub Settings](https://github.com/settings/tokens?type=beta) ➔ **Fine-grained tokens** ➔ **Generate new token**.
2. Set Token Name: `AlgoVault-Token`.
3. Under **Repository Access**, select your `DSA-Problem-Vault` repository.
4. Under **Permissions ➔ Repository permissions**, set **Contents** to **Read and write**.
5. Click **Generate token** and copy your PAT string.
6. Open the **AlgoVault** extension popup:
   * Paste your **PAT Token**, **GitHub Username**, **Repository Name**, and optional **Gemini API Key**.
   * Click **Save Configuration** ➔ **Test Connection**.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
