import { getSession } from '../shared/db.js';
import { drawRiverMap, buildLegend } from './streamgraph.js';
import { exportPNG, exportSVG } from './export.js';
import { computeFocusScore, scoreLabel } from './focusscore.js';

const params = new URLSearchParams(location.search);
const sessionId = params.get('id');

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

function resizeAndDraw(canvas, ctx, canvasWrap) {
  if (!currentSession || !canvas || !ctx || !canvasWrap) return;
  const W = canvasWrap.clientWidth  || canvasWrap.offsetWidth  || 800;
  const H = canvasWrap.clientHeight || canvasWrap.offsetHeight || 340;
  canvas.width  = W;
  canvas.height = H;
  drawRiverMap(ctx, currentSession, canvas);
}

function renderLegend(legendEl, session) {
  if (!legendEl) return;
  const items = buildLegend(session);
  if (!items.length) return;
  legendEl.innerHTML = items.map(item => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${item.color}"></span>
      <span>${item.label} &middot; ${item.minutes}m</span>
    </div>
  `).join('');
}

function renderFocusScore(session) {
  const el = document.getElementById('focus-score');
  if (!el) return;

  const result = computeFocusScore(session);
  if (!result) {
    el.style.display = 'none';
    return;
  }

  const { total, breakdown } = result;
  const label = scoreLabel(total);

  // Animate the ring stroke
  const circumference = 2 * Math.PI * 36; // r=36
  const offset = circumference - (total / 100) * circumference;

  el.innerHTML = `
    <div class="score-ring-wrap">
      <svg class="score-ring" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border, rgba(255,255,255,0.08))" stroke-width="7"/>
        <circle cx="40" cy="40" r="36" fill="none"
          stroke="${label.color}" stroke-width="7"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          style="transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1); transform: rotate(-90deg); transform-origin: 50% 50%;"
          id="score-arc"/>
        <text x="40" y="44" text-anchor="middle"
          font-size="16" font-weight="700" fill="var(--text, #fff)"
          font-family="DM Mono, monospace">${total}%</text>
      </svg>
    </div>
    <div class="score-details">
      <div class="score-label-text" style="color:${label.color}">${label.text}</div>
      <div class="score-subtitle">today's focus score</div>
      <div class="score-breakdown">
        <div class="breakdown-row">
          <span class="breakdown-name">focused time</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:${breakdown.focusRatio}%; background:${label.color}"></div>
          </div>
          <span class="breakdown-val">${breakdown.focusRatio}%</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-name">interrupts</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:${breakdown.interrupts}%; background:${label.color}"></div>
          </div>
          <span class="breakdown-val">${breakdown.interrupts}%</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-name">tab switching</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:${breakdown.tabSwitching}%; background:${label.color}"></div>
          </div>
          <span class="breakdown-val">${breakdown.tabSwitching}%</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-name">intention match</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar" style="width:${breakdown.intentionMatch}%; background:${label.color}"></div>
          </div>
          <span class="breakdown-val">${breakdown.intentionMatch}%</span>
        </div>
      </div>
    </div>
  `;

  el.style.display = 'flex';

  // Trigger ring animation after paint
  requestAnimationFrame(() => {
    const arc = document.getElementById('score-arc');
    if (arc) arc.style.strokeDashoffset = offset;
  });
}

async function init() {
  // All DOM queries inside init — safe from null crashes
  const canvas      = document.getElementById('river-canvas');
  const ctx         = canvas ? canvas.getContext('2d') : null;
  const loading     = document.getElementById('loading');
  const emptyState  = document.getElementById('empty-state');
  const errorState  = document.getElementById('error-state');
  const legendEl    = document.getElementById('legend');
  const intentionEl = document.getElementById('session-intention');
  const metaEl      = document.getElementById('session-meta');
  const canvasWrap  = document.getElementById('canvas-wrap');

  // Button listeners inside init so DOM is guaranteed ready
  const exportPngBtn = document.getElementById('export-png');
  const exportSvgBtn = document.getElementById('export-svg');
  if (exportPngBtn) exportPngBtn.addEventListener('click', () => {
    if (currentSession && canvas) exportPNG(canvas, currentSession);
  });
  if (exportSvgBtn) exportSvgBtn.addEventListener('click', () => {
    if (currentSession) exportSVG(currentSession);
  });

  function showError(msg) {
    if (loading)    loading.style.display = 'none';
    if (errorState) errorState.style.display = '';
    const p = errorState ? errorState.querySelector('p') : null;
    if (p) p.textContent = msg;
  }

  function showEmpty(msg) {
    if (loading)    loading.style.display = 'none';
    if (emptyState) emptyState.style.display = '';
    const p = emptyState ? emptyState.querySelector('p') : null;
    if (p) p.textContent = msg;
  }

  if (!sessionId) {
    showError('No session ID found in the URL.');
    return;
  }

  try {
    const session = await getSession(sessionId);

    if (!session) {
      showError('Session not found.');
      return;
    }

    currentSession = session;

    if (intentionEl) intentionEl.textContent = session.intention || 'untitled session';
    const duration = (session.endTime || Date.now()) - session.startTime;
    if (metaEl) metaEl.textContent = `${formatDate(session.startTime)} · ${formatDuration(duration)} · ${session.interrupts || 0} interrupts`;
    if (loading) loading.style.display = 'none';

    if (!session.events || session.events.length === 0) {
      showEmpty('No browsing data was recorded for this session.');
      return;
    }

    const THIRTY_SECONDS = 30 * 1000;
    if (duration < THIRTY_SECONDS) {
      showEmpty('This session was too short to map.');
      return;
    }

    if (canvas) canvas.style.display = 'block';
    requestAnimationFrame(() => {
      resizeAndDraw(canvas, ctx, canvasWrap);
      renderLegend(legendEl, session);
      renderFocusScore(session);
    });

    window.addEventListener('resize', () => resizeAndDraw(canvas, ctx, canvasWrap));

  } catch (err) {
    console.error('[Drift] river.js error:', err);
    showError('Something went wrong loading this session.');
  }
}

init();