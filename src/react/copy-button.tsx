import { useState, useCallback, useEffect, useRef } from "react";

const COPIED_DURATION = 2000;
const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export interface CopyButtonProps {
  /** The raw code text to copy */
  code: string;
  /** Button label (default: "Copy") */
  label?: string | undefined;
  /** Label shown after copying (default: "Copied!") */
  copiedLabel?: string | undefined;
  /** CSS class prefix (default: "neo-hl") */
  classPrefix?: string | undefined;
  /** Callback fired after successful copy */
  onCopy?: ((code: string) => void) | undefined;
  /** Additional class name */
  className?: string | undefined;
  /** Additional styles */
  style?: React.CSSProperties | undefined;
}

/**
 * Copy-to-clipboard button for code blocks.
 * Uses navigator.clipboard.writeText with execCommand fallback.
 * Shows "Copied!" feedback for 2 seconds after click.
 */
export function CopyButton({
  code,
  label = "Copy",
  copiedLabel = "Copied!",
  classPrefix = "neo-hl",
  onCopy,
  className,
  style,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    let success = false;

    // Modern API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        success = true;
      } catch {
        // Fall through to fallback
      }
    }

    if (!mountedRef.current) return;

    // Fallback
    if (!success) {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        success = document.execCommand("copy");
      } catch {
        success = false;
      }
      document.body.removeChild(textarea);
    }

    if (success && mountedRef.current) {
      setCopied(true);
      onCopy?.(code);

      // Clear previous timer
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, COPIED_DURATION);
    }
  }, [code, onCopy]);

  const buttonClass = [
    `${classPrefix}-copy-button`,
    copied ? `${classPrefix}-copy-button-copied` : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        style={style}
        onClick={handleClick}
        aria-label={label}
      >
        {copied ? copiedLabel : label}
      </button>
      <span
        className={`${classPrefix}-copy-status`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={VISUALLY_HIDDEN_STYLE}
      >
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
