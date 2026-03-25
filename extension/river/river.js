import { getSession } from '../shared/db.js';
import { drawRiverMap, buildLegend } from './streamgraph.js';
import { exportPNG, exportSVG } from './export.js';

const params = new URLSearchParams(location.search);
const sessionId = params.get('id');

const canvas = document.getElementById('river-canvas');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const legendEl = document.getElementById('legend');
const intentionEl = document.getElementById('session-intention');
const metaEl = document.getElementById('session-meta');
const canvasWrap = document.getElementById('canvas-wrap');

let currentSession = null;

function formatDuration(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function resizeAndDraw() {
  if (!currentSession) return;
  const W = canvasWrap.clientWidth  || canvasWrap.offsetWidth  || 800;
  const H = canvasWrap.clientHeight || canvasWrap.offsetHeight || 340;
  canvas.width  = W;
  canvas.height = H;
  drawRiverMap(ctx, currentSession, canvas);
}

function renderLegend(session) {
  const items = buildLegend(session);
  if (!items.length) return;
  legendEl.innerHTML = items.map(item => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${item.color}"></span>
      <span>${item.label} &middot; ${item.minutes}m</span>
    </div>
  `).join('');
}

async function init() {
  if (!sessionId) {
    loading.style.display = 'none';
    errorState.style.display = '';
    return;
  }

  try {
    const session = await getSession(sessionId);

    if (!session) {
      loading.style.display = 'none';
      errorState.style.display = '';
      return;
    }

    currentSession = session;

    intentionEl.textContent = session.intention || 'untitled session';
    const duration = (session.endTime || Date.now()) - session.startTime;
    metaEl.textContent = `${formatDate(session.startTime)} · ${formatDuration(duration)} · ${session.interrupts || 0} interrupts`;

    loading.style.display = 'none';

    if (!session.events || session.events.length === 0) {
      emptyState.style.display = '';
      return;
    }

    // Show canvas, then wait one frame for browser to lay out before sizing
    canvas.style.display = 'block';
    requestAnimationFrame(() => {
      resizeAndDraw();
      renderLegend(session);
    });

  } catch (err) {
    console.error('[Drift] river.js error:', err);
    loading.style.display = 'none';
    errorState.style.display = '';
  }
}

document.getElementById('export-png').addEventListener('click', () => {
  if (currentSession) exportPNG(canvas, currentSession);
});

document.getElementById('export-svg').addEventListener('click', () => {
  if (currentSession) exportSVG(currentSession);
});

document.getElementById('view-history').addEventListener('click', () => {
  location.href = '../history/history.html';
});

window.addEventListener('resize', resizeAndDraw);

init();