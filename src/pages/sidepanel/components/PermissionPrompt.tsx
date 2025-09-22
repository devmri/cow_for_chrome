// 原始函数: By 和 $y

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ScreenshotWithClick } from "./ScreenshotPreview";
import {
  EyeIcon as ShieldIconSolid,
  CommandKeySvg,
  ArrowRightIcon,
  EscKeyIcon,
} from "../../../components/icons";
import {
  actionVerb,
  PermissionDuration,
  ToolAction,
} from "../../../lib/permissions";

interface PermissionPromptProps {
  tool: ToolAction;
  url: string;
  screenshot?: string;
  coordinate?: [number, number];
  typeText?: string;
  fromDomain?: string;
  toDomain?: string;
  onAllow: (duration: PermissionDuration, netloc: any) => void;
  onDeny: () => void;
  disableAlwaysAllow?: boolean;
}

/**
 * A prompt shown to the user to request permission for an action.
 * @original By
 */
export function PermissionPrompt({
  tool,
  url,
  screenshot,
  coordinate,
  typeText,
  fromDomain,
  toDomain,
  onAllow,
  onDeny,
  disableAlwaysAllow = false,
}: PermissionPromptProps) {
  const [activeButton, setActiveButton] = useState<string | null>(null);

  let hostname = "";
  try {
    const urlObj = new URL(url);
    hostname = urlObj.host;
  } catch {
    hostname = url;
  }

  const netloc = useMemo(
    () =>
      tool === ToolAction.DOMAIN_TRANSITION
        ? { type: "domain_transition", fromDomain, toDomain }
        : { type: "netloc", netloc: hostname },
    [tool, fromDomain, toDomain, hostname]
  );

  const allowOnce = useCallback(() => {
    onAllow(PermissionDuration.ONCE, netloc);
  }, [onAllow, netloc]);

  const allowAlways = useCallback(() => {
    if (!disableAlwaysAllow) {
      onAllow(PermissionDuration.ALWAYS, netloc);
    }
  }, [onAllow, netloc, disableAlwaysAllow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!disableAlwaysAllow) {
          setActiveButton("always");
          setTimeout(() => {
            allowAlways();
          }, 150);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        setActiveButton("once");
        setTimeout(() => {
          allowOnce();
        }, 150);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveButton("deny");
        setTimeout(() => {
          onDeny();
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowAlways, allowOnce, onDeny, disableAlwaysAllow]);

  return (
    <div className="bg-bg-000 rounded-[14px]">
      <div className="flex items-center gap-2 py-[10px] px-4">
        <ShieldIconSolid size={20} className="text-text-100" />
        <h3 className="font-styrene text-[14px] font-normal leading-[140%] text-text-100">
          Permission required
        </h3>
      </div>
      <div className="border-t border-border-300 mb-4" />
      <div className="space-y-4 px-4">
        <div>
          {tool === ToolAction.DOMAIN_TRANSITION && fromDomain && toDomain ? (
            <>
              <p className="font-base-bold text-text-100">
                Claude paused due to a navigation from{" "}
                <strong>{fromDomain}</strong> to <strong>{toDomain}</strong>
              </p>
            </>
          ) : (
            <>
              <p className="font-base-bold text-text-100">
                Claude wants to {actionVerb(tool)}:
              </p>
              <p className="font-claude-response-code text-text-200">
                {hostname}
              </p>
            </>
          )}
        </div>
        {tool === ToolAction.CLICK && screenshot && coordinate && (
          <div>
            <ScreenshotWithClick
              screenshot={screenshot}
              coordinates={coordinate}
              className="mx-auto"
            />
          </div>
        )}
        {tool === ToolAction.TYPE && typeText && (
          <div>
            <p className="font-base-bold text-text-100 mb-2">
              Text to be typed:
            </p>
            <div className="p-3 bg-bg-100 border border-border-200 rounded-lg">
              <code className="font-claude-response-code text-text-200 whitespace-pre-wrap break-all">
                {typeText}
              </code>
            </div>
          </div>
        )}
      </div>
      <div className="px-3 py-[10px] space-y-[5px] mt-[10px] mb-0.5">
        <PromptButton onClick={allowOnce} isActive={activeButton === "once"}>
          <span>
            {tool === ToolAction.DOMAIN_TRANSITION
              ? "Continue"
              : "Allow this action"}
          </span>
          <ArrowRightIcon className="text-text-500" />
        </PromptButton>
        <PromptButton onClick={onDeny} isActive={activeButton === "deny"}>
          <span>
            {tool === ToolAction.DOMAIN_TRANSITION ? "Stop" : "Decline"}
          </span>
          <EscKeyIcon className="text-text-500" />
        </PromptButton>

        <div className="border-t-[0.5px] border-border-300 my-3 -mx-3" />

        {disableAlwaysAllow ? (
          <p className="font-small text-text-500 text-[9px] px-1 mt-1">
            Site-level permissions are disabled for this site.
          </p>
        ) : (
          <PromptButton
            onClick={allowAlways}
            isActive={activeButton === "always"}
            height="55px"
          >
            <div className="flex flex-col items-start">
              <span>
                {tool === ToolAction.DOMAIN_TRANSITION
                  ? "Always continue"
                  : "Always allow actions on this site"}
              </span>
              <span className="font-styrene text-[12px] font-normal leading-[140%] tracking-[-0.24px] text-text-500">
                {tool === ToolAction.DOMAIN_TRANSITION
                  ? "When navigating between these sites"
                  : "Browse, click, and type"}
              </span>
            </div>
            <span className="flex items-center gap-0.5">
              <CommandKeySvg className="text-text-500" />
              <ArrowRightIcon className="text-text-500" />
            </span>
          </PromptButton>
        )}

        <p className="font-small text-text-500 text-[10px] px-1 mt-1">
          Claude will not purchase items, create accounts, or bypass captchas
          without input. Revoke site permissions in{" "}
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="underline hover:text-text-400"
          >
            settings
          </button>
          .
        </p>
      </div>
    </div>
  );
}

const PromptButton = ({
  onClick,
  children,
  isActive = false,
  height,
}: {
  onClick: () => void;
  children: React.ReactNode;
  isActive?: boolean;
  height?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full font-base flex min-w-[75px] px-[14px] py-[3px] justify-between items-center gap-2 rounded-lg border-[0.5px] transition-colors font-medium text-text-100 ${
      isActive
        ? "bg-bg-300 border-border-400"
        : "border-border-200 hover:bg-bg-100"
    } ${height ? "" : "h-8"}`}
    style={height ? { height } : undefined}
  >
    {children}
  </button>
);
