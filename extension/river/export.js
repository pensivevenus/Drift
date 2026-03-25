import { processEvents, getUniqueDomains } from './streamgraph.js';
import { getDomainColor, getDomainLabel } from '../shared/colors.js';

/**
 * exportPNG(canvas, session)
 * Downloads the current canvas as a PNG file.
 */
export function exportPNG(canvas, session) {
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const intention = (session.intention || 'session').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.href = url;
    a.download = `drift-${intention}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

/**
 * exportSVG(session)
 * Re-runs the draw algorithm writing SVG elements,
 * then triggers download as .svg
 */
export function exportSVG(session) {
  const W = 900;
  const H = 400;

  const PADDING_TOP = 56;
  const PADDING_BOTTOM = 16;
  const PADDING_LEFT = 16;
  const PADDING_RIGHT = 16;
  const BAND_GAP = 3;

  const segments = processEvents(session);
  if (!segments.length) return;

  const domains = getUniqueDomains(segments);
  const domainCount = domains.length;

  const sessionStart = session.startTime;
  const sessionEnd = session.endTime || Date.now();
  const totalDuration = sessionEnd - sessionStart;
  if (totalDuration <= 0) return;

  const drawW = W - PADDING_LEFT - PADDING_RIGHT;
  const drawH = H - PADDING_TOP - PADDING_BOTTOM;
  const bandH = Math.max(12, Math.floor((drawH - BAND_GAP * (domainCount - 1)) / domainCount));
  const scale = drawW / totalDuration;

  const domainYMap = {};
  domains.forEach((domain, i) => {
    domainYMap[domain] = PADDING_TOP + i * (bandH + BAND_GAP);
  });

  let svgParts = [];

  // Background
  svgParts.push(`<rect width="${W}" height="${H}" fill="#0f0f13"/>`);

  // Intention label
  const intentionText = (session.intention || 'untitled session')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  svgParts.push(
    `<text x="${PADDING_LEFT}" y="28" font-family="-apple-system,BlinkMacSystemFont,sans-serif" ` +
    `font-size="13" font-weight="500" fill="rgba(240,240,245,0.45)">${intentionText}</text>`
  );

  // Time axis ticks
  for (let i = 0; i <= 6; i++) {
    const x = PADDING_LEFT + (i / 6) * drawW;
    svgParts.push(
      `<line x1="${x.toFixed(1)}" y1="${PADDING_TOP - 8}" x2="${x.toFixed(1)}" ` +
      `y2="${PADDING_TOP + drawH}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`
    );
  }

  // Bands
  for (const seg of segments) {
    const x = PADDING_LEFT + (seg.start - sessionStart) * scale;
    const w = Math.max(4, seg.duration * scale);
    const y = domainYMap[seg.domain];
    const color = getDomainColor(seg.domain);
    const r = Math.min(4, w / 2, bandH / 2);

    svgParts.push(
      `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${bandH}" ` +
      `rx="${r}" ry="${r}" fill="${color}" opacity="0.82"/>`
    );
  }

  // Domain labels
  for (const domain of domains) {
    const y = domainYMap[domain];
    const color = getDomainColor(domain);
    const label = getDomainLabel(domain).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    svgParts.push(
      `<text x="${PADDING_LEFT + 4}" y="${y + bandH - 4}" ` +
      `font-family="-apple-system,BlinkMacSystemFont,sans-serif" ` +
      `font-size="12" fill="${color}" opacity="0.7">${label}</text>`
    );
  }

  const svgString = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    ...svgParts,
    `</svg>`
  ].join('\n');

  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const intention = (session.intention || 'session').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  a.href = url;
  a.download = `drift-${intention}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
