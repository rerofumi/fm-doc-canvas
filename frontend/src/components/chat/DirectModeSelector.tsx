import { Image as ImageIcon, Type } from "lucide-react";
import type { DirectMode } from "../../store/useChatStore";

export default function DirectModeSelector({
  value,
  disabled,
  onChange,
}: {
  value: DirectMode;
  disabled: boolean;
  onChange: (mode: DirectMode) => void;
}) {
  return (
    <div
      className="flex rounded bg-gray-100 p-1"
      role="group"
      aria-label="Direct generation type"
      data-testid="direct-mode-selector"
    >
      <button
        type="button"
        aria-pressed={value === "text"}
        disabled={disabled}
        onClick={() => onChange("text")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${value === "text" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}
      >
        <Type size={13} />Text
      </button>
      <button
        type="button"
        aria-pressed={value === "image"}
        disabled={disabled}
        onClick={() => onChange("image")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${value === "image" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}
      >
        <ImageIcon size={13} />Image
      </button>
    </div>
  );
}
