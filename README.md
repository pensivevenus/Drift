# Drift

> Set your intention. Watch your focus. See the truth.

Drift is a three-part, fully local focus system that closes the loop between what you meant to do and what you actually did. A **todo + pomodoro web app**, a **browser extension** that watches your attention, and a **river map** that shows you your session honestly — no account, no server, no data leaving your device.

![Drift river map — a beautiful visualisation of one focus session](assets/river-demo.svg)

---

## The Problem

You open a tab to work on something. Forty minutes later you're somewhere else entirely, with no memory of how you got there.

Existing tools either block everything (too aggressive) or show guilt-inducing totals like "3 hours on YouTube" long after it's too late to act. Neither addresses the actual moment distraction begins. Drift does.

---

## What Drift Does

**1. You set an intention.**
Open the web app, pick a task from your todo list, and start a session. Or open a new tab directly and type what you're here to do. Either way, Drift knows your goal.

**2. Drift watches silently.**
The browser extension tracks which tabs you focus on and for how long, using the Page Visibility API — no polling, no performance cost. Everything is processed locally.

**3. If you drift, Drift notices.**
Open too many tabs too quickly, or spend significant time somewhere unrelated to your intention? A gentle, non-blocking overlay appears: *"You meant to write your essay. You've opened 5 tabs in 30 seconds."* Not an alarm. Not a block. Just a quiet mirror. Keep going or refocus — both are valid.

**4. At the end, you see the river.**
A full-canvas visualisation of your attention over time. Each domain is a coloured stream. Time flows left to right. The river shows you exactly what your last session looked like. Export it as a PNG or SVG.

---

## Three Ways to Use Drift

Drift is designed to work however you want — you're never forced into one mode.

| Mode | How it works |
|---|---|
| **Extension only** | Open a new tab, type your intention, Drift tracks the session. Simple. |
| **Web app + Extension** | Pick a task in the web app — Drift carries your intention into every new tab automatically via shared localStorage. Session runs until idle or manual end. |
| **Full flow** | Pick a task, run a pomodoro, Drift tracks your attention during the timer, river map generates when the pomodoro ends. |

---

## Features

### Web App (`app.html`)

**Todo list**
- Add tasks with the Enter key
- Click to mark complete — animated strikethrough
- Delete with the × button
- Completed tasks move to the bottom, never disappear
- Click any incomplete task to make it your current focus — automatically bridges to the extension

**Pomodoro timer**
- Default 25-minute work / 5-minute break rhythm
- Fully custom durations — set work time (5–60 min) and break time (1–30 min)
- Smooth SVG circular progress ring
- Start, pause, and reset controls
- Break timer starts automatically after a work block ends
- Satisfying completion animation and a soft chime via Web Audio API when a session ends
- "View your river map →" link appears after each completed work block

**Session stats**
- Pomodoros completed today
- Total focus minutes today
- Current daily streak
- Tasks completed today
- All stats computed locally — resets at midnight

### Browser Extension (`extension/`)

**Intention prompt (new tab override)**
- Replaces the browser new tab page with a calm, minimal intention input
- If a session is already running from the web app, automatically picks it up and shows your current task
- Recent intentions available as one-click pills
- Skip option (Esc) for free browsing sessions — never forces the user

**Attention tracking**
- Page Visibility API — fires on every tab focus and blur, zero polling
- BroadcastChannel API — all tabs communicate in real time
- Logs domain names only, never full URLs
- Ambient indicator in the corner of every new tab: your intention + session timer + a pulse dot

**Drift detection + gentle interrupt**
- Triggers when: 4+ new tabs opened within 90 seconds, OR 10+ minutes on a domain unrelated to your intention
- Soft overlay — never a full block, never covers the whole page
- Shows your intention and exactly what triggered the check
- Two options: "keep going" or "refocus" — no streaks broken, no judgment
- 5-minute cooldown after dismissal so it never nags

**River map visualisation**
- Full-canvas stream graph — time on the X axis, domains as coloured bands
- Width of each band = time spent on that domain
- Intention label pinned to the left as a reference point
- Export as PNG or SVG
- Colour system: same domain always gets the same colour across all sessions

**Session history**
- Browse all past sessions (kept for 30 days)
- Click any session to re-render its river map
- See patterns across days

**Settings**
- Adjust drift detection sensitivity (tab threshold + time window)
- Theme: dark, light, or auto
- Data export and full data deletion

---

## How the Web App and Extension Connect

There is no server. The bridge is `localStorage`.

When you start a pomodoro or click a task in the web app, it writes three keys:

```
drift_active_session  →  session id
drift_intention       →  your task name
drift_start_time      →  timestamp
```

When you open a new tab, the extension reads those same keys and picks up the session automatically. When the pomodoro ends, the web app ends the session and passes the session id to `river.html` to render the map.

The web app and extension talk to each other entirely client-side. No sync, no account, no server.

