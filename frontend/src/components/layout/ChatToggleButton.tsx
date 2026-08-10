import { MessageSquare } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";

const ChatToggleButton = () => {
  const isOpen = useChatStore((state) => state.isOpen);
  const setOpen = useChatStore((state) => state.setOpen);
  return <button onClick={() => setOpen(!isOpen)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" title="Chat">
    <MessageSquare size={20} />
  </button>;
};

export default ChatToggleButton;
