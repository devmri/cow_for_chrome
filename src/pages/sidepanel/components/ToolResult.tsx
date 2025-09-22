// 原始函数: Gg

import React, { useState, useEffect } from "react";
import { Message, ToolUse } from "../types";
import {
  CameraIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  ClipboardCheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  KeyboardIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "lucide-react";
import {
  CursorClickIcon,
  CursorIcon,
  FilterIcon,
  NavigationArrowIcon,
  SelectionPlusIcon,
  TextTIcon,
  TextboxIcon,
} from "../../../components/icons";
import { ScreenshotWithClick, ScreenshotWithDrag } from "./ScreenshotPreview";
import { SimpleScreenshot } from "./ScreenshotPreview";

interface ToolResultProps {
  result: Extract<Message["content"], any[]>[number] | any;
  toolInfo?: ToolUse;
  lastScreenshot: string | null;
  debugMode?: boolean;
}

interface ToolDisplayInfo {
  icon: React.ReactNode;
  text: string;
}

/**
 * Renders the result of a tool call in a structured, expandable card.
 * @original Gg
 */
export function ToolResult({
  result,
  toolInfo,
  lastScreenshot,
  debugMode = false,
}: ToolResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isImageResult =
    Array.isArray(result.content) &&
    result.content.some((c: any) => c.type === "image");

  const displayInfo: ToolDisplayInfo | null = toolInfo
    ? getToolDisplayInfo(result, toolInfo)
    : null;

  const fallbackDisplayInfo: ToolDisplayInfo | null =
    !displayInfo && result && isImageResult && !result.is_error
      ? {
          icon: <CameraIcon className="w-4 h-4 text-text-300" />,
          text: "Screenshot",
        }
      : null;
      
  const finalDisplayInfo = displayInfo || fallbackDisplayInfo;

  return (
    <div className="overflow-hidden border-[0.5px] border-border-200 rounded-[10px]">
      <button
        onClick={debugMode ? () => setIsExpanded(!isExpanded) : undefined}
        className={
          "w-full px-4 py-2 bg-bg-100 transition-colors flex items-center justify-between text-left " +
          (debugMode
            ? "hover:bg-bg-200 cursor-pointer"
            : "cursor-default")
        }
        disabled={!debugMode}
      >
        <div className="flex items-center gap-2">
          {finalDisplayInfo?.icon}
          <span className="font-small text-text-300">
            {finalDisplayInfo?.text || "Tool Result"}
          </span>
        </div>
        {debugMode && (
          <ChevronRightIcon
            className={
              "w-4 h-4 text-text-400 transition-transform " +
              (isExpanded ? "rotate-90" : "")
            }
          />
        )}
      </button>

      {debugMode && isExpanded && (
        <div className="p-4 bg-bg-000 border-t-[0.5px] border-border-200">
          <div className="space-y-3">
            {toolInfo && (
              <div className="space-y-2">
                <div>
                  <span className="font-caption font-medium text-text-400">
                    Tool ID:
                  </span>
                  <code className="ml-2 font-code-sm bg-bg-200 px-2 py-1 rounded text-text-200">
                    {toolInfo.id || (result as any).tool_use_id}
                  </code>
                </div>
                <div>
                  <span className="font-caption font-medium text-text-400">
                    Parameters:
                  </span>
                  <pre className="mt-1 font-code-sm bg-bg-200 p-2 rounded overflow-x-auto text-text-200">
                    {JSON.stringify(toolInfo.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {(toolInfo?.name === 'click' && toolInfo?.input?.coordinate) || (toolInfo?.name === 'computer' && ['left_click', 'right_click', 'double_click', 'triple_click'].includes(toolInfo?.input?.action) && toolInfo?.input?.coordinate) && lastScreenshot && (
              <div>
                <span className="font-caption font-medium text-text-400">Click Location:</span>
                <ScreenshotWithClick screenshot={lastScreenshot} coordinates={toolInfo.input.coordinate} className="mt-1" />
              </div>
            )}

            {toolInfo?.name === 'computer' && toolInfo?.input?.action === 'left_click_drag' && toolInfo?.input?.start_coordinate && toolInfo?.input?.coordinate && lastScreenshot && (
                <div>
                    <span className="font-caption font-medium text-text-400">Drag Path:</span>
                    <ScreenshotWithDrag screenshot={lastScreenshot} startCoordinate={toolInfo.input.start_coordinate} endCoordinate={toolInfo.input.coordinate} className="mt-1" />
                </div>
            )}

            <div>
              <span className="font-caption font-medium text-text-400">Result:</span>
              {isImageResult ? (
                <div className="mt-2">
                  {(result.content as any[]).map((c, index) => {
                    if (c.type === "image" && c.source?.type === "base64") {
                      const dataUrl = `data:${c.source.media_type};base64,${c.source.data}`;
                      return <SimpleScreenshot dataUrl={dataUrl} className="mt-2" key={index} />;
                    } else if (c.type === 'text') {
                       return (
                        <pre className="mt-1 font-code-sm bg-bg-200 p-2 rounded overflow-x-auto text-text-200" key={index}>
                          {c.text}
                        </pre>
                       )
                    }
                    return null;
                  })}
                </div>
              ) : (
                <pre className="mt-1 text-xs bg-bg-200 p-2 rounded overflow-x-auto text-text-200">
                  {typeof result.content === "string"
                    ? result.content
                    : JSON.stringify(result.content, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getToolDisplayInfo(
  result: any,
  toolInfo: ToolUse,
): ToolDisplayInfo | null {
  const { name, input } = toolInfo;
  
  if (name === "computer") {
    const action = input?.action;
    const resultJson = typeof result.content === 'string' ? (() => { try { return JSON.parse(result.content) } catch { return null }})() : null;
    const effectiveAction = resultJson?.action || action;
    
    switch (effectiveAction) {
      case "screenshot": return { icon: <CameraIcon className="w-4 h-4 text-text-300" />, text: "Take screenshot" };
      case "left_click": return { icon: <span className="text-text-300"><CursorClickIcon size={16} color="currentColor"/></span>, text: "Click" };
      case "right_click": return { icon: <span className="text-text-300"><CursorIcon size={16} color="currentColor"/></span>, text: "Right-click" };
      case "double_click": return { icon: <span className="text-text-300"><CursorClickIcon size={16} color="currentColor"/></span>, text: "Double-click" };
      case "triple_click": return { icon: <span className="text-text-300"><CursorClickIcon size={16} color="currentColor"/></span>, text: "Triple-click" };
      case "type": {
          const text = input?.text;
          return { icon: <span className="text-text-300"><TextTIcon weight="light" size={16} color="currentColor" /></span>, text: text ? `Type: "${truncate(text, 30)}"` : "Type text" };
      }
      case "wait": {
          const duration = input?.duration;
          return { icon: <ClockIcon className="w-4 h-4 text-text-300" />, text: `Wait ${duration} second${duration === 1 ? '' : 's'}` };
      }
      case "scroll": {
          const dir = input?.scroll_direction || 'down';
          return { icon: getScrollIcon(dir), text: `Scroll ${dir}` };
      }
      case "key": {
          const text = input?.text;
          return { icon: <KeyboardIcon className="w-4 h-4 text-text-300" />, text: text ? `Press key: ${text}` : "Press key" };
      }
      case "left_click_drag": return { icon: <span className="text-text-300"><SelectionPlusIcon size={16} color="currentColor"/></span>, text: "Drag" };
      default: return { icon: <SettingsIcon className="w-4 h-4 text-text-300" />, text: `Computer action: ${effectiveAction || action || 'Unknown'}` };
    }
  }

  switch(name) {
    case 'screenshot': return { icon: <CameraIcon className="w-4 h-4 text-text-300" />, text: "Take screenshot" };
    case 'read_page': {
        const filter = input?.filter ? ` (${input.filter})` : '';
        return { icon: <SelectionPlusIcon className="w-4 h-4 text-text-300" />, text: `Read page${filter}` };
    }
    case 'find': {
        const query = input?.query;
        return { icon: <SearchIcon className="w-4 h-4 text-text-300" />, text: query ? `Find: "${truncate(query, 30)}"` : "Find element" };
    }
    case 'get_page_text': return { icon: <span className="text-text-300"><FilterIcon size={16} color="currentColor"/></span>, text: "Extract page text" };
    case 'scroll': { // This block is likely legacy or alternative, `computer` tool now handles scroll.
        const args = input;
        let text = 'Scroll';
        let icon = <ArrowDownIcon className="w-4 h-4 text-text-300" />;
        if (args?.direction) {
            text = `Scroll ${args.direction}`;
            icon = getScrollIcon(args.direction) as any;
        } else if (args?.text) {
            text = `Scroll to: "${truncate(args.text, 20)}"`;
        } else if (args?.ref) {
            text = "Scroll to element";
        }
        return { icon, text };
    }
    case 'key': { // Legacy key tool
        const keys = input?.key?.split(' ').filter((k: string) => k.length > 0) || [];
        let text = "";
        if (keys.length === 1) text = `Press ${keys[0]} key`;
        else if (keys.length <= 5) text = `Press keys: ${keys.join(", ")}`;
        else {
            const counts: Record<string, number> = {};
            keys.forEach((k: string) => { counts[k] = (counts[k] || 0) + 1; });
            text = `Press ${keys.length} keys: ${Object.entries(counts).map(([k, v]) => v > 1 ? `${k} ×${v}`: k).join(", ")}`;
        }
        return { icon: <KeyboardIcon className="w-4 h-4 text-text-300" />, text };
    }
    case 'wait': return { icon: <ClockIcon className="w-4 h-4 text-text-300" />, text: `Wait ${input?.duration} second${input?.duration === 1 ? '' : 's'}` };
    case 'type': return { icon: <TextTIcon weight="light" size={16} className="text-text-300" />, text: `Type: "${truncate(input?.text, 30)}"` };
    case 'form_input': {
        const val = input?.value;
        let text = "Set form value";
        if (val) text = `Set input to "${truncate(String(val), 20)}"`;
        return { icon: <span className="text-text-300"><TextboxIcon size={16} color="currentColor"/></span>, text };
    }
    case 'click': { // Legacy click tool
        const text = input?.text ? `Click: "${truncate(input.text, 30)}"` : "Click";
        return { icon: <CursorClickIcon size={16} className="text-text-300" />, text };
    }
    case 'navigate': return { icon: <span className="text-text-300"><NavigationArrowIcon size={16} color="currentColor"/></span>, text: `Navigate to ${truncate(input?.url, 30)}` };
    default: return { icon: <SettingsIcon className="w-4 h-4 text-text-300" />, text: `Tool: ${name || 'Unknown'}` };
  }
}

function truncate(str: string, length: number): string {
    if (!str) return "";
    return str.length > length ? `${str.substring(0, length)}...` : str;
}

function getScrollIcon(direction: string): React.ReactNode {
    switch(direction) {
        case 'up': return <ArrowUpIcon className="w-4 h-4 text-text-300" />;
        case 'down': return <ArrowDownIcon className="w-4 h-4 text-text-300" />;
        case 'left': return <ArrowLeftIcon className="w-4 h-4 text-text-300" />;
        case 'right': return <ArrowRightIcon className="w-4 h-4 text-text-300" />;
        default: return <ArrowDownIcon className="w-4 h-4 text-text-300" />;
    }
}