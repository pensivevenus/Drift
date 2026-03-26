function loadSettings() {
  const s = JSON.parse(localStorage.getItem('drift_settings') || '{}');
  const threshold = s.tabsThreshold || 4;
  const window_ = s.timeWindow || 90;
  const theme = s.theme || 'auto';

  document.getElementById('tabs-threshold').value = threshold;
  document.getElementById('tabs-val').textContent = threshold;
  document.getElementById('time-window').value = window_;
  document.getElementById('time-val').textContent = window_ + 's';
  document.getElementById('theme-select').value = theme;
}

function update(sliderId, valId, display) {
  document.getElementById(valId).textContent = display;
  saveSettings();
}

function saveSettings() {
  const settings = {
    tabsThreshold: parseInt(document.getElementById('tabs-threshold').value),
    timeWindow: parseInt(document.getElementById('time-window').value),
    theme: document.getElementById('theme-select').value,
  };
  localStorage.setItem('drift_settings', JSON.stringify(settings));

  const toast = document.getElementById('saved-toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function clearData() {
  if (!confirm('Delete all session history? This cannot be undone.')) return;
  const req = indexedDB.deleteDatabase('drift_db');
  req.onsuccess = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('drift_'));
    keys.forEach(k => localStorage.removeItem(k));
    alert('All data deleted.');
  };
}

window.update = update;
window.saveSettings = saveSettings;
window.clearData = clearData;

loadSettings();