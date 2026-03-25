import { getDomainColor, getDomainLabel } from '../shared/colors.js';

export function processEvents(session) {
  const events = session.events || [];
  const segments = [];
  const focusStart = {};

  for (const ev of events) {
    if (ev.type === 'focus') {
      focusStart[ev.tabId] = { domain: ev.domain, time: ev.timestamp };
    } else if (ev.type === 'blur') {
      const start = focusStart[ev.tabId];
      if (start && start.domain === ev.domain) {
        const duration = ev.timestamp - start.time;
        if (duration > 0) {
          segments.push({ domain: ev.domain, start: start.time, end: ev.timestamp, duration });
        }
        delete focusStart[ev.tabId];
      }
    }
  }

  // Close any still-open focus segments
  const sessionEnd = session.endTime || Date.now();
  for (const tabId of Object.keys(focusStart)) {
    const start = focusStart[tabId];
    const duration = sessionEnd - start.time;
    if (duration > 0) {
      segments.push({ domain: start.domain, start: start.time, end: sessionEnd, duration });
    }
  }

  segments.sort((a, b) => a.start - b.start);
  return segments;
}

export function getUniqueDomains(segments) {
  const totals = {};
  for (const seg of segments) {
    totals[seg.domain] = (totals[seg.domain] || 0) + seg.duration;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain);
}

export function drawRiverMap(ctx, session, canvas) {
  const segments = processEvents(session);
  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(0, 0, W, H);

  if (!segments.length) return;

  const domains = getUniqueDomains(segments);
  const domainCount = domains.length;

  // Time range: use the actual span of events, not session start/end
  // This makes bands fill the canvas properly
  const allStarts = segments.map(s => s.start);
  const allEnds   = segments.map(s => s.end);
  const timeMin   = Math.min(...allStarts);
  const timeMax   = Math.max(...allEnds);
  const totalDuration = timeMax - timeMin;

  if (totalDuration <= 0) return;

  // Layout
  const PAD_TOP    = 48;
  const PAD_BOTTOM = 24;
  const PAD_LEFT   = 12;
  const PAD_RIGHT  = 12;
  const BAND_GAP   = 6;

  const drawW = W - PAD_LEFT - PAD_RIGHT;
  const drawH = H - PAD_TOP - PAD_BOTTOM;

  // Each domain gets an equal horizontal row
  const rowH    = Math.floor((drawH - BAND_GAP * (domainCount - 1)) / domainCount);
  const bandH   = Math.max(16, Math.min(48, rowH));   // clamp: at least 16px, at most 48px
  const scale   = drawW / totalDuration;

  // Map domain → Y start of its row
  const domainY = {};
  domains.forEach((d, i) => {
    domainY[d] = PAD_TOP + i * (bandH + BAND_GAP);
  });

  // --- Intention label ---
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(240,240,245,0.4)';
  ctx.fillText(session.intention || 'untitled session', PAD_LEFT, 30);

  // --- Subtle vertical tick lines ---
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const x = PAD_LEFT + (i / 8) * drawW;
    ctx.beginPath();
    ctx.moveTo(x, PAD_TOP - 4);
    ctx.lineTo(x, PAD_TOP + domainCount * (bandH + BAND_GAP));
    ctx.stroke();
  }

  // --- Draw segments as horizontal bands ---
  for (const seg of segments) {
    const x = PAD_LEFT + (seg.start - timeMin) * scale;
    const w = Math.max(3, seg.duration * scale);
    const y = domainY[seg.domain];
    const color = getDomainColor(seg.domain);
    const r = Math.min(3, w / 2, bandH / 2);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,        x + w, y + r);
    ctx.lineTo(x + w, y + bandH - r);
    ctx.quadraticCurveTo(x + w, y + bandH, x + w - r, y + bandH);
    ctx.lineTo(x + r,  y + bandH);
    ctx.quadraticCurveTo(x,     y + bandH, x,      y + bandH - r);
    ctx.lineTo(x,      y + r);
    ctx.quadraticCurveTo(x,     y,         x + r,  y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // --- Domain labels inside each row ---
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  for (const domain of domains) {
    const y = domainY[domain];
    const color = getDomainColor(domain);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fillText(getDomainLabel(domain), PAD_LEFT + 6, y + bandH - 5);
  }

  ctx.globalAlpha = 1;
}

export function buildLegend(session) {
  const segments = processEvents(session);
  const totals = {};
  for (const seg of segments) {
    totals[seg.domain] = (totals[seg.domain] || 0) + seg.duration;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, ms]) => ({
      domain,
      color: getDomainColor(domain),
      label: getDomainLabel(domain),
      minutes: Math.max(1, Math.round(ms / 60000))
    }));
}
