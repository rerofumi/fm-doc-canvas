import { create } from "zustand";
import { hasWailsRuntime, wailsBridge } from "../services/wailsBridge";
import type { AppConfig } from "../types/config";
import { useToastStore } from "./useToastStore";

export function createDefaultConfig(): AppConfig {
  return {
    llm: {
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "",
      systemPrompt: "",
    },
    generation: {
      summaryMaxChars: 100,
    },
    imageGen: {
      provider: "openrouter",
      downloadPath: "Image",
      openrouter: {
        baseURL: "https://openrouter.ai/api/v1",
        model: "",
        apiKey: "",
      },
      openai: {
        baseURL: "https://api.openai.com/v1",
        model: "",
        apiKey: "",
      },
      google: {
        model: "",
        apiKey: "",
      },
      xai: {
        model: "",
        apiKey: "",
      },
    },
  };
}

interface ConfigState {
  config: AppConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  loadConfig: () => Promise<AppConfig | null>;
  saveConfig: (nextConfig: AppConfig) => Promise<boolean>;
  setConfigLocal: (config: AppConfig) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  isLoading: false,
  isSaving: false,
  loadError: null,

  loadConfig: async () => {
    if (!hasWailsRuntime()) {
      const fallback = createDefaultConfig();
      set({ config: fallback, isLoading: false, loadError: null });
      return fallback;
    }

    set({ isLoading: true, loadError: null });
    try {
      const loaded = await wailsBridge.getConfig();
      set({ config: loaded, isLoading: false, loadError: null });
      return loaded;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "設定ファイルの読み込みに失敗しました";
      set({ isLoading: false, loadError: message });
      useToastStore
        .getState()
        .warning(`設定の読み込みに失敗しました（ファイルは上書きされていません）: ${message}`);
      return null;
    }
  },

  saveConfig: async (nextConfig) => {
    if (!hasWailsRuntime()) {
      set({ config: nextConfig });
      return true;
    }

    set({ isSaving: true });
    try {
      await wailsBridge.saveConfig(nextConfig);
      set({ config: nextConfig, isSaving: false, loadError: null });
      useToastStore.getState().success("設定を保存しました");
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "設定の保存に失敗しました";
      set({ isSaving: false });
      useToastStore.getState().error(`設定の保存に失敗しました: ${message}`);
      return false;
    }
  },

  setConfigLocal: (config) => {
    set({ config });
  },
}));
