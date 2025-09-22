import { ToolAction } from "../../../../lib/permissions";
import { Tool, ToolContext, ToolOutput, PermissionRequest } from "../../types";

interface AccessibilityTreeResult {
  pageContent: string;
  // 其他可能的字段
}

interface FoundElement {
  ref: string;
  role: string;
  name: string;
  type?: string;
  coordinates?: [number, number];
  description?: string;
}

export const findTool: Tool = {
  name: "find",
  description:
    'Find elements on the page using natural language. Can search for elements by their purpose (e.g., "search bar", "login button") or by text content (e.g., "organic mango product"). Returns up to 20 matching elements with references and coordinates that can be used with other tools. If more than 20 matches exist, you\'ll be notified to use a more specific query.',
  parameters: {
    query: {
      type: "string",
      description:
        'Natural language description of what to find (e.g., "search bar", "add to cart button", "product title containing organic")',
      required: true,
    },
  },
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      const { query } = args;
      if (!query) {
        throw new Error("Query parameter is required");
      }
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

      const injectionResults = await chrome.scripting.executeScript<
        [],
        AccessibilityTreeResult
      >({
        target: { tabId: tab.id },
        func: () => {
          if (typeof (window as any).__generateAccessibilityTree !== "function") {
            throw new Error(
              "Accessibility tree function not found. Please refresh the page.",
            );
          }
          return (window as any).__generateAccessibilityTree("all");
        },
        args: [],
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

      if (!context.createAnthropicMessage) {
        throw new Error(
          "Anthropic client not available. Please check your API configuration.",
        );
      }

      const llmResponse = await context.createAnthropicMessage({
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `You are helping find elements on a web page. The user wants to find: "${query}"\n\nHere is the accessibility tree of the page:\n${accessibilityData.pageContent}\n\nFind ALL elements that match the user's query. Return up to 20 most relevant matches, ordered by relevance.\n\nEach element in the accessibility tree includes coordinates in the format (x=X,y=Y). Extract these coordinates and include them in your response.\n\nReturn your findings in this exact format (one line per matching element):\n\nFOUND: <total_number_of_matching_elements>\nSHOWING: <number_shown_up_to_20>\n---\nref_X | role | name | type | x,y | reason why this matches\nref_Y | role | name | type | x,y | reason why this matches\n...\n\nIf there are more than 20 matches, add this line at the end:\nMORE: Use a more specific query to see additional results\n\nIf no matching elements are found, return only:\nFOUND: 0\nERROR: explanation of why no elements were found`,
          },
        ],
      });

      const responseContent = llmResponse.content[0];
      if (responseContent.type !== "text") {
        throw new Error("Unexpected response type from API");
      }

      const lines = responseContent.text
        .trim()
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean);

      let totalFound = 0;
      const foundElements: FoundElement[] = [];
      let errorMessage: string | undefined;
      let hasMore = false;

      for (const line of lines) {
        if (line.startsWith("FOUND:")) {
          totalFound = parseInt(line.split(":")[1].trim()) || 0;
        } else if (line.startsWith("SHOWING:")) {
          // ignore
        } else if (line.startsWith("ERROR:")) {
          errorMessage = line.substring(6).trim();
        } else if (line.startsWith("MORE:")) {
          hasMore = true;
        } else if (line.includes("|") && line.startsWith("ref_")) {
          const parts = line.split("|").map((p: string) => p.trim());
          if (parts.length >= 5) {
            let coordinates: [number, number] | undefined;
            const coordString = parts[4];
            if (coordString && coordString.includes(",")) {
              const [x, y] = coordString
                .split(",")
                .map((c: string) => parseInt(c.trim()));
              if (!isNaN(x) && !isNaN(y)) {
                coordinates = [x, y];
              }
            }
            foundElements.push({
              ref: parts[0],
              role: parts[1],
              name: parts[2],
              type: parts[3] || undefined,
              coordinates,
              description: parts[5] || undefined,
            });
          }
        }
      }

      if (totalFound === 0 || foundElements.length === 0) {
        return { error: errorMessage || "No matching elements found" };
      }

      let outputText = `Found ${totalFound} matching element${
        totalFound === 1 ? "" : "s"
      }`;
      if (hasMore) {
        outputText += ` (showing first ${foundElements.length}, use a more specific query to narrow results)`;
      }

      const elementList = foundElements
        .map((el) => {
          let desc = `- ${el.ref}: ${el.role}`;
          if (el.name) desc += ` "${el.name}"`;
          if (el.type) desc += ` (${el.type})`;
          if (el.coordinates)
            desc += ` at (${el.coordinates[0]},${el.coordinates[1]})`;
          if (el.description) desc += ` - ${el.description}`;
          return desc;
        })
        .join("\n");

      return { output: `${outputText}\n\n${elementList}` };
    } catch (error) {
      return {
        error: `Failed to find element: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (): Promise<any> => ({
    name: "find",
    description:
      'Find elements on the page using natural language. Can search for elements by their purpose (e.g., "search bar", "login button") or by text content (e.g., "organic mango product"). Returns up to 20 matching elements with references and coordinates that can be used with other tools. If more than 20 matches exist, you\'ll be notified to use a more specific query.',
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Natural language description of what to find (e.g., "search bar", "add to cart button", "product title containing organic")',
        },
      },
      required: ["query"],
    },
  }),
};