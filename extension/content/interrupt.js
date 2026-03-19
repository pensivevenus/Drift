function injectStyles() {
  if (document.getElementById('drift-interrupt-styles')) return;
  const link = document.createElement('link');
  link.id = 'drift-interrupt-styles';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/interrupt.css');
  document.head.appendChild(link);
}

function showInterrupt(intention, tabCount, seconds) {
  if (document.getElementById('drift-interrupt-backdrop')) return;

  injectStyles();

  const backdrop = document.createElement('div');
  backdrop.id = 'drift-interrupt-backdrop';

  const statsText = tabCount >= 4
    ? `You've opened ${tabCount} tabs in the last ${seconds} seconds.`
    : `You've been here for a while — is this where you meant to be?`;

  backdrop.innerHTML = `
    <div id="drift-interrupt-card">
      <p id="drift-interrupt-label">drift detected</p>
      <p id="drift-interrupt-intention">You meant to: ${intention}</p>
      <p id="drift-interrupt-stats">${statsText}</p>
      <div id="drift-interrupt-actions">
        <button class="drift-btn-secondary" id="drift-keep-going">keep going</button>
        <button class="drift-btn-primary" id="drift-refocus">refocus</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('drift-keep-going').addEventListener('click', () => {
    removeInterrupt();
    chrome.runtime.sendMessage({ type: 'interrupt_dismissed', action: 'keep_going' }, () => {
      chrome.runtime.lastError;
    });
  });

  document.getElementById('drift-refocus').addEventListener('click', () => {
    removeInterrupt();
    chrome.runtime.sendMessage({ type: 'interrupt_dismissed', action: 'refocus' }, () => {
      chrome.runtime.lastError;
    });
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) removeInterrupt();
  });
}

function removeInterrupt() {
  const backdrop = document.getElementById('drift-interrupt-backdrop');
  if (backdrop) {
    backdrop.style.animation = 'driftFadeIn 0.2s ease reverse forwards';
    setTimeout(() => backdrop.remove(), 200);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'show_interrupt') {
    showInterrupt(msg.intention, msg.tabCount, msg.seconds);
  }
});