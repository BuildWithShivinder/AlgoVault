# ⚡ AlgoVault — Multi-Platform Competitive Programming Auto-Sync

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension%20(MV3)-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Platforms-LeetCode%20%7C%20GFG%20%7C%20HackerRank%20%7C%20Codeforces-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Zero-Backend-ffa116?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

> A zero-backend Chrome Extension (Manifest V3) that automatically captures accepted Data Structures & Algorithms solutions across **LeetCode**, **GeeksforGeeks**, **HackerRank**, and **Codeforces** — organizing and committing source code, problem descriptions, and a dynamic progress dashboard directly to your personal GitHub repository!

---

## 🌟 Key Features

* 🚀 **Multi-Platform Support**: Automatically detects accepted submissions on **LeetCode**, **GeeksforGeeks**, **HackerRank**, and **Codeforces**.
* 🔒 **100% Private & Local**: Operates strictly inside your browser via Manifest V3 Service Workers. No external servers or third-party tracking. Credentials stay local in `chrome.storage.local`.
* 🎯 **Submit-Only Triggers**: Ignores casual page views or local code runs; only syncs when you explicitly click **Submit** and achieve an **Accepted** verdict.
* 📁 **Deduplicated Repositories**: Multiple submissions of the same problem update the existing solution file while keeping your overall solved count accurate (1 problem = 1 count).
* 📊 **Auto-Generated Dashboard (`README.md`)**: Automatically updates your GitHub repository's main `README.md` with Shields.io badges, visual progress bars, platform distribution charts, and a master problem index table.
* 📄 **Clean Master CSV (`submissions.csv`)**: Appends structured rows (`Platform, Problem ID, Title, Difficulty, Language, URL, Timestamp`) to a central tracking sheet.
* 🎨 **Obsidian Dark Theme Popup**: Displays real-time active problem details, unique problem analytics per platform, connection diagnostic tools, and recent activity logs.

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
               │        Background Service Worker (MV3 Orchestrator)      │
               │  • UTF-8 / Base64 Encoder   • Folder & CSV Formatting     │
               │  • GitHub REST API        • Root README Dashboard Gen   │
               └────────────────────────────┬────────────────────────────┘
                                            │ HTTPS / Bearer PAT
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │              User's Personal GitHub Repository           │
               │  LeetCode/  |  GeeksforGeeks/  |  HackerRank/  |  Codeforces/│
               │  submissions.csv  |  README.md (Multi-Platform Dashboard) │
               └────────────────────────────┴────────────────────────────┘
```

---

## 📥 Installation Guide

Follow these steps to install the extension in **Google Chrome**:

### Step 1: Clone / Download this Repository
```bash
git clone https://github.com/shivinders12/AlgoVault.git
```

### Step 2: Load Unpacked Extension in Chrome
1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. In the top-right corner, turn **ON** the **Developer mode** toggle switch.
3. In the top-left corner, click the **Load unpacked** button.
4. Select the downloaded **`AlgoVault`** directory.
5. Click **Select Folder**. The extension icon will appear in your Chrome toolbar!

---

## 🔑 GitHub Personal Access Token (PAT) Configuration

1. Log in to your [GitHub.com](https://github.com) account.
2. Create a target repository for your solutions (e.g. `DSA-Problem-Vault`).
3. Go to **Settings** ➔ **Developer Settings** ➔ **Personal Access Tokens** ➔ **Fine-grained tokens**.
4. Click **Generate new token**.
5. Set Token Name: `AlgoVault-Token`.
6. Under **Repository Access**, select **Only select repositories** and pick your `DSA-Problem-Vault` repository.
7. Under **Permissions ➔ Repository permissions**, change **Contents** to **Read and write**.
8. Click **Generate token** and copy your PAT string (`github_pat_...`).
9. Click the **AlgoVault** extension icon in Chrome:
   * Paste your **PAT Token**, **GitHub Username**, and **Repository Name** (`DSA-Problem-Vault`).
   * Click **Test Connection**. Once connected, your setup is complete!

---

## 📁 Repository Structure Created on GitHub

When you solve problems across platforms, your target GitHub repository (`DSA-Problem-Vault`) will be organized like this:

```text
DSA-Problem-Vault/
├── Codeforces/
│   ├── 71a-way-too-long-words/
│   │   ├── README.md
│   │   └── solution.cpp
│   └── 1900b-laura-and-operations/
│       ├── README.md
│       └── solution.cpp
├── GeeksforGeeks/
│   └── swap-the-numbers/
│       ├── README.md
│       └── solution.cpp
├── HackerRank/
│   └── arrays-ds/
│       ├── README.md
│       └── solution.cpp
├── LeetCode/
│   ├── 0001-two-sum/
│   │   ├── README.md
│   │   └── solution.cpp
│   └── 0136-single-number/
│       ├── README.md
│       └── solution.cpp
├── submissions.csv
└── README.md
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
