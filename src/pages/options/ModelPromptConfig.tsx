import React, { useEffect, useState } from "react";
import { getLocalValue, setLocalKey, StorageKey } from "../../lib/storage";
import { Bug } from "lucide-react";

export function ModelPromptConfig({
  selectedModel,
  setSelectedModel,
  availableModels,
  loadingModels,
  modelsError,
  systemPrompt,
  setSystemPrompt,
  debugMode,
  setDebugMode,
  onModelSave,
  onPromptSave,
  onResetPrompt,
  saved,
  setSaved,
  allowEditSystemPrompt,
}: {
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  availableModels: string[];
  loadingModels: boolean;
  modelsError?: string;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;
  onModelSave: () => Promise<void> | void;
  onPromptSave: () => Promise<void> | void;
  onResetPrompt: () => void;
  saved: boolean;
  setSaved: (v: boolean) => void;
  allowEditSystemPrompt: boolean;
}) {
  const [showTraceIds, setShowTraceIds] = useState(false);

  useEffect(() => {
    getLocalValue<boolean>(StorageKey.SHOW_TRACE_IDS).then((value) => {
      if (value !== undefined) setShowTraceIds(value);
    });
  }, []);

  return (
    <div className="max-w-2xl">
      <h2 className="font-xl-bold text-text-100 mb-4">Model & Prompt Configuration</h2>
      <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-large-bold text-text-100">Model Selection</h3>
            <div>
              <div className="mb-2">
                <label htmlFor="modelSelect" className="font-label block text-text-200">
                  Choose Claude Model
                </label>
              </div>
              {modelsError && (
                <div className="mb-3 p-3 bg-danger-900 border border-danger-200 rounded-md">
                  <p className="font-base-sm text-danger-000">Error: {modelsError}</p>
                </div>
              )}
              <select
                id="modelSelect"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={availableModels.length === 0}
                className="w-full px-3 py-2 border border-border-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-main-200 disabled:bg-bg-200 disabled:text-text-400 bg-bg-000 text-text-100 font-base"
              >
                {availableModels.length === 0 ? (
                  <option value="">{loadingModels ? "Loading models..." : "No models available"}</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-2 font-caption text-text-300">
                Select from models available to you
              </p>
            </div>
            <button
              onClick={onModelSave}
              disabled={!selectedModel}
              className="w-full bg-accent-main-200 text-oncolor-100 py-2 px-4 rounded-md hover:bg-accent-main-100 focus:outline-none focus:ring-2 focus:ring-accent-main-200 disabled:bg-bg-400 disabled:cursor-not-allowed font-button-lg"
            >
              Save Model Selection
            </button>
          </div>

        {allowEditSystemPrompt && <div className="border-t border-border-300" />}

        {/* 系统提示 */}
        {allowEditSystemPrompt && (
          <div className="space-y-4">
            <h3 className="font-large-bold text-text-100">System Prompt</h3>
            <div>
              <label htmlFor="systemPrompt" className="font-label block mb-2 text-text-200">
                Customize System Prompt
              </label>
              <textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter custom system prompt..."
                className="w-full px-3 py-2 border border-border-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-main-200 font-code bg-bg-000 text-text-100"
                rows={12}
              />
              <p className="mt-2 font-caption text-text-300">
                Customize the instructions given to Cow for browser automation tasks.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onPromptSave}
                className="flex-1 bg-text-100 text-oncolor-100 py-2 px-4 rounded-md hover:bg-text-200 focus:outline-none focus:ring-2 focus:ring-accent-main-200 font-button-lg"
              >
                Save System Prompt
              </button>
              <button
                onClick={onResetPrompt}
                className="px-4 py-2 border border-border-200 rounded-md hover:bg-bg-200 focus:outline-none focus:ring-2 focus:ring-border-100 text-text-200 font-button"
              >
                Reset to Default
              </button>
            </div>
            </div>
          )}

        <div className="border-t border-border-300" />

        {/* 调试设置 */}
        <div className="space-y-4">
          <h3 className="font-large-bold text-text-100 flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Debug Settings
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={async (e) => {
                  const v = e.target.checked;
                  setDebugMode(v);
                  await setLocalKey(StorageKey.DEBUG_MODE, v);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }}
                className="w-4 h-4 text-accent-main-200 bg-bg-000 border-border-200 rounded focus:ring-accent-main-200 focus:ring-2"
              />
              <div>
                <p className="font-base text-text-100">Show tool result details</p>
                <p className="font-caption text-text-300">
                  Enable expandable tool result blocks to view parameters and outputs
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showTraceIds}
                onChange={async (e) => {
                  const value = e.target.checked;
                  setShowTraceIds(value);
                  await setLocalKey(StorageKey.SHOW_TRACE_IDS, value);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }}
                className="w-4 h-4 text-accent-main-200 bg-bg-000 border-border-200 rounded focus:ring-accent-main-200 focus:ring-2"
              />
              <div>
                <p className="font-base text-text-100">Show trace IDs</p>
                <p className="font-caption text-text-300">
                  Display trace IDs at the beginning of each response stream
                </p>
              </div>
            </label>
          </div>
        </div>

        {saved && <div className="font-base-sm text-text-200">Settings saved successfully!</div>}
      </div>
    </div>
  );
}
