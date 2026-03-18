import { createSession } from '../shared/session.js';
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

function init() {
  checkExistingSession();
  loadRecentPills();
}

function checkExistingSession() {
  const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION);
  const intention = localStorage.getItem(KEYS.INTENTION);
  const startTime = localStorage.getItem(KEYS.START_TIME);

  if (activeId && intention) {
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

  // write bridge keys to localStorage
  localStorage.setItem(KEYS.ACTIVE_SESSION, session.id);
  localStorage.setItem(KEYS.INTENTION, intention);
  localStorage.setItem(KEYS.START_TIME, session.startTime);

  // update recent intentions list
  const raw = localStorage.getItem(KEYS.RECENT);
  const recent = raw ? JSON.parse(raw) : [];
  const updated = [intention, ...recent.filter(r => r !== intention)].slice(0, 5);
  localStorage.setItem(KEYS.RECENT, JSON.stringify(updated));

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

  // wake service worker then notify
  chrome.runtime.sendMessage({ type: 'ping' }, () => {
    chrome.runtime.lastError;
    chrome.runtime.sendMessage({
      type: 'session_start',
      sessionId: session.id,
      intention,
      startTime: session.startTime,
    }, () => { chrome.runtime.lastError; });
  });
}

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

ambientEnd.addEventListener('click', () => {
  const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION);
  if (!activeId) return;
  clearInterval(timerInterval);

  localStorage.removeItem(KEYS.ACTIVE_SESSION);
  localStorage.removeItem(KEYS.INTENTION);
  localStorage.removeItem(KEYS.START_TIME);
  localStorage.setItem(KEYS.SESSION_END, Date.now());

  chrome.runtime.sendMessage({ type: 'end_session', sessionId: activeId }, () => {
    chrome.runtime.lastError;
  });
});

init();