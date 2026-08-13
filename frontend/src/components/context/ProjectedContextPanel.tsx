import { useLayoutEffect, useMemo, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { MAX_PROMOTE_ITEMS, countPromoteItems } from "../../domain/contextPacket";

const kindLabel: Record<string, string> = {
  consensus: "合意",
  disagreement: "対立",
  minority: "少数意見",
  uncertainty: "不確実",
  freshness: "鮮度",
};

const providerLabel: Record<string, string> = {
  "ollama-web": "Ollama",
  "kagi-web": "Kagi",
  "brave-web": "Brave",
  "fake-web": "Fake",
};

export default function ProjectedContextPanel() {
  const packet = useAppStore((state) => state.activePacket);
  const promote = useAppStore((state) => state.promoteActivePacket);
  const dismiss = useAppStore((state) => state.dismissPacket);
  const openURL = useAppStore((state) => state.openExternalURL);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [acceptedRelationKeys, setAcceptedRelationKeys] = useState<string[]>([]);

  // The panel stays mounted while activePacket becomes null, so local
  // selection would otherwise leak into the next search packet.
  useLayoutEffect(() => {
    setSelectedClaimIds([]);
    setSelectedSourceIds([]);
    setAcceptedRelationKeys([]);
  }, [packet?.packetId]);

  const selectedCount = countPromoteItems(selectedClaimIds, selectedSourceIds);
  const overCap = selectedCount > MAX_PROMOTE_ITEMS;

  const clusters = useMemo(() => {
    if (!packet) return [];
    const map = new Map<string, number>();
    for (const source of packet.sources) {
      const key = source.clusterId || source.domain;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].filter(([, count]) => count > 1);
  }, [packet]);

  if (!packet) return null;

  const toggle = (list: string[], id: string, setter: (next: string[]) => void) => {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const relations = packet.suggestedRelations.map((relation, index) => ({
    key: `${relation.claimId || relation.sourceId}:${relation.targetNodeId}:${index}`,
    relation,
  }));

  return (
    <section
      className="max-h-[60vh] shrink-0 overflow-y-auto border-b border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800"
      aria-label="Projected Context"
      data-testid="projected-context-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Projected Context</div>
          <div className="font-semibold">{packet.query}</div>
          <div className="text-xs text-slate-600">
            {packet.status} · {providerLabel[packet.contextProvider] || packet.contextProvider} · {packet.retrievedAt}
          </div>
        </div>
        <button
          type="button"
          className="rounded border border-sky-300 bg-white px-2 py-1 text-xs font-semibold"
          aria-label="Close projected context"
          onClick={dismiss}
        >
          閉じる
        </button>
      </div>

      {packet.error && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700" role="alert">
          <div>{packet.error.code}: {packet.error.message}</div>
          <div className="mt-1 flex gap-2">
            <button type="button" className="underline" aria-label="Open Settings" onClick={() => setSettingsOpen(true)}>
              設定を開く
            </button>
            <button type="button" className="underline" aria-label="Close projected context" onClick={dismiss}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {clusters.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          同一 domain は cluster 表示しており、独立意見としては加算しません。
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Sources</h3>
          <ul className="mt-1 space-y-2" aria-label="Web search sources">
            {packet.sources.map((source) => (
              <li key={source.sourceId} className="rounded border border-sky-100 bg-white p-2" data-testid={`packet-source-${source.sourceId}`}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.includes(source.sourceId)}
                    onChange={() => toggle(selectedSourceIds, source.sourceId, setSelectedSourceIds)}
                    aria-label={`Select source ${source.title}`}
                  />
                  <span>
                    <span className="font-medium">{source.title}</span>
                    <span className="block text-[11px] text-slate-500">{source.domain} · {source.retrievedAt}</span>
                    <span className="block text-xs">{source.snippet}</span>
                    <span className="mt-1 block break-all text-[11px] text-sky-800">{source.url}</span>
                  </span>
                </label>
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-sky-800 underline"
                  aria-label={`Open URL ${source.url}`}
                  onClick={() => void openURL(source.url)}
                >
                  URL を開く
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Claims</h3>
          {packet.claims.length === 0 && (
            <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" role="status">
              Claimを生成できませんでした。Sourcesは個別に選択してPromoteできます。
            </p>
          )}
          <ul className="mt-1 space-y-2" aria-label="Web search claims">
            {packet.claims.map((claim) => (
              <li key={claim.claimId} className="rounded border border-sky-100 bg-white p-2" data-testid={`packet-claim-${claim.claimId}`}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedClaimIds.includes(claim.claimId)}
                    onChange={() => toggle(selectedClaimIds, claim.claimId, setSelectedClaimIds)}
                    aria-label={`Select claim ${claim.text}`}
                  />
                  <span>
                    <span className="mr-1 rounded bg-slate-100 px-1 text-[10px] font-bold uppercase">{kindLabel[claim.kind] || claim.kind}</span>
                    <span>{claim.text}</span>
                    <span className="block text-[11px] text-slate-500">
                      参照元: {claim.sourceIds.map((id) => packet.sources.find((source) => source.sourceId === id)?.title || id).join(", ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {relations.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested Relations</h3>
          {relations.map(({ key, relation }) => (
            <label key={key} className="mt-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={acceptedRelationKeys.includes(key)}
                onChange={() => toggle(acceptedRelationKeys, key, setAcceptedRelationKeys)}
                aria-label={`Accept relation ${relation.kind} to ${relation.targetNodeId}`}
              />
              <span>
                {relation.kind} → {relation.targetNodeId}
                {relation.reason ? ` (${relation.reason})` : ""}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-t border-sky-200 bg-sky-50 px-4 py-3">
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-300"
          aria-label="Promote selected context"
          disabled={selectedCount === 0 || overCap || packet.status === "failed"}
          onClick={() =>
            promote({
              selectedClaimIds,
              selectedSourceIds,
              acceptedRelations: relations
                .filter((item) => acceptedRelationKeys.includes(item.key))
                .map((item) => item.relation),
            })
          }
        >
          Promote
        </button>
        {overCap && <span className="text-xs text-red-700">1 回の Promote は最大 {MAX_PROMOTE_ITEMS} 件です。選択を減らしてください。</span>}
        <span className="text-xs text-slate-500">{selectedCount} / {MAX_PROMOTE_ITEMS} selected</span>
      </div>
    </section>
  );
}
