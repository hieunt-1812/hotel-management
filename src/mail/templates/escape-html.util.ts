const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes user-provided text before putting it into an HTML mail. */
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
