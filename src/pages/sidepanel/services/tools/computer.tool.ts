
import {
  Tool,
  ToolContext,
  ToolOutput,
  PermissionRequest,
} from "../../types";
import { debuggerService } from "../debugger.service";
import { screenshotContextManager } from "../screenshotContext";
import { checkDomainChange } from "../../utils/url";
import { scaleCoordinates } from "../../utils/geometry";
import { ToolAction } from "../../../../lib/permissions";

async function performClick(
  tabId: number,
  args: { action: string; coordinate?: [number, number] },
  clickCount = 1,
  originalUrl?: string,
): Promise<ToolOutput> {
  if (!args.coordinate) {
    throw new Error("Coordinate parameter is required for click action");
  }
  let [x, y] = args.coordinate;

  const context = screenshotContextManager.getContext(tabId);
  if (context) {
    [x, y] = scaleCoordinates(x, y, context);
  }

  const button = args.action === "right_click" ? "right" : "left";

  try {
    const domainCheckError = await checkDomainChange(
      tabId,
      originalUrl,
      "click action",
    );
    if (domainCheckError) return domainCheckError;

    await debuggerService.click(tabId, x, y, button, clickCount);
    const clickType =
      clickCount === 1
        ? "Clicked"
        : clickCount === 2
        ? "Double-clicked"
        : "Triple-clicked";
    return { output: `${clickType} at (${x}, ${y})` };
  } catch (error) {
    return {
      error: `Error clicking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

async function performScreenshot(tabId: number): Promise<ToolOutput> {
  try {
    const result = await debuggerService.screenshot(tabId);
    return {
      output: `Successfully captured screenshot (${result.width}x${result.height}, png) scaled to viewport dimensions`,
      base64Image: result.base64,
    };
  } catch (error) {
    return {
      error: `Error capturing screenshot: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

async function getScrollPosition(
  tabId: number,
): Promise<{ x: number; y: number }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop,
    }),
  });
  if (!results || !results[0]?.result) {
    throw new Error("Failed to get scroll position");
  }
  return results[0].result;
}

