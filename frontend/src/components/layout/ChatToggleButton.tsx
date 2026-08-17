import { Sparkles } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";
import { useTranslation } from "react-i18next";

const ChatToggleButton = () => {
  const isOpen = useChatStore((state) => state.isOpen);
  const setOpen = useChatStore((state) => state.setOpen);
  const { t } = useTranslation();
  const label = t(($) => $.layout.aiAssistant);
  return (
    <button
      data-testid="shell-chat-toggle"
      onClick={() => setOpen(!isOpen)}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
      title={label}
      aria-label={label}
    >
      <Sparkles size={16} />
      <span>{label}</span>
    </button>
  );
};

export default ChatToggleButton;
