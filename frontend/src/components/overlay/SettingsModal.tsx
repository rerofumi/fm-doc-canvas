import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { createDefaultConfig, useConfigStore } from "../../store/useConfigStore";
import type { AppConfig, ImageGenProviderId } from "../../types/config";

type SettingsTab = "llm" | "image" | "canvas";

const PROVIDER_META: Array<{
  id: ImageGenProviderId;
  label: string;
  hasBaseURL: boolean;
  defaultBaseURL?: string;
  defaultModel: string;
}> = [
  {
    id: "openrouter",
    label: "OpenRouter",
    hasBaseURL: true,
    defaultBaseURL: "https://openrouter.ai/api/v1",
    defaultModel: "sourceful/riverflow-v2-fast",
  },
  {
    id: "openai",
    label: "OpenAI",
    hasBaseURL: true,
    defaultBaseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-image-1.5",
  },
  {
    id: "google",
    label: "Google",
    hasBaseURL: false,
    defaultModel: "gemini-2.5-flash-image",
  },
  {
    id: "xai",
    label: "xAI",
    hasBaseURL: false,
    defaultModel: "grok-imagine-image",
  },
];

function cloneConfig(cfg: AppConfig): AppConfig {
  return {
    llm: { ...cfg.llm },
    generation: { ...cfg.generation },
    imageGen: {
      provider: cfg.imageGen.provider,
      downloadPath: cfg.imageGen.downloadPath,
      openrouter: { ...cfg.imageGen.openrouter },
      openai: { ...cfg.imageGen.openai },
      google: { ...cfg.imageGen.google },
      xai: { ...cfg.imageGen.xai },
    },
  };
}

