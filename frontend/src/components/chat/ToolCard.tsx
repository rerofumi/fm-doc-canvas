import { ChatToolEvent } from "../../types/chat";

const labels: Record<string, string> = {
  running: "実行中",
  applied: "適用済み",
  conflict: "競合で拒否",
  cancelled: "キャンセル",
  error: "エラー",
  done: "完了",
};

export default function ToolCard({ event }: { event: ChatToolEvent }) {
  const proposal = event.proposal;
  return <div className="my-1 rounded border border-gray-200 bg-white/70 px-2 py-1.5 text-xs text-gray-600">
    <div className="flex items-center justify-between gap-2"><span className="font-semibold">{event.name}</span><span className={event.status === "conflict" || event.status === "error" ? "text-red-600" : event.status === "applied" ? "text-green-700" : "text-gray-500"}>{labels[event.status] ?? event.status}</span></div>
    {(proposal?.targetNodeId || proposal?.nodeId) && <div className="mt-1 truncate text-gray-500">対象: {proposal.targetNodeId || proposal.nodeId}</div>}
    {proposal?.operation === "edit" && <div className="mt-1 grid grid-cols-2 gap-1"><div className="rounded bg-red-50 p-1 line-through">{proposal.searchText}</div><div className="rounded bg-green-50 p-1">{proposal.replacement}</div></div>}
    {proposal?.operation !== "edit" && proposal?.filename && <div className="mt-1 truncate">{proposal.filename}</div>}
    {event.error && <div className="mt-1 text-red-600">{event.error}</div>}
    {event.summary && <div className="mt-1 truncate text-gray-500">{event.summary}</div>}
  </div>;
}
