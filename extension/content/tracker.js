window.__driftTrackerLoaded = true;
const tabId = crypto.randomUUID();

function sendToServiceWorker(data) {
  chrome.runtime.sendMessage(data, () => {
    chrome.runtime.lastError;
  });
}

sendToServiceWorker({
  type: 'tab_open',
  domain: location.hostname,
  timestamp: Date.now(),
  tabId,
});

document.addEventListener('visibilitychange', () => {
  sendToServiceWorker({
    type: document.visibilityState === 'visible' ? 'focus' : 'blur',
    domain: location.hostname,
    timestamp: Date.now(),
    tabId,
  });
});

console.log('Drift tracker loaded on', location.hostname);