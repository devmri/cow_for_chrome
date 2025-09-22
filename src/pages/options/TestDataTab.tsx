import React, { useCallback, useState } from "react";
import { setLocalKey, StorageKey } from "../../lib/storage";

interface MessageUsage {
  input: number;
  output: number;
  cacheCreation?: number;
  cacheRead?: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string }
  >;
  id?: string;
  model?: string;
  stop_reason?: "tool_use" | "end_turn";
  stop_sequence?: string | null;
  type?: "message";
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

function buildAssistantMessage(
  parts: ConversationMessage["content"],
  usage: MessageUsage,
  isToolUse = false
): ConversationMessage {
  return {
    role: "assistant",
    content: parts,
    id: `msg_staging_${Math.random().toString(36).substring(2, 11)}`,
    model: "claude-sonnet-4-20250514",
    stop_reason: isToolUse ? "tool_use" : "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      input_tokens: usage.input,
      output_tokens: usage.output,
      cache_creation_input_tokens: usage.cacheCreation ?? 0,
      cache_read_input_tokens: usage.cacheRead ?? 0,
    },
  };
}

const TEST_SUMMARY = [
  "Test data is saved to chrome.storage.local",
  "The side panel reads this data on initialization",
  "No direct manipulation of message state",
  "Reload the side panel after loading test data",
];

// 重构前变量名: nr
export function TestDataTab() {
  const [status, setStatus] = useState("");

  const updateStatus = useCallback((message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 3000);
  }, []);

  const loadData = useCallback(async (label: string, messages: ConversationMessage[]) => {
    try {
      await setLocalKey(StorageKey.TEST_DATA_MESSAGES, messages);
      updateStatus(`Loaded ${label} - Reload the side panel to use`);
    } catch (error) {
      updateStatus(`Error loading test data: ${error}`);
    }
  }, [updateStatus]);

  const loadSimpleConversation = () => {
    const messages: ConversationMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "what's on the screen?" }],
      },
      buildAssistantMessage(
        [
          {
            type: "text",
            text: "I'll take a screenshot to see what's currently on the screen.",
          },
        ],
        { input: 147, output: 66, cacheCreation: 10234 }
      ),
    ];
    loadData("Simple Conversation", messages);
  };

  const loadLongConversation = () => {
    const messages: ConversationMessage[] = [];
    for (let i = 0; i < 50; i += 1) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Question ${i + 1}: Tell me about item ${i + 1}`,
          },
        ],
      });
      messages.push(
        buildAssistantMessage(
          [
            {
              type: "text",
              text: `Here's information about item ${i + 1}. `.repeat(50),
            },
          ],
          { input: 2000 + 100 * i, output: 500, cacheRead: 1000 }
        )
      );
    }
    loadData("Long Conversation", messages);
  };

  const loadNearContextLimit = () => {
    const messages: ConversationMessage[] = [];
    const chunk = "This is a test message that simulates a long conversation. ".repeat(1000);
    const iterations = Math.floor(720000 / (2 * chunk.length));
    for (let i = 0; i < iterations; i += 1) {
      messages.push({
        role: "user",
        content: [{ type: "text", text: `Question ${i + 1}: ${chunk}` }],
      });
      messages.push(
        buildAssistantMessage(
          [{ type: "text", text: `Response ${i + 1}: ${chunk}` }],
          { input: 10000 + 500 * i, output: 5000 + 100 * i, cacheRead: 2000 }
        )
      );
    }
    const last = messages[messages.length - 1];
    if (last?.usage) {
      last.usage.input_tokens = 10;
      last.usage.cache_creation_input_tokens = 150000;
      last.usage.cache_read_input_tokens = 30000;
      last.usage.output_tokens = 5000;
    }
    loadData("Near Context Limit", messages);
  };

  const loadToolUseConversation = () => {
    const messages: ConversationMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Navigate to google.com and search for 'weather'",
          },
        ],
      },
      buildAssistantMessage(
        [
          {
            type: "text",
            text: "I'll navigate to Google and search for weather information.",
          },
          {
            type: "tool_use",
            id: "toolu_01_navigate",
            name: "navigate",
            input: { url: "https://google.com" },
          },
        ],
        { input: 200, output: 100, cacheCreation: 5000 },
        true
      ),
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_01_navigate",
            content: "Navigated to google.com",
          },
        ],
      },
      buildAssistantMessage(
        [
          {
            type: "text",
            text: "Now I'll search for 'weather' on Google.",
          },
          {
            type: "tool_use",
            id: "toolu_02_type",
            name: "computer",
            input: { action: "type", text: "weather" },
          },
        ],
        { input: 300, output: 150, cacheRead: 4000 },
        true
      ),
    ];
    loadData("Tool Use Conversation", messages);
  };

  const clearTestData = async () => {
    try {
      await chrome.storage.local.remove(StorageKey.TEST_DATA_MESSAGES);
      updateStatus("Test data cleared");
    } catch (error) {
      updateStatus(`Error clearing test data: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-text-100 mb-4">Test Data Loader (Development Only)</h2>
        <p className="text-sm text-text-300 mb-6">
          Load test conversations for development. Data is stored in chrome.storage.local and will be loaded when the side panel initializes.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadSimpleConversation}
            className="px-4 py-2 bg-accent-main-100 text-oncolor-100 rounded hover:bg-accent-main-200 transition-colors"
          >
            Load Simple Conversation
          </button>
          <button
            type="button"
            onClick={loadLongConversation}
            className="px-4 py-2 bg-accent-main-100 text-oncolor-100 rounded hover:bg-accent-main-200 transition-colors"
          >
            Load Long Conversation
          </button>
          <button
            type="button"
            onClick={loadNearContextLimit}
            className="px-4 py-2 bg-accent-main-100 text-oncolor-100 rounded hover:bg-accent-main-200 transition-colors"
          >
            Load Near Context Limit
          </button>
          <button
            type="button"
            onClick={loadToolUseConversation}
            className="px-4 py-2 bg-accent-main-100 text-oncolor-100 rounded hover:bg-accent-main-200 transition-colors"
          >
            Load Tool Use Conversation
          </button>
          <button
            type="button"
            onClick={clearTestData}
            className="px-4 py-2 bg-danger-100 text-oncolor-100 rounded hover:bg-danger-200 transition-colors"
          >
            Clear Test Data
          </button>
        </div>
        {status && (
          <div className="mt-4 p-3 bg-bg-200 rounded text-sm text-text-200">{status}</div>
        )}
      </div>

      <div className="mt-6 p-4 bg-bg-200 rounded">
        <h3 className="text-sm font-medium text-text-200 mb-2">How it works:</h3>
        <ul className="text-sm text-text-300 space-y-1">
          {TEST_SUMMARY.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
