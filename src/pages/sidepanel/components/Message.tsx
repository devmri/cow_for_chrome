import React, { useState, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  ChevronDown,
  Save,
} from "lucide-react";
import { Message as MessageType, ToolUse } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolResult } from "./ToolResult";
import { CustomTooltip } from "./Tooltip";
import { getLocalValue, StorageKey } from "../../../lib/storage";
import { cn } from "../../../utils/classNames";
import { ThumbsUpFilledIcon, ThumbsUpIcon, ThumbsDownIcon, ThumbsDownFilledIcon  } from "../../../components/icons";

interface MessageProps {
  message: MessageType;
  previousMessages?: MessageType[];
  isLastMessage?: boolean;
  isStreaming?: boolean;
  submittedFeedback?: "positive" | "negative" | null;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  showThumbs?: boolean;
  onSavePrompt?: (prompt: string) => void;
}

export function Message({
  message,
  previousMessages = [],
  isLastMessage = false,
  isStreaming = false,
  submittedFeedback = null,
  onThumbsUp,
  onThumbsDown,
  showThumbs = false,
  onSavePrompt,
}: MessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isAssistantHovered, setIsAssistantHovered] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showTraceIds, setShowTraceIds] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    getLocalValue<boolean>(StorageKey.DEBUG_MODE).then((val) => {
      setDebugMode(val !== undefined ? val : false);
    });
    getLocalValue<boolean>(StorageKey.SHOW_TRACE_IDS).then((val) => {
      if (val !== undefined) setShowTraceIds(val);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[StorageKey.DEBUG_MODE]?.newValue !== undefined) {
        setDebugMode(changes[StorageKey.DEBUG_MODE].newValue);
      }
      if (changes[StorageKey.SHOW_TRACE_IDS]?.newValue !== undefined) {
        setShowTraceIds(changes[StorageKey.SHOW_TRACE_IDS].newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const textBlocks = Array.isArray(message.content)
    ? message.content.filter((c) => c.type === "text")
    : [];
  const textContent =
    typeof message.content === "string"
      ? message.content
      : textBlocks.map((c: any) => c.text).join("");

  const copyToClipboard = async () => {
    if (textContent) {
      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (message.role === "user") {
    const toolResults = Array.isArray(message.content)
      ? message.content.filter((c) => c.type === "tool_result")
      : [];

    const toolUseMap = new Map<string, ToolUse>();
    let lastScreenshot: string | null = null;

    [...previousMessages, message].forEach((msg) => {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        msg.content.forEach((c: any) => {
          if (c.type === "tool_use" && c.id) {
            toolUseMap.set(c.id, { name: c.name, input: c.input, id: c.id });
          }
        });
      }
       if (msg.role === 'user' && Array.isArray(msg.content)) {
            msg.content.forEach((c: any) => {
                if (c.type === 'tool_result' && Array.isArray(c.content)) {
                    c.content.forEach((innerContent: any) => {
                        if (innerContent.type === 'image' && innerContent.source?.type === 'base64') {
                            lastScreenshot = `data:${innerContent.source.media_type};base64,${innerContent.source.data}`;
                        }
                    });
                }
            });
        }
    });

    const isToolOnlyMessage = toolResults.length > 0 && !textContent;
    
    return (
      <div
        className={isToolOnlyMessage ? "w-full py-3" : "flex justify-end"}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={
            isToolOnlyMessage ? "w-full" : "flex flex-col items-end max-w-[85%]"
          }
        >
          <div
            className={cn(
              "relative break-words",
              textContent && toolResults.length === 0
                ? "px-4 py-3 bg-bg-300 rounded-[14px]"
                : "w-full",
            )}
          >
            {textContent && (
              <div
                className={cn(
                  "relative transition-all duration-300 ease-in-out",
                  toolResults.length > 0 && "ml-auto px-4 py-3 bg-bg-300 rounded-[14px]",
                  !isExpanded &&
                    textContent.length > 500 &&
                    "max-h-[300px] overflow-hidden",
                  isExpanded &&
                    textContent.length > 500 &&
                    "max-h-[50000px] overflow-hidden",
                )}
              >
                <MarkdownRenderer text={textContent} variant="user" />
                {!isExpanded && textContent.length > 500 && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-bg-300 to-transparent pointer-events-none transition-opacity duration-300" />
                )}
                {textContent.length > 500 && isHovered && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute bottom-0.5 right-0 p-1.5 bg-bg-500 hover:bg-bg-200 rounded-full transition-colors border-[0.5px] border-border-400/50"
                    aria-label={isExpanded ? "Collapse message" : "Expand message"}
                  >
                    <div className={cn("transition-transform duration-300", isExpanded && "rotate-180")}>
                        <ChevronDown size={12} className="text-text-300" />
                    </div>
                  </button>
                )}
              </div>
            )}
            {toolResults.length > 0 && (
              <div className="space-y-2">
                {toolResults.map((res: any, index) => {
                  const toolInfo = res.tool_use_id
                    ? toolUseMap.get(res.tool_use_id)
                    : undefined;
                  return (
                    <ToolResult
                      key={res.tool_use_id || index}
                      result={res}
                      toolInfo={toolInfo}
                      lastScreenshot={lastScreenshot}
                      debugMode={debugMode}
                    />
                  );
                })}
              </div>
            )}
          </div>
          {textContent && (
            <div className="h-7 flex justify-end items-center">
              {isHovered && (
                <div className="flex items-center gap-0.5 pr-1">
                  {onSavePrompt && (
                     <CustomTooltip tooltipContent="Save as shortcut" side="bottom">
                        <button
                          onClick={() => onSavePrompt(textContent)}
                          className="p-1.5 rounded-md transition-colors text-text-300 hover:bg-bg-300 hover:text-text-100"
                          aria-label="Save as shortcut"
                        >
                          <Save size={12} />
                        </button>
                    </CustomTooltip>
                  )}
                  <CustomTooltip
                    tooltipContent={isCopied ? "Copied" : "Copy"}
                    side="bottom"
                    open={isCopied || undefined}
                    delayDuration={isCopied ? 0 : 200}
                  >
                    <button
                      onClick={copyToClipboard}
                      className="p-1.5 rounded-md transition-colors text-text-300 hover:bg-bg-300 hover:text-text-100"
                      aria-label="Copy message"
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </CustomTooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!textContent) return null;
 
  const showFeedbackButtons =
    showThumbs &&
    // @ts-ignore  
    onThumbsUp &&
    // @ts-ignore  
    onThumbsDown &&
    ((isLastMessage && !isStreaming) || (!isLastMessage && isAssistantHovered));

  return (
    <div
      className="flex items-start"
      onMouseEnter={() => setIsAssistantHovered(true)}
      onMouseLeave={() => setIsAssistantHovered(false)}
    >
      <div className="max-w-4xl claude-response w-full break-words">
        {showTraceIds && message.traceId && (
            <div className="mb-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-300 text-text-400">
                    (Ant-only) TraceID: {message.traceId}
                </span>
            </div>
        )}
        <MarkdownRenderer text={textContent} variant="assistant" />
        {showThumbs && (
            <div className="h-7 flex items-center">
                {showFeedbackButtons && (
                    <div className="flex items-center gap-0.5 mt-2 -ml-1.5">
                        <CustomTooltip tooltipContent="Give positive feedback" side="bottom">
                            <button
                                onClick={onThumbsUp}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    submittedFeedback === 'positive' ? "text-text-100" : "text-text-300 hover:bg-bg-300 hover:text-text-100"
                                )}
                                aria-label="Good response"
                            >
                                {submittedFeedback === 'positive' ? <ThumbsUpFilledIcon size={12} /> : <ThumbsUpIcon size={12} />}
                            </button>
                        </CustomTooltip>
                        <CustomTooltip tooltipContent="Give negative feedback" side="bottom">
                            <button
                                onClick={onThumbsDown}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    submittedFeedback === 'negative' ? "text-text-100" : "text-text-300 hover:bg-bg-300 hover:text-text-100"
                                )}
                                aria-label="Bad response"
                            >
                               {submittedFeedback === 'negative' ? <ThumbsDownFilledIcon size={12} /> : <ThumbsDownIcon size={12} />}
                            </button>
                        </CustomTooltip>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
