// 原始对象: ud

import { ToolAction } from "../../../../lib/permissions";
import { Tool, ToolContext, ToolOutput, PermissionRequest } from "../../types";
import { checkDomainChange } from "../../utils/url";

interface FormInputArgs {
  ref: string;
  value: string | number | boolean;
}

export const formInputTool: Tool = {
  name: "form_input",
  description:
    "Set values in form elements using element reference ID from the read_page or find tools.",
  parameters: {
    ref: {
      type: "string",
      description:
        'Element reference ID from the read_page or find tools (e.g., "ref_1", "ref_2")',
    },
    value: {
      type: ["string", "boolean", "number"],
      description:
        "The value to set. For checkboxes use boolean, for selects use option value or text, for other inputs use appropriate string/number",
    },
  },
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      const params = args as FormInputArgs;
      if (!params?.ref) {
        throw new Error("ref parameter is required");
      }
      if (params.value === undefined || params.value === null) {
        throw new Error("Value parameter is required");
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
            tool: ToolAction.TYPE,
            url,
            toolUseId,
            actionData: { ref: params.ref, value: params.value },
          };
          return request;
        }
        return { error: "Permission denied for form input on this domain" };
      }

      const originalUrl = tab.url;
      if (!originalUrl) {
        return { error: "Unable to get original URL for security check" };
      }
      const domainCheckError = await checkDomainChange(
        tab.id,
        originalUrl,
        "form input action",
      );
      if (domainCheckError) {
        return domainCheckError;
      }

      const injectionResults = await chrome.scripting.executeScript<
        [string, string | number | boolean],
        ToolOutput
      >({
        target: { tabId: tab.id },
        func: (ref, value) => {
          try {
            // Logic to find element from ref map injected by content script
            let element: HTMLElement | null = null;
            if (
              (window as any).__claudeElementMap &&
              (window as any).__claudeElementMap[ref]
            ) {
              element = (window as any).__claudeElementMap[ref].deref() || null;
              if (element && !document.contains(element)) {
                delete (window as any).__claudeElementMap[ref];
                element = null;
              }
            }

            if (!element) {
              return {
                error: `No element found with reference: "${ref}". The element may have been removed from the page.`,
              };
            }

            element.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            if (element instanceof HTMLSelectElement) {
              const previousValue = element.value;
              const options = Array.from(element.options);
              let found = false;
              const stringValue = String(value);

              for (let i = 0; i < options.length; i++) {
                if (
                  options[i].value === stringValue ||
                  options[i].text === stringValue
                ) {
                  element.selectedIndex = i;
                  found = true;
                  break;
                }
              }

              if (found) {
                element.focus();
                element.dispatchEvent(new Event("change", { bubbles: true }));
                element.dispatchEvent(new Event("input", { bubbles: true }));
                return {
                  output: `Selected option "${stringValue}" in dropdown (previous: "${previousValue}")`,
                };
              } else {
                return {
                  error: `Option "${stringValue}" not found. Available options: ${options
                    .map((opt) => `"${opt.text}" (value: "${opt.value}")`)
                    .join(", ")}`,
                };
              }
            }

            if (
              element instanceof HTMLInputElement &&
              element.type === "checkbox"
            ) {
              const previousValue = element.checked;
              if (typeof value !== "boolean") {
                return {
                  error: "Checkbox requires a boolean value (true/false)",
                };
              }
              element.checked = value;
              element.focus();
              element.dispatchEvent(new Event("change", { bubbles: true }));
              element.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                output: `Checkbox ${
                  element.checked ? "checked" : "unchecked"
                } (previous: ${previousValue})`,
              };
            }

            if (element instanceof HTMLInputElement && element.type === "radio") {
              const previousValue = element.checked;
              const groupName = element.name;
              element.checked = true;
              element.focus();
              element.dispatchEvent(new Event("change", { bubbles: true }));
              element.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                output: `Radio button selected${
                  groupName ? ` in group "${groupName}"` : ""
                }`,
              };
            }

            if (
              element instanceof HTMLInputElement &&
              [
                "date",
                "time",
                "datetime-local",
                "month",
                "week",
              ].includes(element.type)
            ) {
              const previousValue = element.value;
              element.value = String(value);
              element.focus();
              element.dispatchEvent(new Event("change", { bubbles: true }));
              element.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                output: `Set ${element.type} to "${element.value}" (previous: ${previousValue})`,
              };
            }

            if (element instanceof HTMLInputElement && element.type === "range") {
              const previousValue = element.value;
              const numericValue = Number(value);
              if (isNaN(numericValue)) {
                return { error: "Range input requires a numeric value" };
              }
              element.value = String(numericValue);
              element.focus();
              element.dispatchEvent(new Event("change", { bubbles: true }));
              element.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                output: `Set range to ${element.value} (min: ${element.min}, max: ${element.max})`,
              };
            }
            
            if (element instanceof HTMLInputElement && element.type === 'number') {
              const previousValue = element.value;
              const numericValue = Number(value);
              if (isNaN(numericValue) && value !== '') {
                  return { error: 'Number input requires a numeric value' };
              }
              element.value = String(value);
              element.focus();
              element.dispatchEvent(new Event('change', { bubbles: true }));
              element.dispatchEvent(new Event('input', { bubbles: true }));
              return { output: `Set number input to ${element.value} (previous: ${previousValue})` };
            }

            if (
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement
            ) {
              const previousValue = element.value;
              element.value = String(value);
              element.focus();
              element.setSelectionRange(element.value.length, element.value.length);
              element.dispatchEvent(new Event("change", { bubbles: true }));
              element.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                output: `Set ${
                  element instanceof HTMLTextAreaElement
                    ? "textarea"
                    : element.type || "text"
                } value to "${element.value}" (previous: "${previousValue}")`,
              };
            }

            return {
              error: `Element type "${element.tagName}" is not a supported form input`,
            };
          } catch (e) {
            return {
              error: `Error setting form value: ${
                e instanceof Error ? e.message : "Unknown error"
              }`,
            };
          }
        },
        args: [params.ref, params.value],
      });

      if (!injectionResults || injectionResults.length === 0) {
        throw new Error("Failed to execute form input");
      }
      return injectionResults[0].result as any;
    } catch (error) {
      return {
        error: `Failed to execute form input: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (): Promise<any> => ({
    name: "form_input",
    description:
      "Set values in form elements using element reference ID from the read_page tool.",
    input_schema: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description:
            'Element reference ID from the read_page tool (e.g., "ref_1", "ref_2")',
        },
        value: {
          type: ["string", "boolean", "number"],
          description:
            "The value to set. For checkboxes use boolean, for selects use option value or text, for other inputs use appropriate string/number",
        },
      },
      required: ["ref", "value"],
    },
  }),
};