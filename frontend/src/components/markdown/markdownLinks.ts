export type MarkdownLinkClickEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

/**
 * Returns true only for absolute HTTP(S) URLs.
 *
 * Markdown rendered inside the Wails WebView must never navigate the WebView
 * itself. Keeping this check separate from the renderer also makes the
 * security contract easy to exercise without a browser or Wails runtime.
 */
export function isAllowedExternalMarkdownUrl(
  href: string | undefined,
): href is string {
  if (!href) return false;

  try {
    const url = new URL(href);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Applies the Markdown link click contract. Every Markdown link is prevented
 * from navigating the WebView; only an allowed absolute URL is handed to the
 * caller (the Wails BrowserOpenURL adapter in the component).
 */
export function handleMarkdownLinkClick(
  event: MarkdownLinkClickEvent,
  href: string | undefined,
  openExternal: (url: string) => void,
): boolean {
  event.preventDefault();
  event.stopPropagation();

  if (!isAllowedExternalMarkdownUrl(href)) {
    return false;
  }

  openExternal(href);
  return true;
}
