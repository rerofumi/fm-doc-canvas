import { Sparkles } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";

const ChatToggleButton = () => {
  const isOpen = useChatStore((state) => state.isOpen);
  const setOpen = useChatStore((state) => state.setOpen);
  return <button onClick={() => setOpen(!isOpen)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100" title="AI Assistant" aria-label="AI Assistant">
    <Sparkles size={16} />
    <span>AI Assistant</span>
  </button>;
};

export default ChatToggleButton;
