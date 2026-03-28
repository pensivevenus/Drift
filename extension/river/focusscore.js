/**
 * focusscore.js — Drift Focus Score
 * Returns a 0–100 score based on 4 weighted signals:
 *   40%  Focused time ratio
 *   25%  Interrupt penalty
 *   20%  Tab switching frequency
 *   15%  Intention match (domain keywords vs intention string)
 */

export function computeFocusScore(session) {
  if (!session || !session.events || session.events.length === 0) return null;

  const duration = (session.endTime || Date.now()) - session.startTime;
  if (duration < 10000) return null;

  // ── 1. Focused time ratio (40%) ─────────────────────────
  // Sum all focus→blur pairs to get total focused ms
  let focusedMs = 0;
  let lastFocusTime = null;

  for (const e of session.events) {
    if (e.type === 'focus') {
      lastFocusTime = e.timestamp;
    } else if (e.type === 'blur' && lastFocusTime !== null) {
      focusedMs += e.timestamp - lastFocusTime;
      lastFocusTime = null;
    }
  }
  // If still focused at session end
  if (lastFocusTime !== null) {
    focusedMs += (session.endTime || Date.now()) - lastFocusTime;
  }

  const focusRatio = Math.min(focusedMs / duration, 1);
  const focusScore = focusRatio * 100; // 0–100

  // ── 2. Interrupt penalty (25%) ───────────────────────────
  // 0 interrupts = 100, each interrupt costs 20 points, floor 0
  const interrupts = session.interrupts || 0;
  const interruptScore = Math.max(0, 100 - interrupts * 20);

  // ── 3. Tab switching frequency (20%) ────────────────────
  // Count open events per minute. ≤1/min = 100, ≥6/min = 0
  const openEvents = session.events.filter(e => e.type === 'open').length;
  const durationMins = duration / 60000;
  const opensPerMin = durationMins > 0 ? openEvents / durationMins : 0;
  const tabScore = Math.max(0, Math.min(100, 100 - (opensPerMin - 1) * 20));

  // ── 4. Intention match (15%) ─────────────────────────────
  // Extract keywords from intention (≥4 chars), count domain hits
  const intention = (session.intention || '').toLowerCase();
  const keywords = intention.split(/\s+/).filter(w => w.length >= 4);

  let intentionScore = 50; // neutral if no keywords
  if (keywords.length > 0) {
    const domains = [...new Set(session.events
      .filter(e => e.type === 'focus' && e.domain)
      .map(e => e.domain.toLowerCase()))];

    if (domains.length > 0) {
      const matchedDomains = domains.filter(d =>
        keywords.some(kw => d.includes(kw))
      ).length;
      intentionScore = Math.round((matchedDomains / domains.length) * 100);
    }
  }

  // ── Weighted total ───────────────────────────────────────
  const total = Math.round(
    focusScore    * 0.40 +
    interruptScore * 0.25 +
    tabScore       * 0.20 +
    intentionScore * 0.15
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      focusRatio:     Math.round(focusScore),
      interrupts:     Math.round(interruptScore),
      tabSwitching:   Math.round(tabScore),
      intentionMatch: Math.round(intentionScore),
    }
  };
}

export function scoreLabel(score) {
  if (score >= 85) return { text: 'Deep Focus',    color: '#7aab85' };
  if (score >= 65) return { text: 'On Track',       color: '#6366f1' };
  if (score >= 45) return { text: 'Some Drift',     color: '#c8a97e' };
  if (score >= 25) return { text: 'Heavy Drift',    color: '#d4766a' };
  return               { text: 'Lost in Tabs',   color: '#d46a9b' };
}