import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { MAX_PROMOTE_ITEMS, countPromoteItems } from "../../domain/contextPacket";
import { presentUiMessage } from "../../i18n/messages";
import { presentClaimKind, presentContextProvider, presentPacketStatus, presentRelationKind } from "../../i18n/presentation";

export default function ProjectedContextPanel() {
  const { t } = useTranslation();
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
      aria-label={t($ => $.context.projected)}
      data-testid="projected-context-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-700">{t($ => $.context.projected)}</div>
          <div className="font-semibold">{packet.query}</div>
          <div className="text-xs text-slate-600">
            {presentPacketStatus(packet.status)} · {presentContextProvider(packet.contextProvider)} · {packet.retrievedAt}
          </div>
        </div>
        <button
          type="button"
          className="relative z-[60] rounded border border-sky-300 bg-white px-2 py-1 text-xs font-semibold"
          aria-label={t($ => $.context.closeProjectedAria)}
          data-testid="projected-context-close"
          onClick={dismiss}
        >
          {t($ => $.context.close)}
        </button>
      </div>

      {packet.error && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700" role="alert">
          <div>{presentUiMessage({ code: "context.packetFailed" })}</div>
          <div className="mt-1 flex gap-2">
            <button type="button" className="underline" aria-label={t($ => $.context.openSettingsAria)} data-testid="projected-context-open-settings" onClick={() => setSettingsOpen(true)}>
              {t($ => $.context.openSettings)}
            </button>
            <button type="button" className="relative z-[60] underline" aria-label={t($ => $.context.closeProjectedAria)} onClick={dismiss}>
              {t($ => $.context.close)}
            </button>
          </div>
        </div>
      )}

      {clusters.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          {t($ => $.context.clusterNote)}
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t($ => $.context.sources)}</h3>
          <ul className="mt-1 space-y-2" aria-label={t($ => $.context.sourcesAria)}>
            {packet.sources.map((source) => (
              <li key={source.sourceId} className="rounded border border-sky-100 bg-white p-2" data-testid={`packet-source-${source.sourceId}`}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.includes(source.sourceId)}
                    onChange={() => toggle(selectedSourceIds, source.sourceId, setSelectedSourceIds)}
                    aria-label={t($ => $.context.selectSourceAria, { title: source.title })}
                    data-testid={`projected-source-${source.sourceId}`}
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
                  aria-label={t($ => $.context.openUrlAria, { url: source.url })}
                  onClick={() => void openURL(source.url)}
                >
                  {t($ => $.context.urlOpen)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t($ => $.context.claims)}</h3>
          {packet.claims.length === 0 && (
            <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" role="status">
              {t($ => $.context.noClaims)}
            </p>
          )}
          <ul className="mt-1 space-y-2" aria-label={t($ => $.context.claimsAria)}>
            {packet.claims.map((claim) => (
              <li key={claim.claimId} className="rounded border border-sky-100 bg-white p-2" data-testid={`packet-claim-${claim.claimId}`}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedClaimIds.includes(claim.claimId)}
                    onChange={() => toggle(selectedClaimIds, claim.claimId, setSelectedClaimIds)}
                    aria-label={t($ => $.context.selectClaimAria, { text: claim.text })}
                    data-testid={`projected-claim-${claim.claimId}`}
                  />
                  <span>
                    <span className="mr-1 rounded bg-slate-100 px-1 text-[10px] font-bold uppercase">{presentClaimKind(claim.kind)}</span>
                    <span>{claim.text}</span>
                    <span className="block text-[11px] text-slate-500">
                      {t($ => $.context.sourceRef)} {claim.sourceIds.map((id) => packet.sources.find((source) => source.sourceId === id)?.title || id).join(", ")}
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
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t($ => $.context.suggestedRelations)}</h3>
          {relations.map(({ key, relation }) => (
            <label key={key} className="mt-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={acceptedRelationKeys.includes(key)}
                onChange={() => toggle(acceptedRelationKeys, key, setAcceptedRelationKeys)}
                aria-label={t($ => $.context.acceptRelationAria, { kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]), target: relation.targetNodeId })}
              />
              <span>
                {relation.reason
                  ? t($ => $.context.relationPreviewWithReason, { kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]), target: relation.targetNodeId, reason: relation.reason })
                  : t($ => $.context.relationPreview, { kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]), target: relation.targetNodeId })}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-t border-sky-200 bg-sky-50 px-4 py-3">
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-300"
          aria-label={t($ => $.context.promoteAria)}
          data-testid="projected-context-promote"
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
          {t($ => $.context.promote)}
        </button>
        {overCap && <span className="text-xs text-red-700">{t($ => $.context.overCap, { max: MAX_PROMOTE_ITEMS })}</span>}
        <span className="text-xs text-slate-500">{t($ => $.context.selected, { count: selectedCount, max: MAX_PROMOTE_ITEMS })}</span>
      </div>
    </section>
  );
}
