import { IDLE_TIMEOUT } from '../shared/constants.js';
import { endSession } from '../shared/session.js';
import { addEventToSession, getSession, saveSession } from '../shared/db.js';

// ── receive all messages ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ status: 'awake' });
    return true;
  }

  if (msg.type === 'session_start') {
    chrome.storage.local.set({
      active_session_id: msg.sessionId,
      active_intention: msg.intention,
      start_time: msg.startTime,
      tab_open_timestamps: [],
      last_interrupt_time: 0,
      last_focused_domain: null,
      last_focus_time: null,
      last_event_time: Date.now(),
    }).then(() => {
      console.log('Drift session started:', msg.intention);
    });
    sendResponse({ status: 'ok' });
    return true;
  }

  if (msg.type === 'end_session') {
    const sessionId = msg.sessionId;
    handleEndSession(sessionId).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.update(tabs[0].id, {
            url: chrome.runtime.getURL(`river/river.html?id=${sessionId}`)
          });
        }
      });
    });
    sendResponse({ status: 'ok' });
    return true;
  }

  if (msg.type === 'tab_open') {
    handleTabOpen(msg);
    return true;
  }

  if (msg.type === 'focus') {
    handleFocus(msg);
    return true;
  }

  if (msg.type === 'blur') {
    handleBlur(msg);
    return true;
  }

  if (msg.type === 'interrupt_dismissed') {
    console.log('Interrupt dismissed:', msg.action);
    return true;
  }

  return true;
});

// ── tab open ──────────────────────────────────────────────
async function handleTabOpen(msg) {
  const { active_session_id } = await chrome.storage.local.get('active_session_id');
  if (!active_session_id) return;

  await chrome.storage.local.set({ last_event_time: Date.now() });

  const { tab_open_timestamps = [] } = await chrome.storage.local.get('tab_open_timestamps');
  const updated = [...tab_open_timestamps, Date.now()].slice(-10);
  await chrome.storage.local.set({ tab_open_timestamps: updated });

  await addEventToSession(active_session_id, {
    type: 'open',
    domain: msg.domain,
    timestamp: msg.timestamp,
    tabId: msg.tabId,
  });

  await checkDrift();
}

// ── focus event ───────────────────────────────────────────
async function handleFocus(msg) {
  const { active_session_id } = await chrome.storage.local.get('active_session_id');
  if (!active_session_id) return;

  await chrome.storage.local.set({
    last_event_time: Date.now(),
    last_focused_domain: msg.domain,
    last_focus_time: msg.timestamp,
  });

  await addEventToSession(active_session_id, {
    type: 'focus',
    domain: msg.domain,
    timestamp: msg.timestamp,
    tabId: msg.tabId,
  });

  console.log('focus:', msg.domain);
}

// ── blur event ────────────────────────────────────────────
async function handleBlur(msg) {
  const { active_session_id } = await chrome.storage.local.get('active_session_id');
  if (!active_session_id) return;

  await chrome.storage.local.set({ last_event_time: Date.now() });

  await addEventToSession(active_session_id, {
    type: 'blur',
    domain: msg.domain,
    timestamp: msg.timestamp,
    tabId: msg.tabId,
  });

  console.log('blur:', msg.domain);
}

// ── drift detection ───────────────────────────────────────
async function checkDrift() {
  const data = await chrome.storage.local.get([
    'active_session_id', 'active_intention', 'tab_open_timestamps',
    'last_interrupt_time', 'last_focused_domain', 'last_focus_time'
  ]);

  const {
    active_session_id,
    active_intention,
    tab_open_timestamps = [],
    last_interrupt_time = 0,
    last_focused_domain,
    last_focus_time,
  } = data;

  if (!active_session_id) return;
  if (Date.now() - last_interrupt_time < 300000) return;

  const tabDrift = detectTabDrift(tab_open_timestamps);
  const domainDrift = detectDomainDrift(last_focused_domain, active_intention, last_focus_time);

  if (!tabDrift && !domainDrift) return;

  const recentOpens = tab_open_timestamps.filter(t => Date.now() - t < 90000).length;
  const secondsWindow = tab_open_timestamps.length > 0
    ? Math.round((Date.now() - tab_open_timestamps[0]) / 1000)
    : 0;

  console.log('Drift detected — tabs:', tabDrift, 'domain:', domainDrift);

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'show_interrupt',
      intention: active_intention,
      tabCount: recentOpens,
      seconds: secondsWindow,
      reason: tabDrift ? 'tabs' : 'domain',
    });

    await chrome.storage.local.set({ last_interrupt_time: Date.now() });

    const session = await getSession(active_session_id);
    if (session) {
      session.interrupts = (session.interrupts || 0) + 1;
      await saveSession(session);
    }
  } catch (e) {
    console.log('Could not send interrupt:', e.message);
  }
}

function detectTabDrift(timestamps) {
  const recent = timestamps.filter(t => Date.now() - t < 90000);
  return recent.length >= 4;
}

function detectDomainDrift(domain, intention, focusStart) {
  if (!domain || !intention || !focusStart) return false;
  if (Date.now() - focusStart < 600000) return false;
  const words = intention.toLowerCase().split(/\s+/);
  const domainLower = domain.toLowerCase();
  return !words.some(word => word.length > 2 && domainLower.includes(word));
}

// ── session end ───────────────────────────────────────────
async function handleEndSession(sessionId) {
  const id = sessionId || (await chrome.storage.local.get('active_session_id')).active_session_id;
  if (!id) return;
  await endSession(id);
  await chrome.storage.local.set({ active_session_id: null });
  console.log('Drift session ended:', id);
}

// ── idle detection ────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('idleCheck', { periodInMinutes: 2 });
  console.log('Drift installed — idle check alarm set');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'idleCheck') return;

  const { last_event_time, active_session_id } =
    await chrome.storage.local.get(['last_event_time', 'active_session_id']);

  if (!active_session_id || !last_event_time) return;

  if (Date.now() - last_event_time > IDLE_TIMEOUT) {
    console.log('Drift: idle timeout — ending session');
    const sessionId = active_session_id;
    await handleEndSession(sessionId);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, {
        url: chrome.runtime.getURL(`river/river.html?id=${sessionId}`)
      });
    }
  }
});