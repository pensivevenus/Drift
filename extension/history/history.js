import { getAllSessions } from '../shared/db.js';

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins + ' min';
  return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
}

async function render() {
  const loading = document.getElementById('loading');
  const list = document.getElementById('session-list');
  const empty = document.getElementById('empty');

  const all = await getAllSessions();
  loading.style.display = 'none';

  const complete = all
    .filter(s => s.endTime && s.startTime)
    .sort((a, b) => b.startTime - a.startTime);

  if (!complete.length) { empty.style.display = 'block'; return; }

  complete.forEach(session => {
    const duration = session.endTime - session.startTime;
    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
      <div class="session-left">
        <div class="session-intention">${session.intention || 'free browsing'}</div>
        <div class="session-meta">${formatDate(session.startTime)}</div>
      </div>
      <div class="session-right">
        <div class="session-stat">
          <div class="stat-num">${formatDuration(duration)}</div>
          <div class="stat-label">duration</div>
        </div>
        <div class="session-stat">
          <div class="stat-num">${session.interrupts || 0}</div>
          <div class="stat-label">interrupts</div>
        </div>
        <span class="interrupt-badge">view →</span>
      </div>
    `;
    card.addEventListener('click', () => {
      const url = chrome.runtime.getURL(`river/river.html?id=${session.id}`);
      window.location.href = url;
    });
    list.appendChild(card);
  });
}

render();