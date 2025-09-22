// 原始函数: xx

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "../hooks/useChat";
import { useVersionCheck } from "../hooks/useVersionCheck";
import { useDarkMode } from "../hooks/useDarkMode";
import { LoginCtaScreen } from "./LoginCta";
import { UpdateRequiredScreen } from "./UpdateRequiredScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { BlockedScreen } from "./BlockedScreen";
import { Message } from "./Message";
import { TypingIndicator } from "./TypingIndicator";
import { CompactionIndicator } from "./CompactionIndicator";
import { ConversationSummary } from "./ConversationSummary";
import { PermissionPrompt } from "./PermissionPrompt";
import { FeedbackModal } from "./FeedbackModal";
import { SkipPermissionsModal } from "./modals/SkipPermissionsModal";
import { UpsellAntBuildModal } from "./modals/UpsellAntBuildModal";
import { SavePromptModal } from "./SavePromptModal";
import { ChatInput } from "./ChatInput";
import { ActiveBorder } from "./ActiveBorder";
import { CompactingStatus } from "./CompactingStatus";
import { InitialScreen } from "./InitialScreen";
import { Message as MessageType, PermissionRequest } from "../types";
import { DomainCategoryCache } from "../services/domainCache.service";
import { XIcon, Settings, RefreshCw } from "lucide-react";
import { CustomTooltip } from "./Tooltip";
import { useDynamicConfig, useFeatureGate } from "@statsig/react-bindings";
import { PermissionDuration, PermissionsManager } from "../../../lib/permissions";
import { SavedPrompt } from "../../../lib/savedPrompts";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { getLocalValue, setLocalKey, StorageKey } from "../../../lib/storage";
import ScheduledTaskLogsService from "../../../lib/scheduledTasks";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { ArrowDownIcon } from "../../../components/icons";
import { cn } from "../../../utils/classNames";
import { ensureValidAccessToken, getAccessToken } from "../../../lib/sentryService";

export interface SystemCommand {
    command: string;
    description: string;
    execute: () => void;
}

/**
 * The main application component for the side panel.
 * @original xx
 */
