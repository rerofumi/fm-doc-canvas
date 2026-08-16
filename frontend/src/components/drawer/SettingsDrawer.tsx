import React, { useState, useEffect, useRef } from "react";
import { X, Trash2, Save, FolderOpen, Download, Upload } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { AppConfig, OpenAIConfig, GoogleConfig, XAIConfig } from "../../types";

const ensureImageProviderConfigs = (
  imageGen: AppConfig["imageGen"],
): AppConfig["imageGen"] => ({
  ...imageGen,
  openrouter: imageGen.openrouter || {
    baseURL: "https://openrouter.ai/api/v1",
    model: "sourceful/riverflow-v2-fast",
    apiKey: "",
  },
  openai: imageGen.openai || {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-image-1.5",
    apiKey: "",
  },
  google: imageGen.google || {
    model: "gemini-2.5-flash-image",
    apiKey: "",
  },
  xai: imageGen.xai || {
    model: "grok-imagine-image",
    apiKey: "",
  },
});

type FocusTarget = HTMLElement | null;

type SettingsDrawerProps = {
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
};

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  returnFocusRef,
  fallbackFocusRef,
}) => {
  const {
    config,
    setConfig,
    saveConfig,
    loadConfig,
    saveCanvas,
    loadCanvas,
    dispatch,
    newWorkspace,
    setSettingsOpen,
    isSettingsOpen,
  } = useAppStore();

  const [localConfig, setLocalConfig] = useState(config);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const clearCancelRef = useRef<HTMLButtonElement>(null);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isClearDialogOpen) clearCancelRef.current?.focus();
  }, [isClearDialogOpen]);

  const focusVisibleTarget = (target: FocusTarget) => {
    const isVisible = (candidate: FocusTarget): candidate is HTMLElement => {
      if (!candidate?.isConnected) return false;
      const style = window.getComputedStyle(candidate);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        candidate.getClientRects().length > 0
      );
    };

    if (isVisible(target)) {
      target.focus();
      return;
    }

    const fallback = fallbackFocusRef?.current ??
      document.querySelector<HTMLElement>('[data-testid="canvas-root"]');
    if (isVisible(fallback)) fallback.focus();
  };

  const closeClearDialog = (
    reason: "cancel" | "escape" | "overlay" | "confirm" = "cancel",
  ) => {
    setIsClearDialogOpen(false);
    if (reason === "confirm") {
      setSettingsOpen(false);
      // The drawer closes after confirmation.  Return to a visible application
      // control, never to the transformed/offscreen drawer trigger.
      window.setTimeout(
        () => focusVisibleTarget(returnFocusRef?.current ?? null),
        0,
      );
      return;
    }

    // Cancel/Escape/overlay leave Settings open and return to its trigger.
    window.setTimeout(() => clearTriggerRef.current?.focus(), 0);
  };

  // Load config when component mounts
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Update local config when global config changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSaveConfig = async () => {
    try {
      await saveConfig(localConfig);
      setSettingsOpen(false); // Close the drawer after saving
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Failed to save configuration");
    }
  };

  const handleSaveCanvas = async () => {
    try {
      await saveCanvas();
      setSettingsOpen(false); // Close the drawer after saving
    } catch (error) {
      console.error("Failed to save canvas:", error);
      alert("Failed to save canvas");
    }
  };

  const handleLoadCanvas = async () => {
    try {
      await loadCanvas();
      setSettingsOpen(false); // Close the drawer after loading
    } catch (error) {
      console.error("Failed to load canvas:", error);
      alert("Failed to load canvas");
    }
  };

  const handleClearCanvas = () => {
    dispatch({ type: "clearCanvas" });
    closeClearDialog("confirm");
  };

  const handleNewWorkspace = () => {
    newWorkspace();
    setSettingsOpen(false);
  };

  return (
    <>
      {/* Settings Drawer */}
      <div
        data-testid="settings-drawer"
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-gray-200 ${
          isSettingsOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "400px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="m19 12-6 0m-6 0H5" />
              <path d="M19.8 8.2l-3.5 3.5m-11.6-3.5l3.5 3.5" />
            </svg>
            Settings
          </h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* File Operations */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FolderOpen size={16} />
              File Operations
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveCanvas}
                aria-label="Save Canvas"
                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download size={20} className="text-blue-500 mb-1" />
                <span className="text-xs font-medium">Save Canvas</span>
              </button>
              <button
                onClick={handleLoadCanvas}
                aria-label="Load Canvas"
                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload size={20} className="text-green-500 mb-1" />
                <span className="text-xs font-medium">Load Canvas</span>
              </button>
            </div>
          </div>

          {/* LLM Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
              LLM Configuration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={localConfig.llm.baseURL}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      llm: { ...localConfig.llm, baseURL: e.target.value },
                    })
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={localConfig.llm.model}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      llm: { ...localConfig.llm, model: e.target.value },
                    })
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={localConfig.llm.apiKey}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      llm: { ...localConfig.llm, apiKey: e.target.value },
                    })
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  System Prompt
                </label>
                <textarea
                  value={localConfig.llm.systemPrompt || ""}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      llm: { ...localConfig.llm, systemPrompt: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 min-h-[80px]"
                  placeholder="Instructions that guide the model's behavior..."
                />
              </div>
            </div>
          </div>

          {/* Image Generation Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              Image Generation
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Provider
                </label>
                <select
                  value={localConfig.imageGen.provider}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      imageGen: {
                        ...ensureImageProviderConfigs(localConfig.imageGen),
                        provider: e.target.value,
                      },
                    })
                  }
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option>
                  <option value="xai">xAI</option>
                </select>
              </div>
              {/* OpenRouter Settings */}
              {localConfig.imageGen.provider === "openrouter" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.openrouter?.baseURL || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openrouter: {
                              baseURL: e.target.value,
                              model:
                                localConfig.imageGen.openrouter?.model || "",
                              apiKey:
                                localConfig.imageGen.openrouter?.apiKey || "",
                            },
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.openrouter?.model || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openrouter: {
                              baseURL:
                                localConfig.imageGen.openrouter?.baseURL || "",
                              model: e.target.value,
                              apiKey:
                                localConfig.imageGen.openrouter?.apiKey || "",
                            },
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={localConfig.imageGen.openrouter?.apiKey || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openrouter: {
                              baseURL:
                                localConfig.imageGen.openrouter?.baseURL || "",
                              model:
                                localConfig.imageGen.openrouter?.model || "",
                              apiKey: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                </>
              )}

              {/* Stability AI Settings */}

              {/* OpenAI Settings */}
              {localConfig.imageGen.provider === "openai" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.openai?.baseURL || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openai: {
                              ...localConfig.imageGen.openai,
                              baseURL: e.target.value,
                            } as OpenAIConfig,
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.openai?.model || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openai: {
                              ...localConfig.imageGen.openai,
                              model: e.target.value,
                            } as OpenAIConfig,
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={localConfig.imageGen.openai?.apiKey || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            openai: {
                              ...localConfig.imageGen.openai,
                              apiKey: e.target.value,
                            } as OpenAIConfig,
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                </>
              )}

              {/* Google Settings */}
              {localConfig.imageGen.provider === "google" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.google?.model || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            google: {
                              ...localConfig.imageGen.google,
                              model: e.target.value,
                            } as GoogleConfig,
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={localConfig.imageGen.google?.apiKey || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            google: {
                              ...localConfig.imageGen.google,
                              apiKey: e.target.value,
                            } as GoogleConfig,
                          },
                        })
                      }
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                </>
              )}

              {/* xAI Settings */}
              {localConfig.imageGen.provider === "xai" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={localConfig.imageGen.xai?.model || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            xai: {
                              ...localConfig.imageGen.xai,
                              model: e.target.value,
                            } as XAIConfig,
                          },
                        })
                      }
                      placeholder="grok-imagine-image"
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={localConfig.imageGen.xai?.apiKey || ""}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          imageGen: {
                            ...localConfig.imageGen,
                            xai: {
                              ...localConfig.imageGen.xai,
                              apiKey: e.target.value,
                            } as XAIConfig,
                          },
                        })
                      }
                      placeholder="xai-..."
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                </>
              )}

              {/* Local Settings */}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Download Path
                </label>
                <input
                  type="text"
                  value={localConfig.imageGen.downloadPath}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      imageGen: {
                        ...localConfig.imageGen,
                        downloadPath: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-3">Web Search</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
                <select
                  aria-label="Web Search provider"
                  value={localConfig.webSearch?.provider || "ollama"}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      webSearch: {
                        provider: e.target.value as "ollama" | "kagi" | "brave",
                        ollama: localConfig.webSearch?.ollama || { apiKey: "" },
                        kagi: localConfig.webSearch?.kagi || { apiKey: "" },
                        brave: localConfig.webSearch?.brave || { apiKey: "" },
                      },
                    })
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="ollama">Ollama</option>
                  <option value="kagi">Kagi</option>
                  <option value="brave">Brave</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                <input
                  type="password"
                  aria-label="Web Search API key"
                  value={
                    (localConfig.webSearch?.provider === "kagi"
                      ? localConfig.webSearch?.kagi?.apiKey
                      : localConfig.webSearch?.provider === "brave"
                        ? localConfig.webSearch?.brave?.apiKey
                        : localConfig.webSearch?.ollama?.apiKey) || ""
                  }
                  onChange={(e) => {
                    const provider = localConfig.webSearch?.provider || "ollama";
                    const current = {
                      provider,
                      ollama: localConfig.webSearch?.ollama || { apiKey: "" },
                      kagi: localConfig.webSearch?.kagi || { apiKey: "" },
                      brave: localConfig.webSearch?.brave || { apiKey: "" },
                    };
                    setLocalConfig({
                      ...localConfig,
                      webSearch: {
                        ...current,
                        [provider]: { apiKey: e.target.value },
                      },
                    });
                  }}
                  placeholder="search api key"
                  className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          {/* Generation Settings */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12" />
                <path d="m8 11 4 4 4-4" />
              </svg>
              Generation Settings
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Summary Max Characters
              </label>
              <input
                type="number"
                value={localConfig.generation.summaryMaxChars}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    generation: {
                      ...localConfig.generation,
                      summaryMaxChars: parseInt(e.target.value) || 100,
                    },
                  })
                }
                className="w-full p-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Dangerous Zone */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              Dangerous Zone
            </h3>
            <button
              ref={clearTriggerRef}
              onClick={() => setIsClearDialogOpen(true)}
              aria-label="Clear Canvas"
              className="w-full flex items-center justify-center gap-2 p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Trash2 size={16} />
              Clear Canvas
            </button>
            <button
              onClick={handleNewWorkspace}
              aria-label="New Workspace"
              className="mt-2 w-full flex items-center justify-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 size={16} />
              New Workspace
            </button>
            <p className="text-xs text-red-600 mt-2">
              Clear Canvas removes the current nodes and edges. New Workspace
              starts a fresh workspace and clears the current dialogue.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button
            onClick={handleSaveConfig}
            className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            Save Settings
          </button>
        </div>
      </div>
      {isClearDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeClearDialog("overlay");
          }}
        >
          <div
            ref={clearDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-canvas-title"
            aria-describedby="clear-canvas-description"
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeClearDialog("escape");
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                clearDialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              );
              if (!focusable.length) return;
              const index = focusable.indexOf(document.activeElement as HTMLElement);
              const next = event.shiftKey
                ? (index - 1 + focusable.length) % focusable.length
                : (index + 1) % focusable.length;
              event.preventDefault();
              focusable[next]?.focus();
            }}
          >
            <h2 id="clear-canvas-title" className="text-base font-bold text-gray-800">
              Clear Canvas
            </h2>
            <p id="clear-canvas-description" className="mt-2 text-sm text-gray-600">
              現在の Canvas の node と relation を削除します。Undo で復元できます。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                ref={clearCancelRef}
                onClick={() => closeClearDialog("cancel")}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsDrawer;
