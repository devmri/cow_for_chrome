// 原始对象: md

import { ToolAction } from "../../../../lib/permissions";
import { Tool, ToolContext, ToolOutput, PermissionRequest } from "../../types";

interface ReadPageArgs {
  filter?: "interactive";
}

interface AccessibilityTreeResult {
  pageContent: string;
  viewport: {
    width: number;
    height: number;
  };
}

export const readPageTool: Tool = {
  name: "read_page",
  description:
    "Get an accessibility tree representation of visible elements on the page. Can optionally filter for only interactive elements. Returns a structured tree that represents how screen readers see the page content.",
  parameters: {
    filter: {
      type: "string",
      enum: ["interactive"],
      description:
        'Filter elements: "interactive" for buttons/links/inputs (default: all visible elements)',
    },
  },
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      const { filter } = (args || {}) as ReadPageArgs;
      if (!context?.tabId) {
        throw new Error("No active tab found");
      }
      const tab = await chrome.tabs.get(context.tabId);
      if (!tab.id) {
        throw new Error("Active tab has no ID");
      }
      const url = tab.url;
      if (!url) {
        throw new Error("No URL available for active tab");
      }

      const toolUseId = context.toolUseId;
      const permission = await context.permissionManager.checkPermission(
        url,
        toolUseId,
      );
      if (!permission.allowed) {
        if (permission.needsPrompt) {
          const request: PermissionRequest = {
            type: "permission_required",
            tool: ToolAction.READ_PAGE_CONTENT,
            url,
            toolUseId,
          };
          return request;
        }
        return {
          error: "Permission denied for reading pages on this domain",
        };
      }
      
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "HIDE_FOR_TOOL_USE" });
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (e) {
          // ignore
      }

      try {
        const injectionResults = await chrome.scripting.executeScript<
          [string | null],
          AccessibilityTreeResult
        >({
          target: { tabId: tab.id },
          func: (filter) => {
            if (typeof (window as any).__generateAccessibilityTree !== "function") {
              throw new Error(
                "Accessibility tree function not found. Please refresh the page.",
              );
            }
            return (window as any).__generateAccessibilityTree(filter);
          },
          args: [filter || null],
        });

        if (!injectionResults || injectionResults.length === 0) {
          throw new Error("No results returned from page script");
        }
        const firstResult = injectionResults[0];
        if ("error" in firstResult && (firstResult as any).error) {
          throw new Error(
            `Script execution failed: ${
              (firstResult as any).error.message || "Unknown error"
            }`,
          );
        }
        if (!firstResult.result) {
          throw new Error("Page script returned empty result");
        }

        const accessibilityData = firstResult.result;
        const viewportInfo = `Viewport: ${accessibilityData.viewport.width}x${accessibilityData.viewport.height}`;

        return { output: `${accessibilityData.pageContent}\n\n${viewportInfo}` };
      } finally {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "SHOW_AFTER_TOOL_USE" });
        } catch (e) {
            // ignore
        }
      }
    } catch (error) {
      return {
        error: `Failed to read page: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (): Promise<any> => ({
    name: "read_page",
    description:
      "Get an accessibility tree representation of visible elements on the page. Only returns elements that are visible in the viewport. Optionally filter for only interactive elements.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["interactive"],
          description:
            'Filter elements: "interactive" for buttons/links/inputs only (default: all visible elements)',
        },
      },
      required: [],
    },
  }),
};