---

## Tech Stack

Everything is browser-native. No frameworks, no build tools, no external services.

| Layer | Technology | Purpose |
|---|---|---|
| Extension | Manifest V3 | New tab override, content scripts |
| Cross-tab comms | BroadcastChannel API | Real-time tab event passing |
| Attention tracking | Page Visibility API | Focus/blur detection, zero polling |
| Visualisation | Canvas API | River map stream graph |
| Storage | localStorage + IndexedDB | Live session state + persistent history |
| Audio | Web Audio API | Completion chime, no audio files |
| Export | Canvas.toBlob() + SVG draw pass | PNG and SVG export |
| Hosting | GitHub Pages | Landing page + web app, zero cost |
| Styling | Vanilla CSS | No framework needed |

---

## Project Structure

```
drift-project/
│
├── index.html              # Landing page (GitHub Pages)
├── app.html                # Web app — todo + pomodoro
├── app.js                  # Todo logic + pomodoro + localStorage bridge
├── app.css
├── landing.css
│
├── assets/
│   ├── river-demo.svg      # Pre-generated river map for landing page
│   └── demo.gif            # 90-second demo recording
│
└── extension/
    ├── manifest.json
    │
    ├── newtab/
    │   ├── newtab.html     # Intention prompt — new tab override
    │   ├── newtab.css
    │   └── newtab.js       # Session start, localStorage bridge read
    │
    ├── content/
    │   ├── tracker.js      # Injected into all tabs — Page Visibility listener
    │   ├── interrupt.js    # Injects drift overlay into active tab
    │   └── interrupt.css
    │
    ├── background/
    │   └── service-worker.js  # Drift detection, session orchestration
    │
    ├── river/
    │   ├── river.html      # River map page
    │   ├── river.css
    │   ├── river.js        # Entry point — loads session, calls renderer
    │   ├── streamgraph.js  # Canvas stream graph algorithm
    │   └── export.js       # PNG + SVG export
    │
    ├── history/
    │   ├── history.html
    │   └── history.js
    │
    ├── settings/
    │   ├── settings.html
    │   └── settings.js
    │
    └── shared/
        ├── db.js           # IndexedDB helpers
        ├── session.js      # Session create/end/query + localStorage key constants
        ├── colors.js       # Domain → colour mapping
        └── constants.js    # Drift thresholds, idle timeout, defaults
```

---

## Getting Started

### Web App

No installation needed. Visit the live site:

**[https://your-username.github.io/drift-project](https://your-username.github.io/drift-project)**

Or clone and open `app.html` locally — it works entirely offline.

```bash
git clone https://github.com/your-username/drift-project
cd drift-project
open app.html   # or just drag into your browser
```

### Browser Extension

The extension is not on the Chrome Web Store — it's open source and loaded directly.

1. Clone the repository (or download the ZIP)
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `extension/` folder from this repo
6. Open a new tab — Drift is running

Tested on Chrome, Edge, and Brave. Firefox support coming soon.

---

## Privacy

Drift was designed from the ground up to be private by default.

- **No account required.** Ever.
- **No server.** The web app and extension communicate through `localStorage` — your own browser's memory.
- **No URLs stored.** Drift only records domain names (e.g. `youtube.com`), never the full URL of any page you visit.
- **No data leaves your device.** Session history lives in IndexedDB on your machine. Export it or delete it any time from the Settings page.
- **No analytics, no telemetry, no tracking of any kind.**

---

## Why Open Source

Most tools built around focus and attention are SaaS products that collect your usage data to improve their own models. Drift takes the opposite position: your attention data is yours, it should stay on your device, and the code that handles it should be fully transparent and auditable.

Drift is free. Drift is open source. That's not a temporary state — it's the point.

---

## Contributing

Contributions are welcome. If you find a bug, have a feature idea, or want to improve the river map algorithm — open an issue or submit a pull request.

```bash
git clone https://github.com/your-username/drift-project
cd drift-project
# No build step — open files directly in browser
# For the extension: load extension/ as unpacked in chrome://extensions
```

Please open an issue before starting work on a significant change so we can discuss the approach first.

---

## Roadmap

- [ ] Firefox extension support (Manifest V2 fallback)
- [ ] Weekly summary view — river maps across 7 days
- [ ] Shareable river map links (optional, user-initiated)
- [ ] Keyboard shortcuts for common actions
- [ ] Import/export full session history as JSON

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this project. If you distribute a modified version, you must include a copy of the Apache 2.0 license and state the changes you made. See the full license for details.

---

## Acknowledgements

Built during FOSS Hack 2026. Uses only browser-native APIs — no external libraries, no dependencies, no build tools. Just the web platform doing what it was built to do. Licensed under Apache 2.0.

---

*Drift doesn't try to fix you. It just shows you what you did, so you can decide if that's what you want.*
