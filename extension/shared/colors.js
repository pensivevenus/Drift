const PALETTE = [
  "#6366f1", "#7baaa0", "#c8a97e", "#d4766a", "#7aab85",
  "#9b8ec4", "#d4a76a", "#6a9bd4", "#a0c878", "#d46a9b",
  "#78c8c0", "#c8786a"
];

export function getDomainColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getDomainLabel(domain) {
  return domain.replace(/^www\./, '');
}