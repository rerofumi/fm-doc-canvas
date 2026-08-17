import { Image as ImageIcon, Type } from "lucide-react";
import type { DirectMode } from "../../store/useChatStore";
import { useTranslation } from "react-i18next";

export default function DirectModeSelector({
  value,
  disabled,
  onChange,
}: {
  value: DirectMode;
  disabled: boolean;
  onChange: (mode: DirectMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex rounded bg-gray-100 p-1"
      role="group"
      aria-label={t($ => $.assistant.directGenerationType)}
      data-testid="direct-mode-selector"
    >
      <button
        type="button"
        aria-pressed={value === "text"}
        disabled={disabled}
        onClick={() => onChange("text")}
        data-direct-mode="text"
        data-testid="direct-mode-text"
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${value === "text" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}
      >
        <Type size={13} />{t($ => $.assistant.text)}
      </button>
      <button
        type="button"
        aria-pressed={value === "image"}
        disabled={disabled}
        onClick={() => onChange("image")}
        data-direct-mode="image"
        data-testid="direct-mode-image"
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${value === "image" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500"}`}
      >
        <ImageIcon size={13} />{t($ => $.assistant.image)}
      </button>
    </div>
  );
}
