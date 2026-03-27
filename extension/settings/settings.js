function getEl(id) { return document.getElementById(id); }

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('drift_settings') || '{}');
  getEl('tabs-threshold').value = s.tabsThreshold ?? 4;
  getEl('tabs-num').value = s.tabsThreshold ?? 4;
  getEl('time-window').value = s.timeWindow ?? 90;
  getEl('time-num').value = s.timeWindow ?? 90;
  getEl('cooldown').value = s.cooldownMins ?? 5;
  getEl('cooldown-num').value = s.cooldownMins ?? 5;
  getEl('site-alert-enabled').checked = s.siteAlertEnabled ?? false;
  getEl('site-duration').value = s.siteDurationMins ?? 25;
  getEl('site-num').value = s.siteDurationMins ?? 25;
  getEl('theme-select').value = s.theme ?? 'auto';
}

function saveSettings() {
  const settings = {
    tabsThreshold: parseInt(getEl('tabs-threshold').value) || 4,
    timeWindow: parseInt(getEl('time-window').value) || 90,
    cooldownMins: parseInt(getEl('cooldown').value) || 5,
    siteAlertEnabled: getEl('site-alert-enabled').checked,
    siteDurationMins: parseInt(getEl('site-duration').value) || 25,
    theme: getEl('theme-select').value,
  };
  localStorage.setItem('drift_settings', JSON.stringify(settings));
  chrome.storage.local.set({ drift_settings: settings });
  const toast = getEl('saved-toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function linkRangeNum(rangeId, numId, min, max) {
  const range = getEl(rangeId);
  const num = getEl(numId);
  range.addEventListener('input', () => { num.value = range.value; saveSettings(); });
  num.addEventListener('input', () => {
    const v = Math.min(max, Math.max(min, parseInt(num.value) || min));
    range.value = v; num.value = v; saveSettings();
  });
}

async function clearData() {
  if (!confirm('Delete all session history permanently?')) return;
  if (!confirm('Last chance — this cannot be undone.')) return;
  await new Promise((res, rej) => {
    const req = indexedDB.deleteDatabase('drift_db');
    req.onsuccess = res; req.onerror = rej;
  });
  Object.keys(localStorage).filter(k => k.startsWith('drift_')).forEach(k => localStorage.removeItem(k));
  await chrome.storage.local.clear();
  alert('All data deleted.');
  window.location.href = '../newtab/newtab.html';
}

// wire everything up
linkRangeNum('tabs-threshold', 'tabs-num', 2, 10);
linkRangeNum('time-window', 'time-num', 30, 180);
linkRangeNum('cooldown', 'cooldown-num', 1, 30);
linkRangeNum('site-duration', 'site-num', 5, 60);
getEl('site-alert-enabled').addEventListener('change', saveSettings);
getEl('theme-select').addEventListener('change', saveSettings);
getEl('clear-btn').addEventListener('click', clearData);

loadSettings();