export function App() {
  const isDarkMode = useDarkMode();
  const [inputValue, setInputValue] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommandQuery, setSlashCommandQuery] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"positive" | "negative">("negative");
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<number | null>(null);
  const [submittedFeedback, setSubmittedFeedback] = useState<Map<number, "positive" | "negative">>(new Map());
  const {
    authToken,
    anthropicApiKey,
    anthropicApiUrl,
    needsOAuth,
    isLoading: isAuthLoading,
    refreshTokenIfNeeded,
  } = useAuth();
  const { value: modelsConfig } = useDynamicConfig("chrome_ext_models");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-20250514");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [permissionPrompt, setPermissionPrompt] = useState<PermissionRequest | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollDownButton, setShowScrollDownButton] = useState(false);
  const [skipAllPermissions, setSkipAllPermissions] = useState(false);
  const [isSkipPermissionsEnabled, setIsSkipPermissionsEnabled] = useState(false); // Controlled by feature gate + domain category
  const skipAllPermissionsRef = useRef(() => skipAllPermissions);
  skipAllPermissionsRef.current = () => skipAllPermissions;
  // @ts-ignore   
  const permissionManager = useMemo(() => new PermissionsManager(() => skipAllPermissionsRef.current()), []);
  const [showSkipConfirmModal, setShowSkipConfirmModal] = useState(false);
  const [hasContinuedFromDomainTransition, setHasContinuedFromDomainTransition] = useState(false);
  
  const [tabId, setTabId] = useState<number | undefined>();
  const [currentDomain, setCurrentDomain] = useState<string | undefined>();
  
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [domainCategory, setDomainCategory] = useState<string | null>(null);
  const [isBlockedPage, setIsBlockedPage] = useState(false);
  const promptFromOpener = useRef<string | null>(null);
  const shouldAutoSubmit = useRef(false);
  const [promptToSave, setPromptToSave] = useState<string | Partial<SavedPrompt> | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { value: canSkipPermissions } = useFeatureGate("crochet_can_skip_permissions");
  const { value: useDomainTransitionPrompts } = useFeatureGate("chrome_ext_domain_transition_prompts");
  const { value: canSubmitFeedback } = useFeatureGate("crochet_can_submit_feedback");
  const { value: canSeeBrowserIndicator } = useFeatureGate("crochet_can_see_browser_indicator");
  const { value: upsellAntBuild } = useFeatureGate("crochet_upsell_ant_build");

  const { analytics } = useAnalytics();
  const [permissionMode, setPermissionMode] = useState("ask");

  const { permissionPromptRef, paddingBottom } = usePermissionPromptSizing({
    permissionPrompt,
    messagesContainerRef,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
  });

  const blockedUrl = chrome.runtime.getURL("blocked.html");

  const closeSlashMenu = useCallback(() => {
    setShowSlashMenu(false);
    setSlashCommandQuery("");
  }, []);

  useEffect(() => {
    (async function () {
      const params = new URLSearchParams(window.location.search);
      let tabIdParam = params.get("tabId");
      let currentTabId: number | undefined;

      if (tabIdParam) {
        currentTabId = parseInt(tabIdParam);
      } else if (params.get("mode") === "window") {
        const targetTabId = await getLocalValue<number>(StorageKey.TARGET_TAB_ID);
        if (targetTabId) currentTabId = targetTabId;
      }
      setTabId(currentTabId);

      if (currentTabId) {
        try {
          const tab = await chrome.tabs.get(currentTabId);
          if (tab.url) {
            const category = await DomainCategoryCache.getCategory(tab.url);
            setDomainCategory(category || null);
            setIsBlockedPage(tab.url.startsWith(blockedUrl));
            try {
              const url = new URL(tab.url);
              setCurrentDomain(url.hostname);
            } catch (e) {
              setCurrentDomain(undefined);
            }
          }
        } catch (e) { /* Tab may have been closed */ }
      }
    })();
  }, [blockedUrl]);

  const versionInfo = useVersionCheck();

  useEffect(() => {
    let isMounted = true;
    getLocalValue<boolean>(StorageKey.BROWSER_CONTROL_PERMISSION_ACCEPTED).then(
      (accepted) => {
        if (isMounted) setHasAcceptedTerms(accepted === true);
      },
    );
    return () => {
      isMounted = false;
    };
  }, []);

  const [showUpsell, setShowUpsell] = useState(false);
  const hasShownUpsell = useRef(false);
  useEffect(() => {
    if (upsellAntBuild && chrome.runtime.id === 'aodaaaaehghpnpceiagoejlhplogbfen' && !hasShownUpsell.current) {
        setShowUpsell(true);
        hasShownUpsell.current = true;
    }
  }, [upsellAntBuild]);

  useEffect(() => {
    permissionManager.setCanSkipPermissions(canSkipPermissions);
  }, [canSkipPermissions, permissionManager]);
  
  const isSensitiveDomain = domainCategory === 'category3';
  const isHighRiskDomain = domainCategory !== 'category0' && domainCategory !== null;

  useEffect(() => {
    setIsSkipPermissionsEnabled(!isHighRiskDomain);
  }, [isHighRiskDomain]);

  useEffect(() => {
    if (isHighRiskDomain && skipAllPermissions) {
      setSkipAllPermissions(false);
    }
  }, [isHighRiskDomain, skipAllPermissions]);

  useEffect(() => {
    if (isSkipPermissionsEnabled) {
      setLocalKey(StorageKey.LAST_SKIP_PERMISSIONS_PREFERENCE, skipAllPermissions);
    }
  }, [skipAllPermissions, isSkipPermissionsEnabled]);

  useEffect(() => {
    (async () => {
        if(skipAllPermissions) {
            setPermissionMode('skip_all_permission_checks');
        } else {
            if (currentDomain) {
                // @ts-ignore
                if(await permissionManager.hasSiteWidePermissions(currentDomain)) {
                    setPermissionMode('allow_for_site');
                    return;
                }
            }
            setPermissionMode('ask');
        }
    })();
  }, [skipAllPermissions, currentDomain, permissionManager]);


  const {
    messages,
    messageHistory,
    sendMessage,
    cancel: stopMessage,
    clearMessages,
    isLoading,
    hasInteractiveTools,
    isCompacting,
    error,
    tokensSaved,
  } = useChat({
    apiKey: anthropicApiKey,
    apiBaseUrl: anthropicApiUrl,
    authToken,
    refreshTokenIfNeeded,
    model: selectedModel,
    sessionId,
    tabId,
    currentDomain,
    skipAllPermissions,
    permissionManager,
    permissionMode,
    onPermissionRequired: async (request: PermissionRequest) => {
        setPermissionPrompt(request);
        try {
            const domain = request.url ? new URL(request.url).hostname : 'this page';
            chrome.runtime.sendMessage({
                type: 'SHOW_PERMISSION_NOTIFICATION',
                action: 'browser_automation',
                domain,
            }, () => { chrome.runtime.lastError; });
        } catch(e) {/* ignore */}

        return new Promise<boolean>((resolve) => {
            permissionCallback.current = resolve;
        });
    },
  });
  
  const permissionCallback = useRef<((granted: boolean) => void) | null>(null);

  const handleInputValueChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    if (!authToken && !anthropicApiKey) return;

    const trimmedMessage = inputValue.trim();
    setInputValue("");
    setIsAutoScrollEnabled(true);
    closeSlashMenu();
    void sendMessage(trimmedMessage);
  }, [inputValue, isLoading, authToken, anthropicApiKey, closeSlashMenu, sendMessage]);

  const systemCommands: SystemCommand[] = useMemo(
    () => [
      {
        command: "compact",
        description: "Clear history and keep summary",
        execute: () => {
          setInputValue("");
          closeSlashMenu();
          setIsAutoScrollEnabled(true);
          void sendMessage("/compact");
        },
      },
    ],
    [sendMessage, closeSlashMenu]
  );

  const scrollToBottom = useCallback(() => {
    if (isAutoScrollEnabled) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isAutoScrollEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, messages[messages.length - 1]?.content, isLoading, permissionPrompt, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollDownButton(scrollTop > 10);
      if (!isAtBottom && isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false);
      } else if (isAtBottom && !isAutoScrollEnabled) {
        setIsAutoScrollEnabled(true);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAutoScrollEnabled, isAuthLoading, versionInfo.isBlocked, needsOAuth, hasAcceptedTerms]);

  useEffect(() => {
    if (!inputValue && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue]);


  const handleStopMessage = useCallback(() => {
    stopMessage();
    if(permissionCallback.current) {
        permissionCallback.current(false);
        permissionCallback.current = null;
        setPermissionPrompt(null);
    }
  }, [stopMessage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isLoading) {
        handleStopMessage();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isLoading, handleStopMessage]);

  const handleClearMessages = useCallback(() => {
    const clear = () => {
        clearMessages();
        setSessionId(crypto.randomUUID());
        setSubmittedFeedback(new Map());
        setIsAutoScrollEnabled(true);
        closeSlashMenu();
      };
    if (isLoading) {
        handleStopMessage();
        setTimeout(clear, 100);
    } else {
        clear();
    }
  }, [isLoading, handleStopMessage, clearMessages, closeSlashMenu]);

  const handlePermissionResponse = useCallback(async (duration: PermissionDuration, netloc: any) => {
    if (permissionPrompt && permissionCallback.current) {
        await permissionManager.grantPermission(netloc, duration, duration === PermissionDuration.ONCE ? permissionPrompt.toolUseId : undefined);
        chrome.notifications.getAll(notifications => {
            Object.keys(notifications).forEach(id => chrome.notifications.clear(id));
        });
        permissionCallback.current(true);
        permissionCallback.current = null;
        setPermissionPrompt(null);
    }
  }, [permissionPrompt, permissionManager]);
  
  const handleDenyPermission = useCallback(() => {
    if (permissionCallback.current) {
        chrome.notifications.getAll(notifications => {
            Object.keys(notifications).forEach(id => chrome.notifications.clear(id));
        });
        permissionCallback.current(false);
        permissionCallback.current = null;
        setPermissionPrompt(null);
    }
  }, []);

  useEffect(() => {
    const handleRuntimeMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (message?.type === "PING_SIDEPANEL") {
        sendResponse({ success: true, tabId });
        return true;
      }

      if (message?.type === "STOP_AGENT") {
        handleStopMessage();
        sendResponse({ success: true });
        return true;
      }

      if (message?.type === "EXECUTE_SCHEDULED_PROMPT") {
        const params = new URLSearchParams(window.location.search);
        const isWindowMode = params.get("mode") === "window";
        const sessionParam = params.get("sessionId");

        if (isWindowMode && sessionParam) {
          if (message.windowSessionId !== sessionParam) return false;
        } else {
          if (isWindowMode || message.windowSessionId) return false;
          if (message.targetTabId && tabId && tabId !== message.targetTabId) return false;
        }

        if (params.get("skipPermissions") === "true" && !skipAllPermissions) {
          setSkipAllPermissions(true);
        }

        const runLogId: string | undefined = message.runLogId;
        const promptText: string = message.taskName
          ? `[Scheduled Task: ${message.taskName}]\n${message.prompt ?? ""}`
          : message.prompt ?? "";

        setInputValue(promptText);
        promptFromOpener.current = promptText;
        shouldAutoSubmit.current = true;

        if (runLogId) {
          sessionStorage.setItem("currentScheduledTaskRunId", runLogId);
          sessionStorage.setItem("currentScheduledTaskName", message.taskName ?? "");
          void ScheduledTaskLogsService.addLogMessage(runLogId, {
            role: "user",
            content: promptText,
            timestamp: Date.now(),
          });
        }

        setTimeout(() => {
          if (!isLoading && (authToken || anthropicApiKey) && promptText.trim()) {
            setIsAutoScrollEnabled(true);
            setInputValue("");
            promptFromOpener.current = null;
            shouldAutoSubmit.current = false;
            closeSlashMenu();
            void sendMessage(promptText);
          }
        }, 500);
        return false;
      }

      if (message?.type === "POPULATE_INPUT_TEXT") {
        const promptText: string = message.prompt ?? "";
        setInputValue(promptText);
        promptFromOpener.current = promptText;
        shouldAutoSubmit.current = true;

        setTimeout(() => {
          if (!isLoading && (authToken || anthropicApiKey) && promptText.trim()) {
            setIsAutoScrollEnabled(true);
            setInputValue("");
            promptFromOpener.current = null;
            shouldAutoSubmit.current = false;
            closeSlashMenu();
            void sendMessage(promptText);
          }
        }, 500);

        sendResponse({ success: true });
        return true;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [
    anthropicApiKey,
    authToken,
    closeSlashMenu,
    handleStopMessage,
    isLoading,
    sendMessage,
    skipAllPermissions,
    tabId,
  ]);

  if (isAuthLoading) return <LoadingSpinner />;
  if (versionInfo.isBlocked) return <UpdateRequiredScreen currentVersion={versionInfo.currentVersion} minSupportedVersion={versionInfo.minSupportedVersion || ""} />;
  if (needsOAuth) return <LoginCtaScreen />;
  if (!hasAcceptedTerms) return <OnboardingScreen onAccept={() => {
        setLocalKey(StorageKey.BROWSER_CONTROL_PERMISSION_ACCEPTED, true).then(() => {
            setHasAcceptedTerms(true);
            if (promptFromOpener.current) {
                setTimeout(() => {
                    setIsAutoScrollEnabled(true);
                sendMessage(promptFromOpener.current as any);
                promptFromOpener.current = null;
                setInputValue('');
                closeSlashMenu();
            }, 100);
        }
    });
  }} />;
  if (isBlockedPage) return <BlockedScreen />;
  
  return (
    <div className="relative h-screen">
        <ActiveBorder isActive={skipAllPermissions} />
        <div className="flex flex-col h-screen bg-bg-100 relative overflow-hidden">
            <div className="flex justify-between items-center px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-text-300 font-ui font-normal leading-[140%] tracking-[-0.3px]">Research preview</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <CustomTooltip tooltipContent="Clear chat">
                        <button onClick={handleClearMessages} className="p-1.5 rounded-md transition-colors text-text-300 hover:bg-bg-300 hover:text-text-100" aria-label="New chat">
                            <RefreshCw size={12} />
                        </button>
                    </CustomTooltip>
                    <CustomTooltip tooltipContent="Settings">
                         <button onClick={() => chrome.runtime.openOptionsPage()} className="p-1.5 rounded-md transition-colors text-text-300 hover:bg-bg-300 hover:text-text-100" aria-label="Settings">
                            <Settings size={12} />
                        </button>
                    </CustomTooltip>
                </div>
            </div>

            {showScrollDownButton && <div className="absolute top-[50px] left-0 right-0 h-8 bg-gradient-to-b from-bg-100 to-transparent pointer-events-none z-10" />}
            
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 pt-0 pb-4 space-y-0" style={{ paddingBottom: skipAllPermissions ? `calc(${paddingBottom} + 40px)` : paddingBottom }}>
                {messages.length === 0 && (
                    <InitialScreen
                        tabId={tabId}
                        onPromptClick={(prompt: string) => {
                            setInputValue(prompt);
                            closeSlashMenu();
                            setTimeout(() => {
                                if (textareaRef.current) {
                                    textareaRef.current.style.height = 'auto';
                                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                                    textareaRef.current.focus();
                                }
                            }, 0);
                        }}
                    />
                )}
                
                {messageHistory.length > 0 && (
                    <>
                        {messageHistory.map((msg, index) => (
                             <div key={`history-${index}`} className="opacity-60">
                                <Message message={msg} previousMessages={messageHistory.slice(0, index)} isLastMessage={false} isStreaming={false} onThumbsUp={()=>{}} onThumbsDown={()=>{}} />
                             </div>
                        ))}
                        <CompactionIndicator />
                    </>
                )}

                {messages.map((msg, index) => {
                    if(msg.isCompactSummary) return <ConversationSummary key={index} message={msg} />;

                    const isLast = index === messages.length - 1;
                    const isAssistant = msg.role === 'assistant';
                    let shouldShowThumbs = false;
                    if (isAssistant && !msg.isCompactionMessage) {
                        if (index === messages.length - 1) { // is last message
                            shouldShowThumbs = true;
                        } else {
                            let nextUserMessageIndex = -1;
                            for (let i = index + 1; i < messages.length; i++) {
                                // @ts-ignore
                                if (messages[i].role === 'user' && (typeof messages[i].content === 'string' || (Array.isArray(messages[i].content) && messages[i].content.some((c: any) => c.type === 'text')))) {
                                    nextUserMessageIndex = i;
                                    break;
                                }
                            }
                            if (nextUserMessageIndex !== -1) {
                                let hasAssistantInBetween = false;
                                for (let i = index + 1; i < nextUserMessageIndex; i++) {
                                    if (messages[i].role === 'assistant') {
                                        hasAssistantInBetween = true;
                                        break;
                                    }
                                }
                                if (!hasAssistantInBetween) {
                                    shouldShowThumbs = true;
                                }
                            }
                        }
                    }

                    return (
                        <div key={index} className={msg.isCompactionMessage ? "mb-5" : ""}>
                            <Message 
                                message={msg}
                                previousMessages={messages.slice(0, index)}
                                isLastMessage={isLast}
                                isStreaming={isLast && isAssistant && isLoading}
                                submittedFeedback={submittedFeedback.get(index) || null}
                                onThumbsUp={() => { setFeedbackType("positive"); setFeedbackMessageIndex(index); setShowFeedbackModal(true); }}
                                onThumbsDown={() => { setFeedbackType("negative"); setFeedbackMessageIndex(index); setShowFeedbackModal(true); }}
                                showThumbs={shouldShowThumbs}
                                onSavePrompt={msg.role === 'user' ? (prompt) => setPromptToSave(prompt) : undefined}
                            />
                        </div>
                    );
                })}

                {(isLoading || isCompacting) && !permissionPrompt && (
                    <div className="flex items-center gap-3">
                        <TypingIndicator />
                        {isCompacting && <CompactingStatus isDarkMode={isDarkMode} />}
                    </div>
                )}
                
                {error && (
                     <div className="p-4 bg-danger-900 border border-danger-200 rounded-lg">
                        <div className="flex items-start">
                            <svg className="w-5 h-5 text-danger-200 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-base-bold text-danger-000">Error</h3>
                                <p className="font-base-sm text-danger-000 mt-1 break-all whitespace-pre-wrap">{error}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="relative">
                {!isAutoScrollEnabled && (
                    <div className={cn("absolute left-1/2 transform -translate-x-1/2 z-20", skipAllPermissions ? "-top-30" : "-top-12")}>
                         <button onClick={() => { setIsAutoScrollEnabled(true); messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                            className="flex items-center justify-center w-8 h-8 bg-bg-100 border-[0.5px] border-border-300 rounded-full shadow-md hover:bg-bg-000 transition-colors"
                            aria-label="Resume auto-scroll">
                            <ArrowDownIcon size={16} className="text-text-300" />
                        </button>
                    </div>
                )}
                
                <div className="relative">
                     <AnimatePresence>
                        {skipAllPermissions && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.12, ease: 'easeOut' }}
                                className="absolute bottom-full -mb-3 left-0 right-0 z-0 overflow-hidden"
                            >
                                <div className="bg-[#F7ECC1] dark:bg-[#F5DB9A] border-[0.5px] border-border-300 border-b-0 rounded-t-[14px] px-4 pt-2.5 pb-0 flex flex-col justify-end">
                                    <div className="text-[#141413] pb-5">
                                        <span className="font-small-bold">HIGH RISK:</span>{' '}
                                        <span className="font-small">No permission checks except sensitive actions. Hidden website instructions can still trick Claude into taking unintended actions. Review{' '}</span>
                                        <button onClick={() => chrome.tabs.create({ url: "https://support.anthropic.com/en/articles/12012173-getting-started-with-claude-for-chrome#h_d35ef0174c"})} className="font-small text-[#141413] underline hover:text-[#141413]/80 transition-colors">risks</button>
                                        <span className="font-small">.</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <ChatInput
                        inputValue={inputValue}
                        onInputValueChange={handleInputValueChange}
                        onSendMessage={handleSendMessage}
                        onStopMessage={handleStopMessage}
                        isLoading={isLoading}
                        isCompacting={isCompacting}
                        skipAllPermissions={skipAllPermissions}
                        onSkipAllPermissionsChange={(skip) => {
                            if(skip && !skipAllPermissions) {
                                if(isHighRiskDomain) return;
                                setShowSkipConfirmModal(true);
                            } else {
                                setSkipAllPermissions(skip);
                            }
                        }}
                        isSkipPermissionsDisabled={!isSkipPermissionsEnabled}
                        systemCommands={systemCommands}
                        showSlashMenu={showSlashMenu}
                        onShowSlashMenuChange={setShowSlashMenu}
                        slashCommandQuery={slashCommandQuery}
                        onSlashCommandQueryChange={setSlashCommandQuery}
                        textareaRef={textareaRef}
                        onSavePrompt={setPromptToSave}
                        hasMessages={messages.length > 0}
                        canSkipPermissions={canSkipPermissions}
                     />
                </div>
            </div>

            {permissionPrompt && (
                <div ref={permissionPromptRef} className="fixed z-50 border border-border-300 rounded-[14px]" style={{bottom: '11.5px', left: '11.5px', right: '11.5px'}}>
                    <PermissionPrompt 
                        tool={permissionPrompt.tool}
                        url={permissionPrompt.url}
                        screenshot={permissionPrompt.actionData?.screenshot}
                        coordinate={permissionPrompt.actionData?.coordinate}
                        typeText={permissionPrompt.actionData?.text}
                        fromDomain={permissionPrompt.actionData?.fromDomain}
                        toDomain={permissionPrompt.actionData?.toDomain}
                        onAllow={handlePermissionResponse}
                        onDeny={handleDenyPermission}
                        disableAlwaysAllow={isSensitiveDomain}
                    />
                </div>
            )}
            {showFeedbackModal && (
                <div className="fixed z-50 border border-border-300 rounded-[14px]" style={{bottom: '11.5px', left: '11.5px', right: '11.5px'}}>
                    <FeedbackModal 
                        onClose={() => setShowFeedbackModal(false)}
                        onSubmit={(feedbackData: any) => {
                            try {
                                if (feedbackMessageIndex !== null) {
                                    const newMap = new Map(submittedFeedback);
                                    newMap.set(feedbackMessageIndex, feedbackType);
                                    setSubmittedFeedback(newMap);
                                }
                                if (!canSubmitFeedback) return;
                                analytics?.track("claude_chrome.chat.feedback", { ...feedbackData, session_id: sessionId, permissions: permissionMode });
                            } catch(e) {/* ignore */}
                        }}
                        feedbackType={feedbackType}
                        message={feedbackMessageIndex !== null ? messages[feedbackMessageIndex] : null}
                    />
                </div>
            )}
            <SkipPermissionsModal
                isOpen={showSkipConfirmModal}
                onClose={() => setShowSkipConfirmModal(false)}
                onConfirm={async () => {
                    if (!isHighRiskDomain) {
                        if (permissionPrompt && permissionPrompt.type === 'permission_required') {
                            const { host } = new URL(permissionPrompt.url);
                            const netloc = { type: 'netloc', netloc: host };
                            handlePermissionResponse(PermissionDuration.ONCE, netloc);
                        }
                        setSkipAllPermissions(true);
                    }
                }}
            />
             <UpsellAntBuildModal isOpen={showUpsell} onClose={() => setShowUpsell(false)} />
             {promptToSave !== null && (
                <SavePromptModal 
                    prompt={promptToSave}
                    onClose={() => setPromptToSave(null)}
                    onSave={(command: string) => {
                        setPromptToSave(null);
                        setInputValue(`/${command}`);
                        setShowSlashMenu(true);
                        setSlashCommandQuery(command);
                        setTimeout(() => {
                            if (textareaRef.current) {
                                textareaRef.current.focus();
                                const pos = textareaRef.current.value.length;
                                textareaRef.current.setSelectionRange(pos, pos);
                            }
                        }, 50);
                    }}
                />
             )}
        </div>
    </div>
  );
}

// 原始内联函数: (() => {...})，来自 xx 内嵌的认证逻辑
// Helper hook for auth state
function useAuth() {
    const [isLoading, setIsLoading] = useState(true);
    const [needsOAuth, setNeedsOAuth] = useState(true);
    const [authToken, setAuthToken] = useState<string | undefined>();
    const [anthropicApiKey, setAnthropicApiKey] = useState<string | undefined>();
    const [anthropicApiUrl, setAnthropicApiUrl] = useState<string | undefined>();

    const checkAuth = useCallback(async () => {
        setIsLoading(true);
        try {
            const [token, apiKey, apiUrl, mockAuth, mockStatsig] = await Promise.all([
                getAccessToken(),
                getLocalValue<string>(StorageKey.ANTHROPIC_API_KEY),
                getLocalValue<string>(StorageKey.ANTHROPIC_API_URL),
                getLocalValue<boolean>(StorageKey.MOCK_AUTH_ENABLED),
                getLocalValue<boolean>(StorageKey.MOCK_STATSIG_ENABLED),
            ]);
            const hasMock = Boolean(mockAuth) || Boolean(mockStatsig);
            setNeedsOAuth(token === undefined && !hasMock);
            setAuthToken(token);
            setAnthropicApiKey(apiKey || undefined);
            setAnthropicApiUrl(apiUrl?.trim() ? apiUrl.trim() : undefined);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refreshTokenIfNeeded = useCallback(async () => {
        const { isRefreshed } = await ensureValidAccessToken();
        if (isRefreshed) {
            const token = await getAccessToken();
            setAuthToken(token);
        }
    }, []);

    useEffect(() => {
        checkAuth();
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
            if (area !== 'local') return;
            const watchedKeys = new Set<string>([
                StorageKey.ACCESS_TOKEN,
                StorageKey.REFRESH_TOKEN,
                StorageKey.TOKEN_EXPIRY,
                StorageKey.ANTHROPIC_API_KEY,
                StorageKey.ANTHROPIC_API_URL,
                StorageKey.MOCK_AUTH_ENABLED,
                StorageKey.MOCK_STATSIG_ENABLED,
            ]);
            if (Object.keys(changes).some(key => watchedKeys.has(key))) {
                checkAuth();
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, [checkAuth]);

    return { authToken, anthropicApiKey, anthropicApiUrl, needsOAuth, isLoading, refreshTokenIfNeeded };
}

// 原始内联函数: xx 内的 permissionPromptRef 逻辑
// Helper hook for managing permission prompt sizing and its effect on layout
function usePermissionPromptSizing({ permissionPrompt, messagesContainerRef, isAutoScrollEnabled, setIsAutoScrollEnabled }: any) {
    const [promptHeight, setPromptHeight] = useState(0);
    const promptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const messagesContainer = messagesContainerRef.current;
        if (!messagesContainer) return;
        
        if (permissionPrompt && promptRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                const entry = entries[0];
                if (entry) {
                    const newHeight = entry.contentRect.height;
                    const prevHeight = promptHeight;
                    const scrollOffset = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
                    
                    setPromptHeight(newHeight);
                    
                    if (prevHeight !== newHeight && scrollOffset < 100) {
                        requestAnimationFrame(() => {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight - scrollOffset;
                        });
                    }
                }
            });
            resizeObserver.observe(promptRef.current);
            return () => resizeObserver.disconnect();
        } else if (!permissionPrompt && promptHeight > 0) {
            const scrollOffset = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight - promptHeight;
            setPromptHeight(0);
            requestAnimationFrame(() => {
                const newScrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight - scrollOffset;
                messagesContainer.scrollTop = Math.max(0, newScrollTop);
                // If we were near the bottom before, re-enable auto-scroll
                if (messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100 && !isAutoScrollEnabled) {
                    setIsAutoScrollEnabled(true);
                }
            });
        }
    }, [permissionPrompt, promptHeight, isAutoScrollEnabled, setIsAutoScrollEnabled, messagesContainerRef]);

    return {
        permissionPromptRef: promptRef,
        paddingBottom: promptHeight > 0 ? `${promptHeight - 80}px` : '40px'
    };
}
