import { IDLE_TIMEOUT } from '../shared/constants.js';
import { endSession } from '../shared/session.js';
import { addEventToSession, getSession, saveSession } from '../shared/db.js';

// ── shared interrupt sender — injects interrupt.js first, then sends ─────────
async function sendInterrupt(payload) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return false;

    const tab = tabs[0];
    const url = tab.url || '';

    // Cannot inject into chrome:// or extension pages
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url === ''
    ) {
      console.log('[Drift] Cannot inject interrupt into:', url);
      return false;
    }

    // Force-inject interrupt.js — if already injected, error is caught and ignored
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/interrupt.js']
      });
    } catch (_) {
      // Already injected — safe to ignore
    }

    // Small delay to let script initialise
    await new Promise(r => setTimeout(r, 120));

    await chrome.tabs.sendMessage(tab.id, payload);
    return true;
  } catch (e) {
    console.log('[Drift] Could not send interrupt:', e.message);
    return false;
  }
}

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
      last_tab_interrupt_time: 0,
      last_site_interrupt_time: 0,
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

  await checkTabDrift();
}

// ── focus event ───────────────────────────────────────────
async function handleFocus(msg) {
  const { active_session_id } = await chrome.storage.local.get('active_session_id');
  if (!active_session_id) return;

  await chrome.storage.local.set({
    last_event_time: Date.now(),
    last_focused_domain: msg.domain,
    last_focus_time: Date.now(),
  });

  await addEventToSession(active_session_id, {
    type: 'focus',
    domain: msg.domain,
    timestamp: msg.timestamp,
    tabId: msg.tabId,
  });

  console.log('focus:', msg.domain);
  // siteCheck alarm disabled — site time alerts are off for now
  // chrome.alarms.create('siteCheck', { periodInMinutes: 1 });
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

// ── tab drift detection (fires on tab open) ───────────────
async function checkTabDrift() {
  const data = await chrome.storage.local.get([
    'active_session_id', 'active_intention', 'tab_open_timestamps',
    'last_tab_interrupt_time', 'drift_settings'
  ]);

  const {
    active_session_id,
    active_intention,
    tab_open_timestamps = [],
    last_tab_interrupt_time = 0,
    drift_settings = {},
  } = data;

  if (!active_session_id) return;

  const cooldownMs = (drift_settings.cooldownMins || 5) * 60000;
  if (Date.now() - last_tab_interrupt_time < cooldownMs) return;

  const threshold = drift_settings.tabsThreshold || 4;
  const windowMs  = (drift_settings.timeWindow || 90) * 1000;
  const recent    = tab_open_timestamps.filter(t => Date.now() - t < windowMs);

  console.log('Tab drift check —', recent.length, 'tabs in window, threshold:', threshold);

  if (recent.length < threshold) return;

  const secondsWindow = Math.round(windowMs / 1000);
  console.log('Tab drift detected —', recent.length, 'tabs in', secondsWindow, 's');

  // Tab drift message — clearly says how many tabs in how many seconds
  const sent = await sendInterrupt({
    type: 'show_interrupt',
    intention: active_intention,
    tabCount: recent.length,
    seconds: secondsWindow,
    reason: 'tabs',
    message: `You've opened ${recent.length} tabs in the last ${secondsWindow} seconds`,
  });

  if (sent) {
    await chrome.storage.local.set({ last_tab_interrupt_time: Date.now() });

    const session = await getSession(active_session_id);
    if (session) {
      session.interrupts = (session.interrupts || 0) + 1;
      await saveSession(session);
    }
  }
}

// ── session end ───────────────────────────────────────────
async function handleEndSession(sessionId) {
  const id = sessionId || (await chrome.storage.local.get('active_session_id')).active_session_id;
  if (!id) return;
  await endSession(id);
  await chrome.storage.local.set({ active_session_id: null });
  console.log('Drift session ended:', id);
}

// ── alarms ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('idleCheck', { periodInMinutes: 2 });
  console.log('Drift installed — idle check alarm set');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {

  // ── idle check ────────────────────────────────────────
  if (alarm.name === 'idleCheck') {
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
  }

  // ── site time check ── DISABLED for now ──────────────────
  if (alarm.name === 'siteCheck') {
    // Site time alerts are disabled — tab drift only
    return;
  }
});