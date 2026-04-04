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

  const allStarts = segments.map(s => s.start);
  const allEnds   = segments.map(s => s.end);
  const timeMin   = Math.min(...allStarts);
  const timeMax   = Math.max(...allEnds);
  const totalDuration = timeMax - timeMin;

  if (totalDuration <= 0) return;

  // Layout — extra top padding so labels sit above bars with room
  const LABEL_H    = 16;  // px reserved above each band for the label
  const PAD_TOP    = 48;
  const PAD_BOTTOM = 24;
  const PAD_LEFT   = 12;
  const PAD_RIGHT  = 12;
  const BAND_GAP   = LABEL_H + 8;  // gap includes label space

  const drawW = W - PAD_LEFT - PAD_RIGHT;
  const drawH = H - PAD_TOP - PAD_BOTTOM;

  const rowH  = Math.floor((drawH - BAND_GAP * (domainCount - 1)) / domainCount);
  const bandH = Math.max(16, Math.min(48, rowH - LABEL_H));
  const scale = drawW / totalDuration;

  // Map domain → Y start of its BAR (label sits above this)
  const domainY = {};
  domains.forEach((d, i) => {
    domainY[d] = PAD_TOP + i * (bandH + BAND_GAP) + LABEL_H;
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
    ctx.moveTo(x, PAD_TOP);
    ctx.lineTo(x, PAD_TOP + domainCount * (bandH + BAND_GAP));
    ctx.stroke();
  }

  // --- Domain labels ABOVE each row ---
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  for (const domain of domains) {
    const y = domainY[domain];
    const color = getDomainColor(domain);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    // Draw label just above the bar (y - 4 sits on the baseline above the bar top)
    ctx.fillText(getDomainLabel(domain), PAD_LEFT + 4, y - 4);
  }
  ctx.globalAlpha = 1;

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
    ctx.quadraticCurveTo(x + w, y,         x + w, y + r);
    ctx.lineTo(x + w, y + bandH - r);
    ctx.quadraticCurveTo(x + w, y + bandH,  x + w - r, y + bandH);
    ctx.lineTo(x + r,  y + bandH);
    ctx.quadraticCurveTo(x,     y + bandH,  x,      y + bandH - r);
    ctx.lineTo(x,      y + r);
    ctx.quadraticCurveTo(x,     y,           x + r,  y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// Merge overlapping time intervals so parallel tabs don't double-count
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

export function buildLegend(session) {
  const segments = processEvents(session);

  // Group raw segments by domain
  const byDomain = {};
  for (const seg of segments) {
    if (!byDomain[seg.domain]) byDomain[seg.domain] = [];
    byDomain[seg.domain].push({ start: seg.start, end: seg.end });
  }

  // Merge overlaps per domain then sum actual wall-clock time
  const totals = {};
  for (const [domain, intervals] of Object.entries(byDomain)) {
    const merged = mergeIntervals(intervals);
    totals[domain] = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
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