export function SettingsModal() {
  const isSettingsOpen = useCanvasStore((s) => s.isSettingsOpen);
  const isClearConfirmOpen = useCanvasStore((s) => s.isClearConfirmOpen);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const setClearConfirmOpen = useCanvasStore((s) => s.setClearConfirmOpen);
  const setSelectedImageProvider = useCanvasStore(
    (s) => s.setSelectedImageProvider,
  );

  const config = useConfigStore((s) => s.config);
  const isSaving = useConfigStore((s) => s.isSaving);
  const saveConfig = useConfigStore((s) => s.saveConfig);

  const [activeTab, setActiveTab] = useState<SettingsTab>("llm");
  const [activeProviderTab, setActiveProviderTab] =
    useState<ImageGenProviderId>("openrouter");
  const [form, setForm] = useState<AppConfig>(() =>
    cloneConfig(config ?? createDefaultConfig()),
  );
  const [showLLMKey, setShowLLMKey] = useState(false);
  const [showProviderKeys, setShowProviderKeys] = useState<
    Record<ImageGenProviderId, boolean>
  >({
    openrouter: false,
    openai: false,
    google: false,
    xai: false,
  });

  useEffect(() => {
    if (!isSettingsOpen) return;
    const base = config ?? createDefaultConfig();
    setForm(cloneConfig(base));
    setActiveProviderTab(base.imageGen.provider);
    setShowLLMKey(false);
    setShowProviderKeys({
      openrouter: false,
      openai: false,
      google: false,
      xai: false,
    });
  }, [isSettingsOpen, config]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isClearConfirmOpen) {
        e.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, isClearConfirmOpen, setSettingsOpen]);

  if (!isSettingsOpen) {
    return null;
  }

  const handleSave = async () => {
    const ok = await saveConfig(form);
    if (ok) {
      setSelectedImageProvider(form.imageGen.provider);
      setSettingsOpen(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500";

  const activeProviderMeta =
    PROVIDER_META.find((p) => p.id === activeProviderTab) ?? PROVIDER_META[0];
  const currentProviderCfg = form.imageGen[activeProviderTab];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="設定"
      onClick={() => {
        if (!isClearConfirmOpen) setSettingsOpen(false);
      }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-base font-semibold">設定</h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="設定を閉じる"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 border-b px-6 pt-3"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-muted)",
          }}
        >
          {(
            [
              { id: "llm", label: "LLM 設定" },
              { id: "image", label: "画像生成" },
              { id: "canvas", label: "キャンバス管理" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg border-b-2 px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "border-blue-600 bg-white text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "llm" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Base URL
                </label>
                <input
                  type="text"
                  value={form.llm.baseURL}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      llm: { ...prev.llm, baseURL: e.target.value },
                    }))
                  }
                  placeholder="https://api.openai.com/v1"
                  className={inputClass}
                  style={{ borderColor: "var(--border-subtle)" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Model
                </label>
                <input
                  type="text"
                  value={form.llm.model}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      llm: { ...prev.llm, model: e.target.value },
                    }))
                  }
                  placeholder="gpt-4o-mini"
                  className={inputClass}
                  style={{ borderColor: "var(--border-subtle)" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showLLMKey ? "text" : "password"}
                    value={form.llm.apiKey}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        llm: { ...prev.llm, apiKey: e.target.value },
                      }))
                    }
                    placeholder="sk-... (ローカル LLM の場合は空欄可)"
                    className={`${inputClass} pr-10`}
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLLMKey((v) => !v)}
                    aria-label={showLLMKey ? "API Key を隠す" : "API Key を表示"}
                    className="absolute right-2 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showLLMKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  System Prompt
                </label>
                <textarea
                  rows={3}
                  value={form.llm.systemPrompt}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      llm: { ...prev.llm, systemPrompt: e.target.value },
                    }))
                  }
                  placeholder="空欄時は既定のシステムプロンプトを使用します"
                  className={inputClass}
                  style={{ borderColor: "var(--border-subtle)" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  サマリー最大文字数目安
                </label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={form.generation.summaryMaxChars}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      generation: {
                        ...prev.generation,
                        summaryMaxChars: Number(e.target.value) || 100,
                      },
                    }))
                  }
                  className={`${inputClass} max-w-[160px]`}
                  style={{ borderColor: "var(--border-subtle)" }}
                />
              </div>
            </div>
          )}

          {activeTab === "image" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    デフォルトプロバイダー
                  </label>
                  <select
                    value={form.imageGen.provider}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        imageGen: {
                          ...prev.imageGen,
                          provider: e.target.value as ImageGenProviderId,
                        },
                      }))
                    }
                    className={inputClass}
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    {PROVIDER_META.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    画像保存先ディレクトリ
                  </label>
                  <input
                    type="text"
                    value={form.imageGen.downloadPath}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        imageGen: {
                          ...prev.imageGen,
                          downloadPath: e.target.value,
                        },
                      }))
                    }
                    placeholder="Image/"
                    className={inputClass}
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </div>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-surface-muted)",
                }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    プロバイダー別設定（全4プロバイダーを保持）
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
                    {PROVIDER_META.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveProviderTab(p.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          activeProviderTab === p.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {activeProviderMeta.hasBaseURL &&
                    "baseURL" in currentProviderCfg && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          {activeProviderMeta.label} Base URL
                        </label>
                        <input
                          type="text"
                          value={currentProviderCfg.baseURL}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              imageGen: {
                                ...prev.imageGen,
                                [activeProviderTab]: {
                                  ...prev.imageGen[activeProviderTab],
                                  baseURL: val,
                                },
                              },
                            }));
                          }}
                          placeholder={activeProviderMeta.defaultBaseURL}
                          className={inputClass}
                          style={{ borderColor: "var(--border-subtle)" }}
                        />
                      </div>
                    )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {activeProviderMeta.label} Model
                    </label>
                    <input
                      type="text"
                      value={currentProviderCfg.model}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          imageGen: {
                            ...prev.imageGen,
                            [activeProviderTab]: {
                              ...prev.imageGen[activeProviderTab],
                              model: val,
                            },
                          },
                        }));
                      }}
                      placeholder={activeProviderMeta.defaultModel}
                      className={inputClass}
                      style={{ borderColor: "var(--border-subtle)" }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {activeProviderMeta.label} API Key
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={
                          showProviderKeys[activeProviderTab]
                            ? "text"
                            : "password"
                        }
                        value={currentProviderCfg.apiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            imageGen: {
                              ...prev.imageGen,
                              [activeProviderTab]: {
                                ...prev.imageGen[activeProviderTab],
                                apiKey: val,
                              },
                            },
                          }));
                        }}
                        placeholder={`${activeProviderMeta.label} の API Key`}
                        className={`${inputClass} pr-10`}
                        style={{ borderColor: "var(--border-subtle)" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowProviderKeys((prev) => ({
                            ...prev,
                            [activeProviderTab]: !prev[activeProviderTab],
                          }))
                        }
                        aria-label={
                          showProviderKeys[activeProviderTab]
                            ? "API Key を隠す"
                            : "API Key を表示"
                        }
                        className="absolute right-2 rounded p-1 text-slate-400 hover:text-slate-700"
                      >
                        {showProviderKeys[activeProviderTab] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "canvas" && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800">
                    Danger Zone — キャンバスを初期化
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-red-700">
                    現在のキャンバス上のすべてのノード・エッジ・選択状態・編集中内容を消去します。保存済みの画像ファイル自体はディスク上に残ります。
                  </p>
                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: "var(--danger)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>キャンバスを初期化（Clear Canvas）</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t px-6 py-3.5"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-muted)",
          }}
        >
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="rounded-lg border bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isSaving ? "保存中..." : "保存"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
