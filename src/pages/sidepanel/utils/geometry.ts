
function calculatePages(itemCount: number, itemsPerPage: number): number {
  return Math.floor((itemCount - 1) / itemsPerPage) + 1;
}

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

export function scaleCoordinates(
  x: number,
  y: number,
  context: ScreenshotContext,
): [number, number] {
  const scaleX = context.viewportWidth / context.screenshotWidth;
  const scaleY = context.viewportHeight / context.screenshotHeight;
  return [Math.round(x * scaleX), Math.round(y * scaleY)];
}
