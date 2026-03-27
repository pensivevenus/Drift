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

  // schedule time-on-site check
  chrome.alarms.create('siteCheck', { periodInMinutes: 1 });
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
    'last_interrupt_time', 'last_focused_domain', 'last_focus_time',
    'drift_settings'
  ]);

  const {
    active_session_id,
    active_intention,
    tab_open_timestamps = [],
    last_interrupt_time = 0,
    last_focused_domain,
    last_focus_time,
    drift_settings = {},
  } = data;

  if (!active_session_id) return;

  const cooldownMs = (drift_settings.cooldownMins || 5) * 60000;
  if (Date.now() - last_interrupt_time < cooldownMs) return;

  const tabDrift = await detectTabDrift(tab_open_timestamps);
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

async function detectTabDrift(timestamps) {
  const { drift_settings = {} } = await chrome.storage.local.get('drift_settings');
  const threshold = drift_settings.tabsThreshold || 4;
  const window_ = (drift_settings.timeWindow || 90) * 1000;
  const recent = timestamps.filter(t => Date.now() - t < window_);
  return recent.length >= threshold;
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

  if (alarm.name === 'siteCheck') {
    const data = await chrome.storage.local.get([
      'drift_settings', 'last_focused_domain',
      'last_focus_time', 'active_session_id', 'last_interrupt_time'
    ]);

    const { drift_settings = {}, last_focused_domain, last_focus_time,
            active_session_id, last_interrupt_time = 0 } = data;

    if (!active_session_id) return;
    if (!drift_settings.siteAlertEnabled) return;

    const cooldownMs = (drift_settings.cooldownMins || 5) * 60000;
    if (Date.now() - last_interrupt_time < cooldownMs) return;

    const limitMs = (drift_settings.siteDurationMins || 25) * 60000;
    if (!last_focus_time) return;

    const timeOnSite = Date.now() - last_focus_time;
    console.log('Site check — time on site:', Math.round(timeOnSite / 60000), 'min, limit:', drift_settings.siteDurationMins || 25, 'min');

    if (timeOnSite > limitMs) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) return;
      try {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'show_interrupt',
          intention: `You've been on ${last_focused_domain} for over ${drift_settings.siteDurationMins || 25} minutes`,
          tabCount: 0,
          seconds: 0,
          reason: 'site_time',
        });
        await chrome.storage.local.set({ last_interrupt_time: Date.now() });
        console.log('Site time alert sent for', last_focused_domain);
      } catch (e) {
        console.log('Could not send site alert:', e.message);
      }
    }
  }
});
