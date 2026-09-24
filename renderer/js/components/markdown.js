// ── Markdown rendering wrapper ────────────────────────────

export function renderMd(text) {
  if (!text || !window.marked) return text || '';
  try {
    return window.marked.parse(String(text));
  } catch {
    return String(text);
  }
}
