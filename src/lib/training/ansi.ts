/**
 * Escape HTML and convert basic ANSI SGR codes to safe inline spans.
 */
export function ansiToSafeHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const colors: Record<string, string> = {
    "31": "color:#f87171",
    "32": "color:#34d399",
    "33": "color:#fbbf24",
    "34": "color:#60a5fa",
    "35": "color:#e879f9",
    "36": "color:#22d3ee",
    "37": "color:#e2e8f0",
    "90": "color:#64748b",
    "0": "",
    "39": "",
  };

  const parts = escaped.split(/\u001b\[([0-9;]*)m/g);
  let html = "";
  let open = false;
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 0) {
      const chunk = parts[i] ?? "";
      html += chunk.replace(/\n/g, "<br/>");
    } else {
      const code = (parts[i] ?? "0").split(";").pop() ?? "0";
      if (open) {
        html += "</span>";
        open = false;
      }
      const style = colors[code];
      if (style) {
        html += `<span style="${style}">`;
        open = true;
      }
    }
  }
  if (open) html += "</span>";
  return html;
}
