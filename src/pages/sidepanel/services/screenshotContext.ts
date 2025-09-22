interface ScreenshotContextData {
  viewportWidth: number;
  viewportHeight: number;
  screenshotWidth: number;
  screenshotHeight: number;
}

interface FullScreenshotData extends ScreenshotContextData {
  width: number;
  height: number;
}

class ScreenshotContextManager {
  private contexts = new Map<number, ScreenshotContextData>();

  setContext(tabId: number, data: FullScreenshotData): void {
    if (data.viewportWidth && data.viewportHeight) {
      const context: ScreenshotContextData = {
        viewportWidth: data.viewportWidth,
        viewportHeight: data.viewportHeight,
        screenshotWidth: data.width,
        screenshotHeight: data.height,
      };
      this.contexts.set(tabId, context);
    }
  }

  getContext(tabId: number): ScreenshotContextData | undefined {
    return this.contexts.get(tabId);
  }

  clearContext(tabId: number): void {
    this.contexts.delete(tabId);
  }

  clearAllContexts(): void {
    this.contexts.clear();
  }
}

export const screenshotContextManager = new ScreenshotContextManager();
