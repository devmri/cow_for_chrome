// 原始对象: dd

import { ToolAction } from "../../../../lib/permissions";
import { Tool, ToolContext, ToolOutput, PermissionRequest } from "../../types";

interface PageTextResult {
  text: string;
  source: string;
  title: string;
  url: string;
}

export const getPageTextTool: Tool = {
  name: "get_page_text",
  description:
    "Extract raw text content from the page, prioritizing article content. Ideal for reading articles, blog posts, or other text-heavy pages. Returns plain text without HTML formatting.",
  parameters: {},
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      if (!context?.tabId) {
        throw new Error("No active tab found");
      }
      const url = (await chrome.tabs.get(context.tabId)).url;
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
          error: "Permission denied for reading page content on this domain",
        };
      }

      try {
        await chrome.tabs.sendMessage(context.tabId, { type: "HIDE_FOR_TOOL_USE" });
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (e) {
        // content script may not be available
      }

      try {
        const injectionResults = await chrome.scripting.executeScript<
          [],
          PageTextResult | undefined
        >({
          target: { tabId: context.tabId },
          func: () => {
            const selectors = [
              "article",
              "main",
              '[class*="articleBody"]',
              '[class*="article-body"]',
              '[class*="post-content"]',
              '[class*="entry-content"]',
              '[class*="content-body"]',
              '[role="main"]',
              ".content",
              "#content",
            ];

            let mainContentElement: Element | null = null;

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                let largestElement = elements[0];
                let largestLength = 0;
                elements.forEach(el => {
                    const textLength = el.textContent?.length || 0;
                    if (textLength > largestLength) {
                        largestLength = textLength;
                        largestElement = el;
                    }
                });
                mainContentElement = largestElement;
                break;
              }
            }

            if (!mainContentElement) {
              return undefined;
            }

            const text = (mainContentElement.textContent || "")
              .replace(/\s+/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
              
            return {
              text: text,
              source: mainContentElement.tagName.toLowerCase(),
              title: document.title,
              url: window.location.href,
            };
          },
        });

        if (!injectionResults || injectionResults.length === 0) {
          throw new Error(
            "No main text content found. The content might be visual content only, or rendered in a canvas element.",
          );
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

        const pageTextData = firstResult.result;
        return {
          output: `Title: ${pageTextData.title}\nURL: ${pageTextData.url}\nSource element: <${pageTextData.source}>\n---\n${pageTextData.text}`,
        };
      } finally {
        try {
          await chrome.tabs.sendMessage(context.tabId, { type: "SHOW_AFTER_TOOL_USE" });
        } catch (e) {
            // ignore
        }
      }
    } catch (error) {
      return {
        error: `Failed to extract page text: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (): Promise<any> => ({
    name: "get_page_text",
    description:
      "Extract raw text content from the page, prioritizing article content. Ideal for reading articles, blog posts, or other text-heavy pages. Returns plain text without HTML formatting.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  }),
};
