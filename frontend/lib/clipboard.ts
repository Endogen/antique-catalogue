/**
 * Copies text to the clipboard.
 *
 * The async Clipboard API only exists in secure contexts (HTTPS or localhost),
 * so on a plain-HTTP origin, such as a development server opened from a phone
 * over the LAN, it is missing. There, and wherever the API rejects, this falls
 * back to selecting a hidden textarea and running the legacy copy command,
 * which browsers still permit during a user gesture.
 */
export async function copyText(value: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy path.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable.");
  }

  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  // Off-screen but still selectable; 16px keeps iOS from zooming on focus.
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.fontSize = "16px";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    previousFocus?.focus?.();
  }

  if (!copied) {
    throw new Error("Clipboard is unavailable.");
  }
}
