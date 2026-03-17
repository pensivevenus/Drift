import { createSession, endSession } from '../shared/session.js';
import { KEYS } from '../shared/constants.js';

const input = document.getElementById('intentionInput');
const promptLabel = document.getElementById('promptLabel');
const skipLink = document.getElementById('skipLink');
const pillsWrap = document.getElementById('pillsWrap');
const ambient = document.getElementById('ambient');
const ambientDot = document.getElementById('ambientDot');
const ambientIntention = document.getElementById('ambientIntention');
const ambientTimer = document.getElementById('ambientTimer');
const ambientEnd = document.getElementById('ambientEnd');

let timerInterval = null;

// ── on load ──────────────────────────────────────────────
function init() {
  checkExistingSession();
  loadRecentPills();
}

function checkExistingSession() {
  const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION);
  const intention = localStorage.getItem(KEYS.INTENTION);
  const startTime = localStorage.getItem(KEYS.START_TIME);

  if (activeId && intention) {
    // session already running from web app or previous tab
    promptLabel.textContent = 'continuing —';
    input.value = intention;
    input.style.opacity = '0.5';
    input.disabled = true;
    showAmbient(intention, parseInt(startTime));
  }
}

function loadRecentPills() {
  const raw = localStorage.getItem(KEYS.RECENT);
  if (!raw) return;
  const recent = JSON.parse(raw);
  if (!recent.length) return;

  // fade in pills with staggered delay
  setTimeout(() => {
    recent.forEach((text, i) => {
      const pill = document.createElement('button');
      pill.className = 'pill';
      pill.textContent = text;
      pill.style.animationDelay = `${i * 60}ms`;
      pill.addEventListener('click', () => {
        input.value = text;
        input.focus();
      });
      pillsWrap.appendChild(pill);
    });
  }, 300);
}

// ── session start ─────────────────────────────────────────
input.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const intention = input.value.trim();
  if (!intention) return;
  await startSession(intention);
});

skipLink.addEventListener('click', () => {
  startSession('free browsing');
});

async function startSession(intention) {
  const session = await createSession(intention);

  // update UI
  promptLabel.textContent = intention === 'free browsing'
    ? 'browsing freely —'
    : 'focused on —';
  input.value = intention;
  input.disabled = true;
  input.style.opacity = '0.6';
  skipLink.style.display = 'none';
  pillsWrap.style.display = 'none';

  showAmbient(intention, session.startTime);

// wake up service worker then send message
chrome.runtime.sendMessage({ type: 'ping' }, () => {
  // ignore response, just woke it up
  chrome.runtime.lastError; // suppress error
  chrome.runtime.sendMessage({
    type: 'session_start',
    sessionId: session.id,
    intention,
    startTime: session.startTime,
  }, () => {
    chrome.runtime.lastError; // suppress error
  });
});
}

// ── ambient indicator ─────────────────────────────────────
function showAmbient(intention, startTime) {
  ambientIntention.textContent = intention;
  ambient.classList.add('visible');
  startTimer(startTime);
}

function startTimer(startTime) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    ambientTimer.textContent = formatTime(elapsed);
  }, 1000);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// ── end session ───────────────────────────────────────────
ambientEnd.addEventListener('click', async () => {
  const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION);
  if (!activeId) return;

  clearInterval(timerInterval);
  await endSession(activeId);

  // open river map
  const riverUrl = chrome.runtime.getURL(`river/river.html?id=${activeId}`);
  chrome.tabs.update({ url: riverUrl });
});

init();