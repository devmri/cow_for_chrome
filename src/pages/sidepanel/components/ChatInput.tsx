import React, { useEffect, useCallback } from "react";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { PermissionToggle } from "./PermissionToggle";
import { SystemCommand } from "./App";
import { cn } from "../../../utils/classNames";
import { StopIcon } from "../../../components/icons";
import { SavedPrompt } from "../../../lib/savedPrompts";

interface ChatInputProps {
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onSendMessage: () => void;
  onStopMessage: () => void;
  isLoading: boolean;
  isCompacting: boolean;
  skipAllPermissions: boolean;
  onSkipAllPermissionsChange: (skip: boolean) => void;
  isSkipPermissionsDisabled: boolean;
  systemCommands: SystemCommand[];
  showSlashMenu: boolean;
  onShowSlashMenuChange: (show: boolean) => void;
  slashCommandQuery: string;
  onSlashCommandQueryChange: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSavePrompt: (prompt: string | Partial<SavedPrompt>) => void;
  hasMessages: boolean;
  canSkipPermissions: boolean;
}

export function ChatInput({
  inputValue,
  onInputValueChange,
  onSendMessage,
  onStopMessage,
  isLoading,
  isCompacting,
  skipAllPermissions,
  onSkipAllPermissionsChange,
  isSkipPermissionsDisabled,
  systemCommands,
  showSlashMenu,
  onShowSlashMenuChange,
  slashCommandQuery,
  onSlashCommandQueryChange,
  textareaRef,
  onSavePrompt,
  hasMessages,
  canSkipPermissions,
}: ChatInputProps) {
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue, textareaRef]);

  const closeSlashMenu = useCallback(() => {
    onShowSlashMenuChange(false);
    onSlashCommandQueryChange("");
  }, [onShowSlashMenuChange, onSlashCommandQueryChange]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      onInputValueChange(value);

      if (value === "/" || (value.startsWith("/") && !value.includes(" "))) {
        onShowSlashMenuChange(true);
        onSlashCommandQueryChange(value.substring(1));
      } else {
        closeSlashMenu();
      }

      event.target.style.height = "auto";
      event.target.style.height = `${event.target.scrollHeight}px`;
    },
    [
      onInputValueChange,
      onShowSlashMenuChange,
      onSlashCommandQueryChange,
      closeSlashMenu,
    ]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape" && showSlashMenu) {
        event.preventDefault();
        closeSlashMenu();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !showSlashMenu) {
        event.preventDefault();
        if (!isLoading) {
          onSendMessage();
        }
      }
    },
    [showSlashMenu, closeSlashMenu, isLoading, onSendMessage]
  );

  const handleSlashSelect = useCallback(
    (prompt: SavedPrompt) => {
      onInputValueChange(prompt.prompt ?? "");
      closeSlashMenu();
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      });
    },
    [onInputValueChange, closeSlashMenu, textareaRef]
  );

  const handleSlashCreate = useCallback(() => {
    closeSlashMenu();
    const currentValue = inputValue || "";
    if (currentValue.startsWith("/")) {
      const command = currentValue.slice(1).split(" ")[0];
      onSavePrompt({ prompt: "", command });
    } else {
      onSavePrompt(currentValue);
    }
  }, [closeSlashMenu, inputValue, onSavePrompt]);

  const placeholder = hasMessages
    ? "Reply to Cow"
    : "What can I do for you?";

  return (
    <div className="mx-3 mb-3 relative">
      <div
        className="bg-bg-000 border-[0.5px] border-border-300 hover:border-border-200 rounded-[14px] relative z-30 transition-colors focus-within:outline-none"
        style={{
          boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.04)",
          outline: "none",
        }}
      >
        {showSlashMenu && (
          <SlashCommandMenu
            searchTerm={slashCommandQuery}
            systemCommands={systemCommands}
            onSelect={handleSlashSelect}
            onClose={closeSlashMenu}
            onCreateNew={handleSlashCreate}
          />
        )}

        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            data-test-id="message-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full resize-none focus:outline-none focus:ring-0 focus:border-transparent text-text-100 placeholder-text-400 overflow-y-auto font-base"
            rows={1}
            style={{
              minHeight: "24px",
              maxHeight: "50vh",
              height: "auto",
              outline: "none",
            }}
            placeholder={placeholder}
          />
        </div>

        <div className="flex items-center justify-between px-3 pb-3 relative">
          {canSkipPermissions ? (
            <PermissionToggle
              skipAllPermissions={skipAllPermissions}
              onToggle={onSkipAllPermissionsChange}
              disabled={isSkipPermissionsDisabled}
            />
          ) : (
            <div />
          )}

          <div className="flex items-center">
            {isLoading || isCompacting ? (
              <button
                data-test-id="stop-button"
                onClick={onStopMessage}
                className="inline-flex items-center justify-center relative shrink-0 select-none font-medium h-7 w-7 rounded-lg active:scale-95 border-[0.5px] border-border-300 text-text-200 hover:bg-bg-200 transition-colors"
                type="button"
                aria-label="Stop message"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                data-test-id="send-button"
                onClick={onSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  "inline-flex items-center justify-center relative shrink-0 select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none font-medium transition-colors h-7 w-7 rounded-lg active:scale-95",
                  skipAllPermissions
                    ? "bg-[#BF8534] hover:bg-[#A06F2C] text-white"
                    : "bg-accent-main-000 hover:bg-accent-main-200 text-oncolor-100"
                )}
                type="button"
                aria-label="Send message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  className="transition-colors"
                >
                  <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
