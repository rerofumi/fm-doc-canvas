import React, { useState, useEffect } from "react";
import { X, Save, Settings, ShieldCheck, Cpu, Type } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { AppConfig } from "../../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, saveConfig } = useAppStore();
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await saveConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 font-bold text-gray-700">
            <Settings size={18} className="text-blue-500" />
            Application Settings
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* LLM Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={14} />
              LLM Configuration
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                <input
                  type="text"
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={localConfig.llm.baseURL}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    llm: { ...localConfig.llm, baseURL: e.target.value }
                  })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                <input
                  type="text"
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={localConfig.llm.model}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    llm: { ...localConfig.llm, model: e.target.value }
                  })}
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-amber-500" />
                  API Key
                </label>
                <input
                  type="password"
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={localConfig.llm.apiKey || ""}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    llm: { ...localConfig.llm, apiKey: e.target.value }
                  })}
                  placeholder="sk-..."
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Stored locally. Never included in canvas JSON files.
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Generation Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Type size={14} />
              Generation Defaults
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary Max Characters
              </label>
              <input
                type="number"
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={localConfig.generation.summaryMaxChars}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  generation: { ...localConfig.generation, summaryMaxChars: parseInt(e.target.value) || 100 }
                })}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md flex items-center gap-2 transition-all"
          >
            <Save size={16} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
