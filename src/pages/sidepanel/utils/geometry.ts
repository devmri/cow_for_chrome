// 原始函数: Zu, zu, Wu, sd

/**
 * Calculates page numbers for a given item count and items per page.
 * Logic is equivalent to Math.ceil(itemCount / itemsPerPage) but implemented as is to ensure 100% equivalence.
 * @original Zu
 * @param itemCount - The number of items (e.g., pixels).
 * @param itemsPerPage - The number of items per page (e.g., pixels per token).
 * @returns The total number of pages.
 */
function calculatePages(itemCount: number, itemsPerPage: number): number {
  return Math.floor((itemCount - 1) / itemsPerPage) + 1;
}

/**
 * Calculates the number of grid cells for a given width, height, and cell size.
 * @original zu
 * @param width The width of the grid.
 * @param height The height of the grid.
 * @param cellSize The size of each square cell.
 * @returns The total number of cells.
 */
function calculateGridCells(
  width: number,
  height: number,
  cellSize: number,
): number {
  return calculatePages(width, cellSize) * calculatePages(height, cellSize);
}

interface ResizeParams {
  pxPerToken: number;
  maxTargetPx: number;
  maxTargetTokens: number;
}

/**
 * Calculates resized dimensions for a screenshot while maintaining aspect ratio and adhering to constraints.
 * @original Wu
 * @param width The original width.
 * @param height The original height.
 * @param constraints The resize constraints.
 * @returns A tuple containing the new width and height.
 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  constraints: ResizeParams,
): [number, number] {
  const { pxPerToken, maxTargetPx, maxTargetTokens } = constraints;

  if (
    width <= maxTargetPx &&
    height <= maxTargetPx &&
    calculateGridCells(width, height, pxPerToken) <= maxTargetTokens
  ) {
    return [width, height];
  }

  if (height > width) {
    const [resizedHeight, resizedWidth] = calculateResizedDimensions(
      height,
      width,
      constraints,
    );
    return [resizedWidth, resizedHeight];
  }

  const aspectRatio = width / height;
  let high = width;
  let low = 1;

  while (true) {
    if (low + 1 === high) {
      return [low, Math.max(Math.round(low / aspectRatio), 1)];
    }
    const midWidth = Math.floor((low + high) / 2);
    const midHeight = Math.max(Math.round(midWidth / aspectRatio), 1);
    if (
      midWidth <= maxTargetPx &&
      calculateGridCells(midWidth, midHeight, pxPerToken) <= maxTargetTokens
    ) {
      low = midWidth;
    } else {
      high = midWidth;
    }
  }
}

interface ScreenshotContext {
  viewportWidth: number;
  viewportHeight: number;
  screenshotWidth: number;
  screenshotHeight: number;
}

/**
 * Scales coordinates from screenshot space to viewport space.
 * @original sd
 * @param x The x-coordinate in the screenshot.
 * @param y The y-coordinate in the screenshot.
 * @param context The screenshot and viewport dimensions context.
 * @returns A tuple containing the scaled x and y coordinates.
 */
export function scaleCoordinates(
  x: number,
  y: number,
  context: ScreenshotContext,
): [number, number] {
  const scaleX = context.viewportWidth / context.screenshotWidth;
  const scaleY = context.viewportHeight / context.screenshotHeight;
  return [Math.round(x * scaleX), Math.round(y * scaleY)];
}
