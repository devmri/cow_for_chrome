// 原始类: Yu

import {
  KEY_DEFINITIONS,
  MAC_KEY_COMMANDS,
  KeyDefinition,
} from "../constants/keyboard";
import { screenshotContextManager } from "./screenshotContext";
import { calculateResizedDimensions } from "../utils/geometry";

interface ScreenshotResult {
  base64: string;
  width: number;
  height: number;
  format: "png";
  viewportWidth: number;
  viewportHeight: number;
}

interface ResizeParams {
  pxPerToken: number;
  maxTargetPx: number;
  maxTargetTokens: number;
}

type MouseButton = "none" | "left" | "middle" | "right";

interface DispatchMouseEventOptions {
  type:
    | "mousePressed"
    | "mouseReleased"
    | "mouseMoved"
    | "mouseWheel";
  x: number;
  y: number;
  modifiers?: number;
  button?: MouseButton;
  buttons?: number;
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
}

interface DispatchKeyEventOptions {
  type: "keyDown" | "keyUp" | "rawKeyDown" | "char";
  modifiers?: number;
  key?: string;
  code?: string;
  windowsVirtualKeyCode?: number;
  text?: string;
  unmodifiedText?: string;
  location?: number;
  commands?: string[];
  isKeypad?: boolean;
}

class DebuggerService {
  private isMac: boolean = false;

  constructor() {
    this.isMac =
      navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
      navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  }

  private defaultResizeParams: ResizeParams = {
    pxPerToken: 28,
    maxTargetPx: 1568,
    maxTargetTokens: 1568,
  };

  async attachDebugger(tabId: number): Promise<void> {
    const target = { tabId };
    try {
      await this.detachDebugger(tabId);
    } catch (e) {
      // Ignore errors detaching, it might not have been attached.
    }
    return new Promise((resolve, reject) => {
      chrome.debugger.attach(target, "1.3", () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async detachDebugger(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        resolve();
      });
    });
  }

