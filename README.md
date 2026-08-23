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

### Requirements

* A Chromium-based browser with Manifest V3 support: **Chrome**, **Edge**, **Brave**, or Arc.
* A GitHub account.
* No Node.js or build step required — AlgoVault is plain HTML/JS that you load directly as a folder.

### 1. Clone the repository

```bash
git clone https://github.com/BuildWithShivinder/AlgoVault.git
cd AlgoVault
```

### 2. Open Chrome Extensions

Open a new tab and navigate to:

```text
chrome://extensions
```

### 3. Enable Developer Mode

Turn on the **Developer mode** toggle in the top-right corner of the page.

### 4. Load AlgoVault

1. Click **Load unpacked** (top-left).
2. Select the cloned `AlgoVault` directory.
3. The extension should now appear in your extensions list.
4. Optional: click the puzzle-piece icon in the toolbar and **pin** AlgoVault for quick access.

> **Troubleshooting:** If the extension doesn't appear after loading, refresh `chrome://extensions` and check that you selected the folder containing `manifest.json` (the root `AlgoVault` folder, not a parent directory). If accepted submissions aren't being captured, make sure you are logged in to the coding platform and try reloading the tab once.

---

## 🔑 GitHub Configuration

AlgoVault uses the GitHub API to synchronize solutions with your repository.

You'll need:

* GitHub username
* GitHub repository name
* GitHub Personal Access Token

Your vault repository can be **public or private** — AlgoVault works with both. The token only needs one permission: **read and write access to repository contents** for that single repository.

### Creating a Personal Access Token

AlgoVault needs a Personal Access Token (PAT) so it can save solutions to your repository on your behalf. You'll create this token once on github.com — it takes about two minutes.

#### Option A — Fine-grained token (Recommended — more secure)

1. **Log in to GitHub** and click your **profile picture** in the top-right corner.
2. Click **Settings** in the dropdown menu.
3. In the left sidebar, scroll all the way down and click **Developer settings** (it's the last item).
4. Click **Personal access tokens → Fine-grained tokens**, then click **Generate new token**.
5. Fill in the form:
   * **Token name:** something like `AlgoVault` so you remember what it's for.
   * **Expiration:** pick how long it should last (e.g., 90 days). When it expires, you'll need to generate a new one.
   * **Resource owner:** select yourself (your username).
6. Under **Repository access**, choose **Only select repositories**, then pick the repository AlgoVault will sync to (e.g., `DSA-Problem-Vault`). This limits the token to just that one repo.
7. Expand **Permissions → Repository permissions**, find **Contents**, and set it to **Read and write**.
   * This grants read and write access to all files in that repository, including private repositories.
   * That's the only permission you need to change. GitHub automatically adds **Metadata: Read-only** — leave it as is.
8. Click **Generate token** at the bottom.
9. **Copy the token immediately** and paste it into AlgoVault's popup under *GitHub Personal Access Token*. GitHub shows it only this once — if you lose it, you must generate a new one.

#### Option B — Classic token

Follow steps 1–3 above, then:

1. Click **Personal access tokens → Tokens (classic)** → **Generate new token (classic)**.
2. Give it a note (e.g., `AlgoVault`) and set an expiration.
3. Under **Select scopes**, tick **`repo`** (full control of private repositories). Leave every other box unchecked.
   * Note: classic tokens cover **all** of your repositories and cannot be limited to a single repo — another reason Option A is safer.
4. Click **Generate token**, copy it right away, and paste it into the extension.

#### Keeping your token safe

* Never share your token or commit it to any repository — treat it like a password.
* If you ever suspect it leaked, revoke it under **Developer settings → Personal access tokens** and generate a new one.

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