export const computerTool: Tool = {
  name: "computer",
  description:
    "Use a mouse and keyboard to interact with a web browser, and take screenshots.\n* The screen's resolution is {self.display_width_px}x{self.display_height_px}.\n* You should ONLY call mouse_move if you intend to hover over an element without clicking. Otherwise, use the click or drag functions directly.\n* Whenever you intend to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor.\n* If you tried clicking on a program or link but it failed to load, even after waiting, try adjusting your click location so that the tip of the cursor visually falls on the element that you want to click.\n* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.",
  parameters: {
    // This is defined in the original code, but we'll use toAnthropicSchema for the real input schema
  },
  execute: async (args: any, context: ToolContext): Promise<ToolOutput> => {
    try {
      const params = args || {};
      if (!params.action) {
        throw new Error("Action parameter is required");
      }
      if (!context?.tabId) {
        throw new Error("No active tab found");
      }

      const tab = await chrome.tabs.get(context.tabId);
      if (!tab.id) {
        throw new Error("Active tab has no ID");
      }

      // Permission check
      if (!["wait"].includes(params.action)) {
        const url = tab.url;
        if (!url) {
          throw new Error("No URL available for active tab");
        }
        const actionMap: { [key: string]: ToolAction } = {
          screenshot: ToolAction.READ_PAGE_CONTENT,
          scroll: ToolAction.READ_PAGE_CONTENT,
          left_click: ToolAction.CLICK,
          right_click: ToolAction.CLICK,
          double_click: ToolAction.CLICK,
          triple_click: ToolAction.CLICK,
          left_click_drag: ToolAction.CLICK,
          type: ToolAction.TYPE,
          key: ToolAction.TYPE,
        };
        const toolAction = actionMap[params.action];
        if (!toolAction) {
          throw new Error(`Unsupported action: ${params.action}`);
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
              tool: toolAction,
              url,
              toolUseId,
            };

            // Add contextual data for the prompt
            if (
              [
                "left_click",
                "right_click",
                "double_click",
                "triple_click",
              ].includes(params.action)
            ) {
              try {
                const screenshot = await debuggerService.screenshot(tab.id);
                request.actionData = {
                  screenshot: `data:image/png;base64,${screenshot.base64}`,
                };
                if (params.coordinate) {
                  request.actionData.coordinate = params.coordinate;
                }
              } catch (e) {
                request.actionData = {};
                if (params.coordinate) {
                  request.actionData.coordinate = params.coordinate;
                }
              }
            } else if (params.action === "type" && params.text) {
              request.actionData = { text: params.text };
            } else if (
              params.action === "left_click_drag" &&
              params.start_coordinate &&
              params.coordinate
            ) {
              request.actionData = {
                start_coordinate: params.start_coordinate,
                coordinate: params.coordinate,
              };
            }
            return request;
          }
          return {
            error: "Permission denied for this action on this domain",
          };
        }
      }

      const originalUrl = tab.url;

      switch (params.action) {
        case "left_click":
        case "right_click":
          return await performClick(tab.id, params, 1, originalUrl);
        case "double_click":
          return await performClick(tab.id, params, 2, originalUrl);
        case "triple_click":
          return await performClick(tab.id, params, 3, originalUrl);
        case "screenshot":
          return await performScreenshot(tab.id);
        case "type":
          if (!params.text)
            throw new Error("Text parameter is required for type action");
          try {
            const domainCheckError = await checkDomainChange(
              tab.id,
              originalUrl,
              "type action",
            );
            if (domainCheckError) return domainCheckError;
            await debuggerService.type(tab.id, params.text);
            return { output: `Typed "${params.text}"` };
          } catch (error) {
            return {
              error: `Failed to type: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        case "wait":
          if (!params.duration || params.duration <= 0)
            throw new Error(
              "Duration parameter is required and must be positive",
            );
          if (params.duration > 30)
            throw new Error("Duration cannot exceed 30 seconds");
          const waitMs = Math.round(params.duration * 1000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          return {
            output: `Waited for ${params.duration} second${
              params.duration === 1 ? "" : "s"
            }`,
          };
        case "scroll": {
          if (!params.coordinate || params.coordinate.length !== 2)
            throw new Error("Coordinate parameter is required for scroll action");
          let [x, y] = params.coordinate;
          const screenshotCtx = screenshotContextManager.getContext(tab.id);
          if (screenshotCtx) {
            [x, y] = scaleCoordinates(x, y, screenshotCtx);
          }

          const direction = params.scroll_direction || "down";
          const amount = params.scroll_amount || 3;
          try {
            let deltaX = 0;
            let deltaY = 0;
            const scrollUnit = 100;
            switch (direction) {
              case "up":
                deltaY = -amount * scrollUnit;
                break;
              case "down":
                deltaY = amount * scrollUnit;
                break;
              case "left":
                deltaX = -amount * scrollUnit;
                break;
              case "right":
                deltaX = amount * scrollUnit;
                break;
              default:
                throw new Error(`Invalid scroll direction: ${direction}`);
            }

            const initialPos = await getScrollPosition(tab.id);
            let methodUsed = "CDP";

            try {
              const cdpPromise = debuggerService.scrollWheel(tab.id, x, y, deltaX, deltaY);
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Scroll timeout")), 5000));
              await Promise.race([cdpPromise, timeoutPromise]);
              await new Promise(resolve => setTimeout(resolve, 200));
              const newPos = await getScrollPosition(tab.id);
              if (Math.abs(newPos.x - initialPos.x) <= 5 && Math.abs(newPos.y - initialPos.y) <= 5) {
                throw new Error("CDP scroll ineffective");
              }
            } catch (e) {
              methodUsed = "JavaScript";
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (x, y, deltaX, deltaY) => {
                  const el = document.elementFromPoint(x, y);
                  if (el && el !== document.body && el !== document.documentElement) {
                    const isScrollable = (elem: Element) => {
                      const style = window.getComputedStyle(elem);
                      const overflowY = style.getPropertyValue("overflow-y");
                      const overflowX = style.getPropertyValue("overflow-x");
                      return (overflowY === "auto" || overflowY === "scroll" || overflowX === "auto" || overflowX === "scroll") &&
                        (elem.scrollHeight > elem.clientHeight || elem.scrollWidth > elem.clientWidth);
                    };
                    let parent = el;
                    while(parent && !isScrollable(parent)) {
                        parent = parent.parentElement as Element;
                    }
                    if (parent && isScrollable(parent)) {
                        parent.scrollBy({ left: deltaX, top: deltaY, behavior: 'instant' });
                        return;
                    }
                  }
                  window.scrollBy({ left: deltaX, top: deltaY, behavior: 'instant' });
                },
                args: [x, y, deltaX, deltaY]
              });
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            let screenshot: string | undefined;
            try {
                const tabInfo = await chrome.tabs.get(tab.id);
                if (tabInfo?.url && (await context.permissionManager.checkPermission(tabInfo.url, undefined)).allowed) {
                    const result = await performScreenshot(tab.id);
                    if ('base64Image' in result) {
                        screenshot = result.base64Image;
                    }
                }
            } catch(e) { /* ignore */ }
            
            return {
              output: `Scrolled ${direction} by ${amount} ticks at (${x}, ${y}) using ${methodUsed}`,
              ...(screenshot && { base64Image: screenshot })
            };
          } catch (error) {
            return {
              error: `Error scrolling: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        }
        case "key":
          if (!params.text)
            throw new Error("Text parameter is required for key action");
          try {
            const domainCheckError = await checkDomainChange(
              tab.id,
              originalUrl,
              "key action",
            );
            if (domainCheckError) return domainCheckError;

            const keys = params.text
              .trim()
              .split(/\s+/)
              .filter((k: string) => k.length > 0);
            for (const key of keys) {
              if (key.includes("+")) {
                await debuggerService.pressKeyChord(tab.id, key);
              } else {
                const keyDef = debuggerService.getKeyCode(key);
                if (keyDef) {
                  await debuggerService.pressKey(tab.id, keyDef);
                } else {
                  await debuggerService.insertText(tab.id, key);
                }
              }
            }
            return {
              output: `Pressed ${keys.length} key${
                keys.length === 1 ? "" : "s"
              }: ${keys.join(" ")}`,
            };
          } catch (error) {
            return {
              error: `Error pressing key: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        case "left_click_drag": {
          if (
            !params.start_coordinate ||
            params.start_coordinate.length !== 2
          ) {
            throw new Error(
              "start_coordinate parameter is required for left_click_drag action",
            );
          }
          if (!params.coordinate || params.coordinate.length !== 2) {
            throw new Error(
              "coordinate parameter (end position) is required for left_click_drag action",
            );
          }
          let [startX, startY] = params.start_coordinate;
          let [endX, endY] = params.coordinate;

          const screenshotCtx = screenshotContextManager.getContext(tab.id);
          if (screenshotCtx) {
            [startX, startY] = scaleCoordinates(startX, startY, screenshotCtx);
            [endX, endY] = scaleCoordinates(endX, endY, screenshotCtx);
          }

          try {
            const domainCheckError = await checkDomainChange(
              tab.id,
              originalUrl,
              "drag action",
            );
            if (domainCheckError) return domainCheckError;

            await debuggerService.dispatchMouseEvent(tab.id, {
              type: "mouseMoved",
              x: startX,
              y: startY,
              button: "none",
              buttons: 0,
              modifiers: 0,
            });
            await debuggerService.dispatchMouseEvent(tab.id, {
              type: "mousePressed",
              x: startX,
              y: startY,
              button: "left",
              buttons: 1,
              clickCount: 1,
              modifiers: 0,
            });
            await debuggerService.dispatchMouseEvent(tab.id, {
              type: "mouseMoved",
              x: endX,
              y: endY,
              button: "left",
              buttons: 1,
              modifiers: 0,
            });
            await debuggerService.dispatchMouseEvent(tab.id, {
              type: "mouseReleased",
              x: endX,
              y: endY,
              button: "left",
              buttons: 0,
              clickCount: 1,
              modifiers: 0,
            });
            return { output: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})` };
          } catch (error) {
            return {
              error: `Error performing drag: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        }
        default:
          throw new Error(`Unsupported action: ${params.action}`);
      }
    } catch (error) {
      return {
        error: `Failed to execute action: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
  toAnthropicSchema: async (context: {
    tabId: number;
  }): Promise<any> => {
    await debuggerService.attachDebugger(context.tabId);
    const results = await chrome.scripting.executeScript({
      target: { tabId: context.tabId },
      func: () => ({
        width: document.documentElement.clientWidth || window.innerWidth,
        height: document.documentElement.clientHeight || window.innerHeight,
      }),
    });

    if (!results || !results[0]?.result) {
      throw new Error("Failed to retrieve viewport dimensions");
    }
    const { width, height } = results[0].result;
    
    return {
      name: "computer",
      description: `Use a mouse and keyboard to interact with a web browser, and take screenshots.\n* The screen's resolution is ${width}x${height}.\n* You should ONLY call mouse_move if you intend to hover over an element without clicking. Otherwise, use the click or drag functions directly.\n* Whenever you intend to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor.\n* If you tried clicking on a program or link but it failed to load, even after waiting, try adjusting your click location so that the tip of the cursor visually falls on the element that you want to click.\n* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.`,
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "left_click",
              "right_click",
              "type",
              "screenshot",
              "wait",
              "scroll",
              "key",
              "left_click_drag",
              "double_click",
              "triple_click",
            ],
            description: "The action to perform:\n* `left_click`: Click the left mouse button at the specified coordinates.\n* `right_click`: Click the right mouse button at the specified coordinates to open context menus.\n* `double_click`: Double-click the left mouse button at the specified coordinates.\n* `triple_click`: Triple-click the left mouse button at the specified coordinates.\n* `type`: Type a string of text.\n* `screenshot`: Take a screenshot of the screen.\n* `wait`: Wait for a specified number of seconds.\n* `scroll`: Scroll up, down, left, or right at the specified coordinates.\n* `key`: Press a specific keyboard key.\n* `left_click_drag`: Drag from start_coordinate to coordinate.",
          },
          coordinate: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
            description: "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates. Required for `left_click`, `right_click`, `double_click`, `triple_click`, and `scroll`. For `left_click_drag`, this is the end position.",
          },
          text: {
            type: "string",
            description: 'The text to type (for `type` action) or the key(s) to press (for `key` action). For `key` action: Provide space-separated keys (e.g., "Backspace Backspace Delete"). Supports keyboard shortcuts using the platform\'s modifier key (use "cmd" on Mac, "ctrl" on Windows/Linux, e.g., "cmd+a" or "ctrl+a" for select all).',
          },
          duration: {
            type: "number",
            minimum: 0,
            maximum: 30,
            description: "The number of seconds to wait. Required for `wait`. Maximum 30 seconds.",
          },
          scroll_direction: {
            type: "string",
            enum: ["up", "down", "left", "right"],
            description: "The direction to scroll. Required for `scroll`.",
          },
          scroll_amount: {
            type: "number",
            minimum: 1,
            maximum: 10,
            description: "The number of scroll wheel ticks. Optional for `scroll`, defaults to 3.",
          },
          start_coordinate: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
            description: "(x, y): The starting coordinates for `left_click_drag`.",
          },
        },
      },
    };
  },
};