  async sendCommand<T>(
    tabId: number,
    method: string,
    params?: object,
  ): Promise<T> {
    try {
      return await new Promise<T>((resolve, reject) => {
        chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result as T);
          }
        });
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes("debugger is not attached")) {
        await this.attachDebugger(tabId);
        return new Promise<T>((resolve, reject) => {
          chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result as T);
            }
          });
        });
      }
      throw error;
    }
  }

  async dispatchMouseEvent(
    tabId: number,
    options: DispatchMouseEventOptions,
  ): Promise<void> {
    const params: any = {
      type: options.type,
      x: Math.round(options.x),
      y: Math.round(options.y),
      modifiers: options.modifiers || 0,
    };

    if (
      options.type === "mousePressed" ||
      options.type === "mouseReleased" ||
      options.type === "mouseMoved"
    ) {
      params.button = options.button || "none";
      if (
        options.type === "mousePressed" ||
        options.type === "mouseReleased"
      ) {
        params.clickCount = options.clickCount || 1;
      }
    }

    if (options.type !== "mouseWheel") {
        params.buttons = options.buttons !== undefined ? options.buttons : 0;
    }

    if (options.type === "mouseWheel") {
      if (options.deltaX !== undefined || options.deltaY !== undefined) {
        Object.assign(params, {
          deltaX: options.deltaX || 0,
          deltaY: options.deltaY || 0,
        });
      }
    }

    await this.sendCommand(tabId, "Input.dispatchMouseEvent", params);
  }

  async dispatchKeyEvent(
    tabId: number,
    options: DispatchKeyEventOptions,
  ): Promise<void> {
    const params = { modifiers: 0, ...options };
    await this.sendCommand(tabId, "Input.dispatchKeyEvent", params);
  }

  async insertText(tabId: number, text: string): Promise<void> {
    await this.sendCommand(tabId, "Input.insertText", { text });
  }

  async click(
    tabId: number,
    x: number,
    y: number,
    button: MouseButton = "left",
    clickCount = 1,
  ): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (e) {
      // Content script might not be available, proceed anyway
    }

    try {
      let buttons = 0;
      if (button === "left") buttons = 1;
      else if (button === "right") buttons = 2;
      else if (button === "middle") buttons = 4;

      await this.dispatchMouseEvent(tabId, {
        type: "mouseMoved",
        x,
        y,
        button: "none",
        buttons: 0,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      for (let i = 1; i <= clickCount; i++) {
        await this.dispatchMouseEvent(tabId, {
          type: "mousePressed",
          x,
          y,
          button,
          buttons,
          clickCount: i,
        });

        await new Promise((resolve) => setTimeout(resolve, 12));

        await this.dispatchMouseEvent(tabId, {
          type: "mouseReleased",
          x,
          y,
          button,
          buttons: 0,
          clickCount: i,
        });

        if (i < clickCount) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
      } catch (e) {
        // Ignore errors if content script is not available
      }
    }
  }

  async type(tabId: number, text: string): Promise<void> {
    for (const char of text) {
      let key = char;
      if (char === "\n" || char === "\r") {
        key = "Enter";
      }

      const keyDef = this.getKeyCode(key);
      if (keyDef) {
        const modifiers = this.requiresShift(char) ? 8 : 0; // 8 is Shift
        await this.pressKey(tabId, keyDef, modifiers);
      } else {
        await this.insertText(tabId, char);
      }
    }
  }

  async keyDown(
    tabId: number,
    keyDef: KeyDefinition & { windowsVirtualKeyCode?: number; location?: number },
    modifiers = 0,
    commands?: string[],
  ): Promise<void> {
    await this.dispatchKeyEvent(tabId, {
      type: keyDef.text ? "keyDown" : "rawKeyDown",
      key: keyDef.key,
      code: keyDef.code,
      windowsVirtualKeyCode: keyDef.windowsVirtualKeyCode || keyDef.keyCode,
      modifiers: modifiers,
      text: keyDef.text ?? "",
      unmodifiedText: keyDef.text ?? "",
      location: keyDef.location ?? 0,
      commands: commands ?? [],
      isKeypad: keyDef.isKeypad ?? false,
    });
  }

  async keyUp(
    tabId: number,
    keyDef: KeyDefinition & { windowsVirtualKeyCode?: number; location?: number },
    modifiers = 0,
  ): Promise<void> {
    await this.dispatchKeyEvent(tabId, {
      type: "keyUp",
      key: keyDef.key,
      modifiers: modifiers,
      windowsVirtualKeyCode: keyDef.windowsVirtualKeyCode || keyDef.keyCode,
      code: keyDef.code,
      location: keyDef.location ?? 0,
    });
  }

  async pressKey(
    tabId: number,
    keyDef: KeyDefinition,
    modifiers = 0,
    commands?: string[],
  ): Promise<void> {
    await this.keyDown(tabId, keyDef, modifiers, commands);
    await this.keyUp(tabId, keyDef, modifiers);
  }

  async pressKeyChord(tabId: number, chord: string): Promise<void> {
    const parts = chord.toLowerCase().split("+");
    const modifiers: string[] = [];
    let key = "";

    for (const part of parts) {
      if (
        [
          "ctrl",
          "control",
          "alt",
          "shift",
          "cmd",
          "meta",
          "command",
          "win",
          "windows",
        ].includes(part)
      ) {
        modifiers.push(part);
      } else {
        key = part;
      }
    }

    let modifierMask = 0;
    const modifierMap: { [key: string]: number } = {
      alt: 1,
      ctrl: 2,
      control: 2,
      meta: 4,
      cmd: 4,
      command: 4,
      win: 4,
      windows: 4,
      shift: 8,
    };

    for (const mod of modifiers) {
      modifierMask |= modifierMap[mod] || 0;
    }

    const commands: string[] = [];
    if (this.isMac) {
      const command = MAC_KEY_COMMANDS[chord.toLowerCase()];
      if (command) {
        if (Array.isArray(command)) {
          commands.push(...command);
        } else {
          commands.push(command);
        }
      }
    }

    if (key) {
      const keyDef = this.getKeyCode(key);
      if (!keyDef) {
        throw new Error(`Unknown key: ${chord}`);
      }
      await this.pressKey(tabId, keyDef, modifierMask, commands);
    }
  }

  async scrollWheel(
    tabId: number,
    x: number,
    y: number,
    deltaX: number,
    deltaY: number,
  ): Promise<void> {
    await this.dispatchMouseEvent(tabId, {
      type: "mouseWheel",
      x,
      y,
      deltaX,
      deltaY,
    });
  }

  getKeyCode(key: string): KeyDefinition | undefined {
    const lowerKey = key.toLowerCase();
    const definition = KEY_DEFINITIONS[lowerKey];
    if (definition) {
      return definition;
    }

    if (key.length === 1) {
      const upperKey = key.toUpperCase();
      let code;
      if (upperKey >= "A" && upperKey <= "Z") {
        code = `Key${upperKey}`;
      } else if (key >= "0" && key <= "9") {
        code = `Digit${key}`;
      } else {
        return undefined;
      }
      return {
        key: key,
        code: code,
        keyCode: upperKey.charCodeAt(0),
        text: key,
      };
    }
    return undefined;
  }

  requiresShift(char: string): boolean {
    return (
      '~!@#$%^&*()_+{}|:"<>?'.includes(char) || (char >= "A" && char <= "Z")
    );
  }

  async screenshot(
    tabId: number,
    resizeParams?: ResizeParams,
  ): Promise<ScreenshotResult> {
    const params = resizeParams || this.defaultResizeParams;

    try {
      await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (e) {
      // Content script might not be available, proceed anyway
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        }),
      });

      if (!results || !results[0]?.result) {
        throw new Error("Failed to get viewport information");
      }
      const {
        width: viewportWidth,
        height: viewportHeight,
        devicePixelRatio,
      } = results[0].result;

      const screenshotResult = await this.sendCommand<{ data: string }>(
        tabId,
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: false,
          fromSurface: true,
        },
      );

      if (!screenshotResult || !screenshotResult.data) {
        throw new Error("Failed to capture screenshot via CDP");
      }

      const dataUrl = `data:image/png;base64,${screenshotResult.data}`;

      const processedImage = await new Promise<ScreenshotResult>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            let originalWidth = img.width;
            let originalHeight = img.height;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              return reject(
                new Error(
                  "Failed to create 2D context for screenshot processing",
                ),
              );
            }

            if (devicePixelRatio > 1) {
              originalWidth = Math.round(img.width / devicePixelRatio);
              originalHeight = Math.round(img.height / devicePixelRatio);
              canvas.width = originalWidth;
              canvas.height = originalHeight;
              ctx.drawImage(
                img,
                0,
                0,
                img.width,
                img.height,
                0,
                0,
                originalWidth,
                originalHeight,
              );
            } else {
              canvas.width = originalWidth;
              canvas.height = originalHeight;
              ctx.drawImage(img, 0, 0);
            }

            const [targetWidth, targetHeight] = calculateResizedDimensions(
              originalWidth,
              originalHeight,
              params,
            );

            if (
              originalWidth === targetWidth &&
              originalHeight === targetHeight
            ) {
              const base64 = canvas.toDataURL("image/png").split(",")[1];
              return resolve({
                base64,
                width: originalWidth,
                height: originalHeight,
                format: "png",
                viewportWidth,
                viewportHeight,
              });
            }

            const targetCanvas = document.createElement("canvas");
            const targetCtx = targetCanvas.getContext("2d");

            if (!targetCtx) {
              return reject(
                new Error("Failed to create 2D context for target resizing"),
              );
            }

            targetCanvas.width = targetWidth;
            targetCanvas.height = targetHeight;
            targetCtx.drawImage(
              canvas,
              0,
              0,
              originalWidth,
              originalHeight,
              0,
              0,
              targetWidth,
              targetHeight,
            );

            const finalBase64 = targetCanvas.toDataURL("image/png").split(",")[1];
            resolve({
              base64: finalBase64,
              width: targetWidth,
              height: targetHeight,
              format: "png",
              viewportWidth,
              viewportHeight,
            });
          };

          img.onerror = () => {
            reject(new Error("Failed to load screenshot image"));
          };
          img.src = dataUrl;
        },
      );

      screenshotContextManager.setContext(tabId, {
        ...processedImage,
        screenshotWidth: processedImage.width,
        screenshotHeight: processedImage.height,
      });

      return processedImage;
    } finally {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
      } catch (e) {
        // Ignore errors if content script is not available
      }
    }
  }
}

export const debuggerService = new DebuggerService();
