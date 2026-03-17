const tabId = crypto.randomUUID();
const channel = new BroadcastChannel('drift');

// announce this tab exists
channel.postMessage({
  type: 'tab_open',
  domain: location.hostname,
  timestamp: Date.now(),
  tabId,
});

// track focus and blur
document.addEventListener('visibilitychange', () => {
  channel.postMessage({
    type: document.visibilityState === 'visible' ? 'focus' : 'blur',
    domain: location.hostname,
    timestamp: Date.now(),
    tabId,
  });
});