# ⚡ AlgoVault

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension%20(MV3)-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Version-1.1.0-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI-Gemini%201.5%20Flash%20%7C%20Local-8b5cf6?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Zero--Backend-ffa116?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

<p align="center">

**Your DSA solutions. Automatically organized, analyzed, and synced.**

AlgoVault is an open-source Chrome Extension that automatically captures accepted Data Structures & Algorithms solutions from **LeetCode, GeeksforGeeks, HackerRank, and Codeforces** and syncs them to your GitHub repository.

It also uses AI to analyze your solutions, identify complexity and algorithmic patterns, summarize intuition, and recommend what you should practice next.

</p>

---

## 🌟 Why AlgoVault?

When practicing DSA across multiple platforms, your solutions often end up scattered across different websites.

AlgoVault brings them together into one personal GitHub-based vault.

```text
Solve a problem
      ↓
Submit
      ↓
Accepted ✅
      ↓
AlgoVault detects the submission
      ↓
Captures your solution
      ↓
AI analyzes the solution
      ↓
Syncs it to GitHub
      ↓
Your DSA knowledge base grows 📚
```

No separate database.
No manual copying.
No backend server.

---

## 🚀 Features

### 🌐 Multi-Platform Support

Automatically detects accepted submissions from:

* 🟠 LeetCode
* 🟢 GeeksforGeeks
* 🔵 HackerRank
* ⚫ Codeforces

---

### 🧠 AI-Powered Analysis

For every accepted solution, AlgoVault can generate:

* ⏱️ Time Complexity
* 💾 Space Complexity
* 🧩 Algorithmic Pattern
* 💡 Intuition / Explanation
* 🎯 Recommended Next Problem

The AI engine supports Gemini API analysis with a local heuristic fallback.

---

### ⚡ Automatic GitHub Sync

Solutions are organized directly inside your GitHub repository.

Example:

```text
DSA-Problem-Vault/
│
├── LeetCode/
├── GeeksforGeeks/
├── HackerRank/
├── Codeforces/
│
├── submissions.csv
└── README.md
```

Your repository becomes a personal DSA knowledge base that grows automatically as you solve problems.

---

### 📊 Automatic Progress Dashboard

AlgoVault can automatically update your repository README with:

* Platform statistics
* Solved problem counts
* Progress indicators
* Problem index
* Solution metadata

Your GitHub repository becomes both your **solution archive and progress dashboard**.

---

### 🔄 Smart Deduplication

Submitting the same problem multiple times does not create duplicate entries.

AlgoVault keeps the problem count based on **unique solved problems** while updating the corresponding solution.

---

### 🔒 Zero Backend

AlgoVault does not require a dedicated backend server.

The extension operates through:

```text
Chrome Extension
      ↓
Local browser storage
      ↓
GitHub API
      ↓
Your repository
```

Configuration and credentials used by the extension are stored locally through Chrome's extension storage.

> ⚠️ Never share your GitHub Personal Access Token or Gemini API key with anyone.

---

## 🛠️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Coding Platforms                         │
│                                                             │
│   LeetCode   GFG   HackerRank   Codeforces                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Submit → Accepted
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Content Script Adapters                    │
│                                                             │
│  content_leetcode.js                                        │
│  content_gfg.js                                             │
│  content_hackerrank.js                                      │
│  content_codeforces.js                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ chrome.runtime messaging
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Background Service Worker                      │
│                                                             │
│  • Solution processing                                      │
│  • GitHub API communication                                  │
│  • Repository organization                                  │
│  • Dashboard generation                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid AI Engine                         │
│                                                             │
│       Gemini API                    Local Analyzer           │
│           │                              │                  │
│           └──────────────┬───────────────┘                  │
│                          ▼                                  │
│                 Complexity + Pattern                        │
│                 + Intuition + Next Problem                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ GitHub API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Your GitHub Repository                     │
│                                                             │
│  Solutions + Statistics + README Dashboard                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📥 Installation

### 1. Clone the repository

```bash
git clone https://github.com/shivinders12/AlgoVault.git
cd AlgoVault
```

### 2. Open Chrome Extensions

Navigate to:

```text
chrome://extensions
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the top-right corner.

### 4. Load AlgoVault

Click:

**Load unpacked → Select the AlgoVault directory**

The extension should now appear in your Chrome extensions list.

---

## 🔑 GitHub Configuration

AlgoVault uses the GitHub API to synchronize solutions with your repository.

You'll need:

* GitHub username
* GitHub repository name
* GitHub Personal Access Token

Your token should have the minimum permissions required for the repository you want AlgoVault to modify.

### Configure AlgoVault

Open the extension popup and enter:

```text
GitHub Username
GitHub Repository
GitHub Personal Access Token
Gemini API Key (optional)
```

Then select:

**Save Configuration → Test Connection**

> Never commit your API keys or Personal Access Tokens to this repository.

---

## 🤖 Gemini AI

Gemini integration is optional.

Without a Gemini API key, AlgoVault can use its local heuristic analysis where supported.

With Gemini configured, the extension can generate richer analysis such as:

```text
Time Complexity
Space Complexity
Pattern
Intuition
What You Should Try Next
```

---

## 🧪 Supported Platforms

| Platform      | Solution Capture | GitHub Sync | AI Analysis |
| ------------- | ---------------: | ----------: | ----------: |
| LeetCode      |                ✅ |           ✅ |           ✅ |
| GeeksforGeeks |                ✅ |           ✅ |           ✅ |
| HackerRank    |                ✅ |           ✅ |           ✅ |
| Codeforces    |                ✅ |           ✅ |           ✅ |

---

## 🗺️ Roadmap

### ✅ Current

* [x] Manifest V3 Chrome Extension
* [x] Multi-platform solution detection
* [x] GitHub synchronization
* [x] Solution deduplication
* [x] AI complexity analysis
* [x] Pattern detection
* [x] Next-problem recommendations
* [x] Automatic GitHub dashboard

### 🚧 Next

* [ ] Improve platform adapters
* [ ] Expand local AI heuristics
* [ ] Improve AI analysis accuracy
* [ ] Better error handling
* [ ] More detailed solution analytics
* [ ] Additional coding platforms
* [ ] Community-driven feature development

Have an idea?

[Open a feature request](../../issues/new/choose) or start a Discussion.

---

## 🤝 Contributing

AlgoVault is an open-source project and contributions are welcome.

You can contribute through:

* 💡 Feature ideas
* 🐛 Bug fixes
* 🎨 UI/UX improvements
* 🤖 AI improvements
* 🌐 New platform integrations
* 📚 Documentation
* 🧪 Testing
* ⚡ Performance improvements

Before contributing, please read:

**[CONTRIBUTING.md](./.github/CONTRIBUTING.md)**

For larger features, we recommend opening an Issue or Discussion before starting implementation.

### Looking for something to work on?

Check issues labeled:

`good first issue` · `help wanted` · `enhancement` · `bug`

Your first contribution is welcome. ❤️

---

## 🌍 Build With Us

AlgoVault is part of **BuildWithShivinder**, an open-source community where developers build projects together.

Whether you're here to use AlgoVault, suggest an idea, fix a bug, or build a new feature — you're welcome to contribute.

**Build. Share. Contribute.**

---

## 📄 License

AlgoVault is distributed under the **MIT License**.

See [LICENSE](./LICENSE) for details.

---

## ⭐ Support the Project

If AlgoVault is useful to you:

⭐ Star the repository
🐛 Report bugs
💡 Suggest features
🤝 Contribute code
📢 Share it with other developers

Every contribution helps AlgoVault grow.
