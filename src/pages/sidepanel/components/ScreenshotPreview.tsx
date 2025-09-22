import React, { useRef, useEffect, useState } from "react";
import { cn } from "../../../utils/classNames";

interface SimpleScreenshotProps {
  dataUrl: string;
  width?: number;
  height?: number;
  maxHeight?: string;
  className?: string;
}

export function SimpleScreenshot({
  dataUrl,
  width,
  height,
  maxHeight = "200px",
  className = "",
}: SimpleScreenshotProps) {
  return (
    <div className={cn(className)}>
      <img
        src={dataUrl}
        alt="Screenshot"
        className="max-w-full h-auto rounded border border-border-300 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ maxHeight }}
        onClick={() => window.open(dataUrl, "_blank")}
        title="Click to open in new tab"
      />
      {width && height && (
        <div className="mt-1 text-xs text-text-300">
          {width}×{height}
        </div>
      )}
    </div>
  );
}

interface ScreenshotWithClickProps {
  screenshot: string;
  coordinates: [number, number];
  className?: string;
}

export function ScreenshotWithClick({
  screenshot,
  coordinates,
  className = "",
}: ScreenshotWithClickProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      if (imgRef.current) {
        const scaleX = imgRef.current.width / imgRef.current.naturalWidth;
        const scaleY = imgRef.current.height / imgRef.current.naturalHeight;
        setScale(Math.min(scaleX, scaleY));
      }
    };

    const imgElement = imgRef.current;
    if (imgElement) {
      if (!imgElement.complete) {
        imgElement.addEventListener("load", calculateScale);
        return () => imgElement.removeEventListener("load", calculateScale);
      }
      calculateScale();
    }
  }, [screenshot]);

  return (
    <div className={cn("relative inline-block", className)}>
      <img
        ref={imgRef}
        src={screenshot}
        alt="Screenshot with click location"
        className="max-w-full max-h-[200px] border-[0.5px] border-border-200 rounded-[12px]"
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full border-[0.5px] border-accent-secondary-100 w-[23px] h-[23px] bg-[#2C84DB4D]"
        style={{
          left: `${coordinates[0] * scale}px`,
          top: `${coordinates[1] * scale}px`,
        }}
      />
    </div>
  );
}
interface ScreenshotWithDragProps {
    screenshot: string;
    startCoordinate: [number, number];
    endCoordinate: [number, number];
    className?: string;
}

export function ScreenshotWithDrag({ screenshot, startCoordinate, endCoordinate, className = "" }: ScreenshotWithDragProps) {
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const updateSize = () => {
            if (imgRef.current) {
                setImgSize({ width: imgRef.current.offsetWidth, height: imgRef.current.offsetHeight });
            }
        };

        if (imgRef.current) {
            updateSize();
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, [screenshot]);

    const [startX, startY] = startCoordinate;
    const [endX, endY] = endCoordinate;

    const scaleX = imgSize.width > 0 ? imgSize.width / (imgRef.current?.naturalWidth || imgSize.width) : 1;
    const scaleY = imgSize.height > 0 ? imgSize.height / (imgRef.current?.naturalHeight || imgSize.height) : 1;
    
    const scaledStartX = startX * scaleX;
    const scaledStartY = startY * scaleY;
    const scaledEndX = endX * scaleX;
    const scaledEndY = endY * scaleY;

    return (
        <div className={cn("relative inline-block", className)}>
            <img
                ref={imgRef}
                src={screenshot}
                alt="Screenshot with drag path"
                className="max-w-full h-auto"
                onLoad={() => {
                    if (imgRef.current) {
                        setImgSize({ width: imgRef.current.offsetWidth, height: imgRef.current.offsetHeight });
                    }
                }}
            />
            {imgSize.width > 0 && (
                <>
                    <svg
                        className="absolute pointer-events-none"
                        style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: 15 }}
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
                            </marker>
                        </defs>
                        <line
                            x1={scaledStartX}
                            y1={scaledStartY}
                            x2={scaledEndX}
                            y2={scaledEndY}
                            stroke="#dc2626"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                        />
                    </svg>
                    <div
                        className="absolute bg-bg-000 border-2 border-accent-secondary-100 rounded-full"
                        style={{
                            left: `${scaledStartX}px`,
                            top: `${scaledStartY}px`,
                            width: '8px',
                            height: '8px',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 20,
                        }}
                    />
                     <div
                        className="absolute bg-bg-000 border-2 border-danger-200 rounded-full"
                        style={{
                            left: `${scaledEndX}px`,
                            top: `${scaledEndY}px`,
                            width: '8px',
                            height: '8px',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 20,
                        }}
                    />
                </>
            )}
        </div>
    );
}
