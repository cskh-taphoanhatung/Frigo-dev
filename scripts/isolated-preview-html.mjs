// The isolated harness uses local cookie login and system-font fallbacks, never Google.
export function isolatedPreviewHtml(html) {
  return html
    .replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/[^"<>]*)?"[^>]*>/g, '')
    .replace(/<script\b[^>]*src="https:\/\/accounts\.google\.com\/gsi\/client"[^>]*>\s*<\/script>/g, '');
}
