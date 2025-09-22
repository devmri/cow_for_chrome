// 原始对象: pd

import { ToolAction } from "../../../../lib/permissions";
import { Tool, ToolContext, ToolOutput, PermissionRequest } from "../../types";
import { DomainCategoryCache } from "../domainCache.service";

export const navigateTool: Tool = {
  name: "navigate",
  description: "Navigate to a URL, or go forward/back in browser history",
  parameters: {
    url: {
      type: "string",
      description:
        'The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "forward" to go forward in history or "back" to go back in history.',
    },
  },
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      const { url } = args;
      if (!url) {
        throw new Error("URL parameter is required");
      }
      if (!context?.tabId) {
        throw new Error("No active tab found");
      }

      if (url && !["back", "forward"].includes(url.toLowerCase())) {
        try {
            const category = await DomainCategoryCache.getCategory(url);
            if (category === "category1") {
                return { error: "This site is not allowed due to safety restrictions." };
            }
        } catch(e) {
            // Ignore cache errors
        }
      }

      const tab = await chrome.tabs.get(context.tabId);
      if (!tab.id) {
        throw new Error("Active tab has no ID");
      }

      if (url.toLowerCase() === "back") {
        await chrome.tabs.goBack(tab.id);
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow navigation to settle
        const newTab = await chrome.tabs.get(tab.id);
        return { output: `Navigated back to ${newTab.url}` };
      }

      if (url.toLowerCase() === "forward") {
        await chrome.tabs.goForward(tab.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const newTab = await chrome.tabs.get(tab.id);
        return { output: `Navigated forward to ${newTab.url}` };
      }

      let targetUrl = url;
      if (!targetUrl.match(/^https?:\/\//)) {
        targetUrl = `https://${targetUrl}`;
      }
      try {
        new URL(targetUrl);
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }

      const toolUseId = context.toolUseId;
      const permission = await context.permissionManager.checkPermission(
        targetUrl,
        toolUseId,
      );
      if (permission.allowed) {
        await chrome.tabs.update(tab.id, { url: targetUrl });
        await new Promise(resolve => setTimeout(resolve, 100));
        return { output: `Navigated to ${targetUrl}` };
      } else if (permission.needsPrompt) {
        const request: PermissionRequest = {
          type: "permission_required",
          tool: ToolAction.NAVIGATE,
          url: targetUrl,
          toolUseId,
        };
        return request;
      } else {
        return { error: "Navigation to this domain is not allowed" };
      }
    } catch (error) {
      return {
        error: `Failed to navigate: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (): Promise<any> => ({
    name: "navigate",
    description: "Navigate to a URL, or go forward/back in browser history",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            'The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "forward" to go forward in history or "back" to go back in history.',
        },
      },
      required: ["url"],
    },
  }),
};