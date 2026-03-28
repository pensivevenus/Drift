<div align="center">

<img src="https://raw.githubusercontent.com/pensivevenus/Drift/main/assets/icon128.png" alt="Drift" width="80" height="80" />

# DRIFT

### *Set your intention. Watch your focus. See the truth.*

[![License](https://img.shields.io/badge/license-Apache%202.0-6366f1?style=flat-square)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/live-GitHub%20Pages-6366f1?style=flat-square)](https://pensivevenus.github.io/Drift/)
[![No Backend](https://img.shields.io/badge/backend-none-success?style=flat-square)](#)
[![No Account](https://img.shields.io/badge/account-never%20required-success?style=flat-square)](#)
[![FOSS Hack 2026](https://img.shields.io/badge/FOSS%20Hack-2026-6366f1?style=flat-square)](#)

<br/>

**[🌊 Open Web App](https://pensivevenus.github.io/Drift/app.html) · [🏠 Landing Page](https://pensivevenus.github.io/Drift/) · [🏢 For Teams](https://pensivevenus.github.io/Drift/enterprise.html)**

<br/>

> Drift closes the loop between what you meant to do and what you actually did —  
> with a focus timer, smart todo system, and attention tracking that never leaves your browser.

<br/>

---

</div>

## What is Drift?

Most productivity tools either **block everything aggressively**, or show you guilt-inducing totals like *"3 hours on YouTube"* long after it's too late to act. Neither addresses the actual moment distraction begins.

**Drift does something different.**

It watches where your attention actually goes — silently, locally, privately — and when your session ends, renders a beautiful **river map**: a visual timeline of your focus, one coloured stream per domain, flowing left to right. No account. No server. No data leaving your browser. Just you, your intention, and an honest record of the session.

```
Open a new tab  →  Set your intention  →  Work naturally
     ↓
Drift detects when you drift  →  Gentle overlay appears
     ↓
Session ends  →  River map renders  →  See the truth
```

---

## Three Parts. One System. Fully Local.

| Part | Description | Link |
|------|-------------|------|
| 🌊 **Web App** | Pomodoro timer · Todo list · Lo-fi soundscape · GIF backgrounds | [app.html](https://pensivevenus.github.io/Drift/app.html) |
| 🧩 **Browser Extension** | New tab override · Attention tracking · Drift detection · River map | `extension/` folder |
| 🏠 **Landing Page** | Full project overview · Setup guide · Privacy details | [index.html](https://pensivevenus.github.io/Drift/) |

---

## Features

### 🧩 Browser Extension

<details>
<summary><strong>New Tab Override</strong></summary>

- Replaces Chrome's new tab with a calm intention prompt
- If a web app session is active, picks it up automatically — shows *"Continuing: your task"*
- Recent intentions as quick-pick pills (last 5)
- Skip option for free browsing sessions
- Ambient session indicator with ticking timer and pulse dot

</details>

<details>
<summary><strong>Attention Tracking</strong></summary>

- Page Visibility API fires on every tab focus and blur
- Records **domain names only** — never full URLs, never page content, never keystrokes
- `chrome.runtime.sendMessage` routes all events to service worker reliably
- Complete event log built in IndexedDB throughout the session

</details>

<details>
<summary><strong>Drift Detection</strong></summary>

- **Tab drift** — 4+ new tabs opened within 90 seconds
- **Domain drift** — 10+ minutes on a domain with no keyword match to your intention
- Gentle non-blocking overlay injected into the active tab
- Two response options: *Keep Going* or *Refocus*
- 5-minute cooldown after dismissal — never nags

</details>

<details>
<summary><strong>River Map</strong></summary>

- Canvas stream graph rendered at session end
- X axis = time · Each domain = coloured horizontal band
- Same domain always gets same colour via deterministic hash function
- Export as **PNG** or **SVG**
- Session history stored in IndexedDB for 30 days

</details>

---

### ⏱ Web App (app.html)

<details>
<summary><strong>Pomodoro Timer</strong></summary>

- 25/5 work-break rhythm with animated SVG ring
- Custom durations: 1–120 min work · 1–60 min breaks
- Work / Short Break / Long Break modes
- Web Audio API chime on completion — no audio files
- Session stats: pomodoros today · minutes focused · day streak
- Intention field bridged to extension via localStorage

</details>

<details>
<summary><strong>Smart Todo List</strong></summary>

- Add, edit, delete tasks with animated transitions
- Mark complete with checkbox strikethrough animation
- Categories: Work · School · Personal
- Priority levels: High · Medium · Low (colour coded)
- Due dates with overdue highlighting
- Subtasks per task · Drag-and-drop reorder · Pin and Star
- Undo delete (5-second window)
- Export as `.txt` · Import from `.txt` or `.json`

</details>

<details>
<summary><strong>Lo-fi Soundscape</strong></summary>

- 6 ambient sounds: Rain · Forest · Ocean · Lo-fi Beats · White Noise · Cafe
- **All generated via Web Audio API — zero external audio files**
- Volume slider · Off toggle

</details>

<details>
<summary><strong>Backgrounds & Stats</strong></summary>

- 20 animated lofi/pixel art GIF backgrounds
- Press `Space` to cycle to a random background
- Day streak counter · Tasks done today · All computed locally

</details>

---

## How the Bridge Works

The web app and extension communicate **entirely through localStorage** — no server, no sync service, no WebSockets. Just the browser talking to itself.

```javascript
// When you start a Pomodoro in app.html:
localStorage.setItem('drift_active_session', crypto.randomUUID())
localStorage.setItem('drift_intention',      'write my essay')
localStorage.setItem('drift_start_time',     Date.now())

// When a new tab opens, the extension reads:
const session   = localStorage.getItem('drift_active_session')
const intention = localStorage.getItem('drift_intention')
// → shows "Continuing: write my essay"

// When the Pomodoro ends:
localStorage.setItem('drift_session_end', Date.now())
// → extension triggers river map
```

---

## Tech Stack

Everything is **browser-native**. No frameworks, no libraries, no build tools, no external services.

| Layer | Technology |
|-------|-----------|
| Extension | Manifest V3 · `chrome.runtime.sendMessage` · `chrome.storage.local` · `chrome.alarms` |
| Attention tracking | Page Visibility API |
| Cross-context messaging | `chrome.runtime.sendMessage` (content script → service worker) |
| Storage | IndexedDB (session history) · localStorage (bridge keys) · `chrome.storage.local` (service worker state) |
| Visualisation | Canvas API (river map stream graph) |
| Audio | Web Audio API (zero audio files) |
| Hosting | GitHub Pages (free · auto-deploy on push) |

---

## Privacy

| What Drift stores | What Drift never stores |
|-------------------|------------------------|
| ✅ Domain names (e.g. `youtube.com`) | ❌ Full URLs |
| ✅ Session timestamps | ❌ Page content |
| ✅ Your intention text | ❌ Keystrokes |
| ✅ Todo tasks | ❌ Personal data |
| ✅ Pomodoro stats | ❌ Analytics or telemetry |

**All data lives in IndexedDB and localStorage on your device. No account required. Ever.**  
One button in Settings wipes everything instantly.

---

## Install the Extension

```bash
# 1. Clone the repo
git clone https://github.com/pensivevenus/Drift.git

# 2. Open Chrome and go to
chrome://extensions

# 3. Enable Developer Mode (top right toggle)

# 4. Click "Load unpacked" and select the extension/ folder

# 5. Open a new tab — Drift replaces it with the intention prompt
```

Works on **Chrome · Edge · Brave** (all Chromium-based browsers).

---

## Repository Structure

```
drift/
├── index.html                    ← Landing page
├── app.html                      ← Web app (Pomodoro + Tasks + Sounds)
├── enterprise.html               ← For Teams page
├── assets/
│   └── backgrounds/              ← 20 animated GIF backgrounds
└── extension/
    ├── manifest.json             ← MV3 config
    ├── newtab/
    │   ├── newtab.html           ← Intention prompt
    │   ├── newtab.css
    │   └── newtab.js             ← Session start · bridge · ambient indicator
    ├── content/
    │   ├── tracker.js            ← Injected into every tab — focus/blur events
    │   ├── interrupt.js          ← Drift overlay injection
    │   └── interrupt.css
    ├── background/
    │   └── service-worker.js     ← Session orchestration · drift detection · alarms
    ├── river/
    │   ├── river.html            ← River map page
    │   ├── river.css
    │   ├── river.js              ← Entry point
    │   ├── streamgraph.js        ← Canvas drawing algorithm
    │   └── export.js             ← PNG + SVG export
    ├── history/
    │   ├── history.html          ← Session browser
    │   └── history.js
    ├── settings/
    │   ├── settings.html         ← Sensitivity sliders · data deletion
    │   └── settings.js
    └── shared/
        ├── db.js                 ← IndexedDB wrapper
        ├── session.js            ← createSession · endSession · addEvent
        ├── constants.js          ← Thresholds and key names
        ├── colors.js             ← Domain → colour hash mapping
        └── onboarding.js         ← First-run onboarding overlay
```

---

## Data Model

```javascript
// IndexedDB — drift_db — object store: sessions
Session {
  id:        string   // UUID
  intention: string   // "write my essay"
  startTime: number   // timestamp
  endTime:   number   // timestamp
  events:    Event[]  // full attention timeline
  interrupts: number  // how many times drift was detected
}

Event {
  type:      "open" | "focus" | "blur"
  domain:    string   // "youtube.com" — never full URL
  timestamp: number
  tabId:     string   // internal tracking ID
}
```

---

## Known Bugs Fixed

During development we encountered and resolved 13 documented problems. Highlights:

| # | Problem | Root Cause | Fix |
|---|---------|------------|-----|
| 4 | BroadcastChannel not received by service worker | MV3 service workers sleep between events | Replaced with `chrome.runtime.sendMessage` |
| 7 | `Could not establish connection` on session start | Service worker asleep when message fired | Added ping-first wake pattern |
| 10 | Interrupt not firing — tab ID mismatch | Stored internal UUID instead of Chrome's integer tab ID | Capture `sender.tab.id` in `onMessage` listener |
| 11 | Drag-drop drop does nothing | Used filtered array indices instead of task ID lookup | Pass task ID via `dataTransfer`, resolve by ID in master array |

Full problem log in [drift_documentation.pdf](./drift_documentation.pdf).

---

## Roadmap

- [ ] **PWA** — offline support + install to desktop
- [ ] **Real ambient audio** — replace Web Audio synthesis with recordings
- [ ] **Slack integration** — auto-set status during focus sessions
- [ ] **Calendar triggers** — auto-start session from Google Calendar focus blocks
- [ ] **Firefox port** — WebExtensions API compatibility
- [ ] **Opt-in team dashboard** — aggregate river maps, fully opt-in, no surveillance
- [ ] **GitHub commit linking** — match focus sessions to code output

---

## Philosophy

- **No account required** — ever
- **No server, no backend, no external APIs** — zero
- **All data stays on your device** — always
- **Domain names only** — no full URLs, no page content, no keystrokes
- **Fully open source** — Apache 2.0, fork it, own it, extend it

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

You can use this commercially, modify it, distribute it. The only requirements are preserving copyright notices and the Apache 2.0 license text.

---

<div align="center">

**Built with intention at FOSS Hack 2026**

[🌊 Open Web App](https://pensivevenus.github.io/Drift/app.html) · [🏠 Landing Page](https://pensivevenus.github.io/Drift/) · [🏢 For Teams](https://pensivevenus.github.io/Drift/enterprise.html) · [⭐ Star on GitHub](https://github.com/pensivevenus/Drift)

*No backend. No tracking. No account. Apache 2.0.*

</div>
