
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { Span, SpanStatusCode } from "@opentelemetry/api";
import {
  Message,
  PermissionRequest,
  Tool,
  ToolUse,
} from "../types";
import {
  ALL_TOOLS,
  NON_INTERACTIVE_TOOLS,
} from "../services/tools";
import { parseErrorMessage } from "../utils/error";
import { tokenManager } from "../services/token.service";
import { CompactionService } from "../services/compaction.service";
import { debuggerService } from "../services/debugger.service";
import { permissionService } from "../../../lib/permissions";
import { getLocalValue, StorageKey } from "../../../lib/storage";

import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { useCurrentAccount } from "../../../providers/CurrentAccountProvider";
import { getEnvConfig } from "../../../lib/sentryService";
import { generateTraceHeaders, withTelemetrySpan } from "../../../lib/telemetry";

interface UseChatProps {
  apiKey?: string;
  apiBaseUrl?: string;
  authToken?: string;
  refreshTokenIfNeeded: () => Promise<void>;
  sessionId: string;
  model: string;
  onPermissionRequired: (
    request: PermissionRequest,
  ) => Promise<boolean>;
  tabId?: number;
  currentDomain?: string;
  skipAllPermissions: boolean;
  permissionManager: typeof permissionService;
  permissionMode: string;
}

export function useChat({
  apiKey,
  apiBaseUrl,
  authToken,
  refreshTokenIfNeeded,
  sessionId,
  model,
  onPermissionRequired,
  tabId,
  currentDomain,
  skipAllPermissions,
  permissionManager,
  permissionMode,
}: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      getLocalValue<Message[]>(StorageKey.TEST_DATA_MESSAGES).then(
        (testMessages) => {
          if (testMessages && testMessages.length > 0) {
            setMessages(testMessages);
          }
        },
      );
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteractiveTools, setHasInteractiveTools] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensSaved, setTokensSaved] = useState<number | null>(null);

  const { analytics } = useAnalytics();
  const [systemPrompt, setSystemPrompt] = useState<
    Anthropic.Messages.MessageParam[] | null
  >(null);

  const { systemPrompt: defaultSystemPrompt, skipPermissionsSystemPrompt } = {
    systemPrompt:
      "You are Cow for Chrome. Respond concisely, follow the user's instructions, and mention if additional permissions are required. Current datetime: {{currentDateTime}}.",
    skipPermissionsSystemPrompt:
      "You are operating in skip-permissions mode. Clearly explain assumptions and highlight actions that would normally require permissions. Current datetime: {{currentDateTime}}.",
  };

  const anthropicClientRef = useRef<Anthropic | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const isInitialLoadRef = useRef(false);
  const toolsRef = useRef(ALL_TOOLS);

  const { userProfile } = useCurrentAccount();
  const enableTraceHeaders = false;

  const envConfig = useMemo(() => getEnvConfig(), []);
  const resolvedApiBaseUrl = useMemo(() => {
    if (apiBaseUrl && apiBaseUrl.trim()) {
      return apiBaseUrl.trim();
    }
    return envConfig.apiBaseUrl;
  }, [apiBaseUrl, envConfig.apiBaseUrl]);

  const getPageType = useCallback((url?: string) => {
    if (!url) return "regular";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url === "about:blank") {
      return "system";
    }
    if (url.startsWith("https://chromewebstore.google.com/")) {
      return "non-script";
    }
    return "regular";
  }, []);
  
  const getAvailableTools = useCallback((pageType: string): Tool[] => {
    if (pageType === 'system' || pageType === 'non-script') {
        return toolsRef.current.filter(tool => ['navigate'].includes(tool.name));
    }
    return toolsRef.current;
  }, []);

  useEffect(() => {
    if (!apiKey && !authToken) {
      setError("No API key or Auth Token provided.");
      return;
    }
    setError(null);
    if (apiKey) {
      anthropicClientRef.current = new Anthropic({
        baseURL: resolvedApiBaseUrl,
        apiKey,
        dangerouslyAllowBrowser: true,
      } as any);
    } else if (authToken) {
      anthropicClientRef.current = new Anthropic({
        baseURL: resolvedApiBaseUrl,
        authToken,
        dangerouslyAllowBrowser: true,
      } as any);
    }
  }, [apiKey, authToken, resolvedApiBaseUrl]);

  useEffect(() => {
    if (model && sessionId && permissionMode) {
      // 上报
    }
  }, [analytics, model, sessionId, permissionMode]);

  const initializeSession = useCallback(async () => {
    if (!tabId) return;

    const basePrompt: any =
      skipAllPermissions && skipPermissionsSystemPrompt
        ? skipPermissionsSystemPrompt
        : defaultSystemPrompt;

    if (!basePrompt) {
      setSystemPrompt(null);
      throw new Error(
        "Unable to initialize the chat session. Please check your connection and try again.",
      );
    }
    
    const tab = await chrome.tabs.get(tabId);

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0 || navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
    const platform = isMac ? "Mac" : "Windows/Linux";
    const modifierKey = isMac ? "cmd" : "ctrl";
    const currentDateTime = new Date().toLocaleString();

    const promptParts: Anthropic.TextBlockParam[] = [
      { type: "text", text: basePrompt.replace(/{{currentDateTime}}/g, currentDateTime) },
    ];
    
    const customPrompt = await getLocalValue<string>(StorageKey.SYSTEM_PROMPT);
    if (customPrompt) {
        promptParts.push({ type: 'text', text: customPrompt });
    }

    promptParts.push({
      type: "text",
      text: `Platform-specific information:\n- You are on a ${platform} system\n- Use "${modifierKey}" as the modifier key for keyboard shortcuts (e.g., "${modifierKey}+a" for select all, "${modifierKey}+c" for copy, "${modifierKey}+v" for paste)`,
    });
    
    if (tab.url) {
        try {
            const domain = new URL(tab.url).hostname;
            promptParts.push({ type: 'text', text: `The current page domain is "${domain}"` });
        } catch(e) { /* invalid URL, ignore */ }
    }
    // @ts-ignore
    promptParts[promptParts.length - 1].cache_control = { type: 'ephemeral' };
    setSystemPrompt(promptParts as any);
  }, [tabId, defaultSystemPrompt, skipPermissionsSystemPrompt, skipAllPermissions]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setMessageHistory([]);
    setError(null);
    setTokensSaved(null);
    await permissionManager.clearOncePermissions();
    try {
      await initializeSession();
    } catch (e) {
      setError(parseErrorMessage(e));
    }
  }, [initializeSession, permissionManager]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
        initializeSession().catch(e => {
            setError(parseErrorMessage(e));
        });
    } else {
        isInitialLoadRef.current = true;
        (async () => {
            await clearMessages();
            try {
                await initializeSession();
            } catch(e) {
                setError(parseErrorMessage(e));
            }
        })();
    }
  }, [skipAllPermissions, clearMessages, initializeSession]);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setHasInteractiveTools(false);
    setIsCompacting(false);
  }, []);

  const prepareMessageForApi = useCallback((message: Message, isLastAssistantMessage = false): Anthropic.Messages.MessageParam => {
    const { role } = message;
    if (typeof message.content === 'string') {
        if (isLastAssistantMessage) {
            return {
                role,
                content: [{
                    type: 'text',
                    text: message.content,
                    cache_control: { type: 'ephemeral' }
                } as any]
            };
        }
        return { role, content: message.content };
    }
    if (Array.isArray(message.content)) {
        const clonedContent = JSON.parse(JSON.stringify(message.content));
        if (isLastAssistantMessage && clonedContent.length > 0) {
            clonedContent[clonedContent.length - 1].cache_control = { type: 'ephemeral' };
        }
        return { role, content: clonedContent };
    }
    return { role, content: "" };
  }, []);

  const prepareMessagesForApi = useCallback((messages: Message[]): Anthropic.Messages.MessageParam[] => {
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            lastAssistantIndex = i;
            break;
        }
    }
    const apiMessages = messages.map((msg, index) => prepareMessageForApi(msg, index === lastAssistantIndex));
    return apiMessages;
  }, [prepareMessageForApi]);

  const createAnthropicMessage = useCallback(
    async (params: Anthropic.Messages.MessageCreateParams, parentSpan?: Span) => {
      if (!anthropicClientRef.current) throw new Error("Client not initialized");

      const messageParams: Anthropic.Messages.MessageCreateParams = { ...params, model, betas: ["oauth-2025-04-20"]} as any;
      if (userProfile?.account.uuid) {
        messageParams.metadata = { user_id: userProfile.account.uuid };
      }
      
      await refreshTokenIfNeeded();

      return await withTelemetrySpan(
        "anthropic_message_create",
        async (span) => {
          span.setAttribute("session_id", sessionId || "");
          span.setAttribute("permissions", permissionMode);
          const { headers } = generateTraceHeaders(enableTraceHeaders);
          const options: Anthropic.RequestOptions = { headers };
          if (abortControllerRef.current) {
            options.signal = abortControllerRef.current.signal;
          }
          // @ts-ignore   
          return await anthropicClientRef.current!.messages.create(messageParams, options);
        },
        parentSpan,
      );
    },
    [model, userProfile?.account.uuid, enableTraceHeaders, refreshTokenIfNeeded, sessionId, permissionMode]
  );
  
  const executeTool = useCallback(async (
    name: string,
    input: any,
    id: string,
    parentSpan?: Span
  ): Promise<any> => {
    const action = input.action;
    return await withTelemetrySpan(`tool_execution_${name}${action ? '_' + action : ''}`, async (span) => {
        span.setAttribute("session_id", sessionId || "");
        span.setAttribute("permissions", permissionMode);
        span.setAttribute("tool_name", name);
        if (action) span.setAttribute("action", action);

        const context = {
            toolUseId: id,
            tabId,
            sessionId,
            createAnthropicMessage: (params: Anthropic.Messages.MessageCreateParams) => createAnthropicMessage(params, span),
            permissionManager,
        };

        const tool = toolsRef.current.find(t => t.name === name);
        if (!tool) {
            throw new Error(`Unknown tool: ${name}`);
        }
        
        const analyticsPayload: any = { name, sessionId, permissions: permissionMode };
        if (name === 'computer' && action) analyticsPayload.action = action;
        if (currentDomain) analyticsPayload.domain = currentDomain;

        try {
            const result = await tool.execute(input, context as any);
            if ('type' in result) {
                analyticsPayload.success = false;
                span.setAttribute("success", false);
                span.setAttribute("failure_reason", "needs_permission");
            } else {
                analyticsPayload.success = !result.error;
                span.setAttribute("success", !result.error);
            }
            return result;
        } catch (e) {
            throw e;
        }
    }, parentSpan);
  }, [tabId, sessionId, createAnthropicMessage, permissionManager, permissionMode, analytics, currentDomain]);

  const processToolCalls = useCallback(async (toolCalls: ToolUse[], parentSpan?: Span): Promise<any[]> => {
    const results: any[] = [];

    const formatResult = (toolUseId: string, result: any) => {
        const isError = !!result.error;
        let content: any = "";
        if (result.error) {
            content = result.error;
        } else {
            const contentParts: any[] = [];
            if(result.output) contentParts.push({ type: 'text', text: result.output });
            if(result.base64Image) contentParts.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: result.base64Image }});
            if (contentParts.length > 0) content = contentParts;
        }

        return {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: content,
            ...(isError && { is_error: true }),
        };
    };

    for (const call of toolCalls) {
        try {
            let result = await executeTool(call.name, call.input, call.id, parentSpan);
            if (result.type === 'permission_required') {
                if (!onPermissionRequired) {
                    results.push(formatResult(call.id, { error: 'Permission required but no handler available' }));
                    continue;
                }
                const granted = await onPermissionRequired(result);
                if (!granted) {
                    results.push(formatResult(call.id, { error: 'Permission denied by user' }));
                    continue;
                }
                result = await executeTool(call.name, call.input, call.id, parentSpan);
                if (result.type === 'permission_required') {
                    throw new Error("Permission still required after granting");
                }
                results.push(formatResult(call.id, result));
            } else {
                results.push(formatResult(call.id, result));
            }
        } catch (e) {
            const errorMessage = parseErrorMessage(e);
            results.push(formatResult(call.id, { error: errorMessage }));
        }
    }
    return results;
  }, [executeTool, onPermissionRequired]);

  const cascadeNebulaEnabled = false;

  const sendMessage = useCallback(async (prompt: string, parentSpan?: Span) => {
    if (!anthropicClientRef.current) {
      setError("Client not initialized. Please sign in again.");
      return;
    }
    if (!tabId) {
      setError("No active tab");
      return;
    }
    if (!systemPrompt) {
      setError("Unable to initialize the chat session. Please check your connection and try again.");
      try {
        await initializeSession();
      } catch (e) {
        setError(parseErrorMessage(e));
      }
      return;
    }
    
    tokenManager.setModel(model as any);

    let currentMessages = messages;

    const isManualCompact = prompt.trim() === '/compact';
    const tokenMetrics = tokenManager.calculateMetricsFromMessages(messages);
    const isAutoCompact = !isManualCompact && tokenMetrics && tokenMetrics.isError;
    
    if (isManualCompact || isAutoCompact) {
        const compactionType = isManualCompact ? 'manual' : 'auto';
        setIsCompacting(true);
        setError(null);
        abortControllerRef.current = new AbortController();
        try {
            if (!anthropicClientRef.current) throw new Error("Client not initialized");
            // @ts-ignore
            const compactionService = new CompactionService(createAnthropicMessage);
            const result = await compactionService.compactConversation(messages, !isManualCompact);
            
            setMessages(result.messagesAfterCompacting);
            setMessageHistory(messages);
            setTokensSaved(result.tokensSaved);
            currentMessages = result.messagesAfterCompacting;

            if (isManualCompact) {
                setIsCompacting(false);
                return;
            }
        } catch(e) {
            const errorMessage = parseErrorMessage(e);
            if (errorMessage === 'Request was aborted.' || (e instanceof Error && e.name === 'AbortError') || isCancelledRef.current) {
                // User cancelled, do nothing
            } else {
                setError(e instanceof Error ? e.message : `Failed to ${compactionType}-compact conversation`);
            }
            setIsCompacting(false);
            return;
        } finally {
            setIsCompacting(false);
            if (abortControllerRef.current) abortControllerRef.current = null;
        }
    }

    setIsLoading(true);
    setError(null);
   
    const userMessage: Message = { role: "user", content: [{ type: "text", text: prompt }] };
    let updatedMessages = [...currentMessages, userMessage];
    setMessages(updatedMessages);

    let currentPageType = 'regular';
    try {
        const tab = await chrome.tabs.get(tabId);
        currentPageType = getPageType(tab.url);
    } catch(e) { /* ignore */ }
    
    let availableTools = getAvailableTools(currentPageType);
    let toolSchemas: any[] | null = null;
    try {
        toolSchemas = await Promise.all(availableTools.map(t => t.toAnthropicSchema({ tabId })));
    } catch (e) {
        const errorMessage = parseErrorMessage(e);
        setError(errorMessage);
        setIsLoading(false);
        return;
    }

    if (toolSchemas && toolSchemas.length > 0) {
        (toolSchemas[toolSchemas.length - 1] as any).cache_control = { type: 'ephemeral' };
    }
    
    isCancelledRef.current = false;
    let shouldContinue = true;
    let loopCount = 0;
    
    while(shouldContinue && !isCancelledRef.current) {
        loopCount++;
        shouldContinue = false;
        abortControllerRef.current = new AbortController();
        
        if (loopCount > 1) { // Re-check page type and tools on subsequent loops
            try {
                const tab = await chrome.tabs.get(tabId);
                const newPageType = getPageType(tab.url);
                if (newPageType !== currentPageType) {
                    currentPageType = newPageType;
                    availableTools = getAvailableTools(currentPageType);
                    toolSchemas = await Promise.all(availableTools.map(t => t.toAnthropicSchema({ tabId })));
                    if (toolSchemas && toolSchemas.length > 0) {
                        (toolSchemas[toolSchemas.length - 1] as any).cache_control = { type: 'ephemeral' };
                    }
                }
            } catch(e) { /* ignore */ }
        }

        let parent_promise_resolver: () => void;
        const parent_promise = new Promise<void>(resolve => { parent_promise_resolver = resolve; });
        let stopReason: string | null | undefined;
        
        await withTelemetrySpan("message_streaming", async (span) => {
            span.setAttribute("session_id", sessionId || "");
            span.setAttribute("permissions", permissionMode);
            span.setAttribute("model", model);
            
            try {
                const apiMessages = prepareMessagesForApi(updatedMessages);
                const { traceId, headers } = generateTraceHeaders(enableTraceHeaders);
                const requestOptions = { signal: abortControllerRef.current?.signal, headers };

                const assistantMessage: Message = { role: 'assistant', content: [], ...(traceId && { traceId }) };
                updatedMessages.push(assistantMessage);
                setMessages([...updatedMessages]);
                
                let accumulatedText = "";

                const messageParams: Anthropic.Messages.MessageStreamParams = {
                    messages: apiMessages,
                    model: model,
                    max_tokens: 1024,
                    tools: toolSchemas || [],
                    system: systemPrompt,
                    betas: cascadeNebulaEnabled ? ["oauth-2025-04-20", "context-management-2025-06-27"] : ["oauth-2025-04-20"],
                    // @ts-ignore
                    ...(cascadeNebulaEnabled && {
                        context_management: {
                            edits: [
                                {
                                    type: 'clear_tool_uses_20250902',
                                    threshold: { type: 'max_input_tokens', value: 1800000 },
                                    target: { type: 'input_tokens', value: 40000 }
                                }
                            ]
                        }
                    })
                } as any;
                if (userProfile?.account.uuid) {
                    messageParams.metadata = { user_id: userProfile.account.uuid };
                }
                
                await refreshTokenIfNeeded();
                // @ts-ignore
                const stream = anthropicClientRef.current!.messages.stream(messageParams, requestOptions)
                    .on('text', (text: string) => {
                        accumulatedText += text;
                        const lastMsg = updatedMessages[updatedMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = [{ type: 'text', text: accumulatedText }];
                        }
                        setMessages([...updatedMessages]);
                    })
                    .on('message', async (message: any) => {
                        try {
                            if ('stop_reason' in message && message.stop_reason) {
                                stopReason = message.stop_reason;
                            }
                            const lastMsg = updatedMessages.pop();
                            const finalMessage = {
                                ...message,
                                ...(lastMsg && 'traceId' in lastMsg && { traceId: lastMsg.traceId }),
                                ...('usage' in message && message.usage && { usage: message.usage })
                            };
                            updatedMessages.push(finalMessage as Message);
                            setMessages([...updatedMessages]);
    
                            if (Array.isArray(message.content)) {
                                const toolUses = message.content.filter((c: any) => c.type === 'tool_use') as ToolUse[];
                                if (toolUses.length > 0) {
                                    if (toolUses.some(u => !['read_page', 'get_page_text', 'find'].includes(u.name))) {
                                        setHasInteractiveTools(true);
                                    }

                                    let toolResults: any[] = [];
                                    if (isCancelledRef.current) {
                                        toolResults = toolUses.map(tu => ({
                                            type: "tool_result",
                                            tool_use_id: tu.id,
                                            content: "Tool execution cancelled by user",
                                            is_error: true,
                                        }));
                                    } else {
                                        toolResults = await processToolCalls(toolUses, span);
                                    }
                                    
                                    if(isCancelledRef.current) {
                                      // do not continue if cancelled
                                    } else {
                                      const toolResultMessage: Message = { role: 'user', content: toolResults };
                                      updatedMessages.push(toolResultMessage);
                                      setMessages([...updatedMessages]);
                                      shouldContinue = true;
                                    }
                                    parent_promise_resolver();
                                    return;
                                }
                            }
                            parent_promise_resolver();
                        } catch(e) {
                            parent_promise_resolver();
                            throw e;
                        }
                    })
                    .on('error', (error: any) => {
                        const errorMessage = parseErrorMessage(error);
                        if (!isCancelledRef.current) {
                            setError(errorMessage);
                        }
                    })
                    .on('finalMessage', (message: any) => {
                        if (message && 'usage' in message) {
                            const usage = message.usage;
                        }
                    });

                await stream.done();
                await parent_promise;

            } catch (e) {
                const errorMessage = parseErrorMessage(e);
                if (errorMessage === 'Request was aborted.') return;
                
                span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
                setError(errorMessage);
            } finally {
                abortControllerRef.current = null;
                if (!shouldContinue) {
                    setIsLoading(false);
                    setHasInteractiveTools(false);
                    try {
                        if (tabId) await debuggerService.detachDebugger(tabId);
                    } catch(e) {/* ignore */}

                }
                // Cleanup empty assistant messages
                const lastMsg = updatedMessages[updatedMessages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    const content = lastMsg.content;
                    if (Array.isArray(content) && (content.length === 0 || (content.length === 1 && content[0].type === 'text' && content[0].text === ''))) {
                        updatedMessages.pop();
                        setMessages([...updatedMessages]);
                    }
                }
            }
        }, parentSpan);
    }
  }, [messages, model, prepareMessagesForApi, processToolCalls, analytics, tabId, systemPrompt, getAvailableTools, getPageType, cascadeNebulaEnabled, enableTraceHeaders, userProfile?.account.uuid, refreshTokenIfNeeded, createAnthropicMessage, permissionMode, sessionId, initializeSession]);

  const sendUserMessage = useCallback(async (prompt: string) => {
    try {
      await withTelemetrySpan("send_user_message", async (span) => {
        span.setAttribute("session_id", sessionId || "");
        span.setAttribute("permissions", permissionMode);
        span.setAttribute("model", model);
        await sendMessage(prompt, span);
      });
    } catch (error) {
      const message = parseErrorMessage(error);
      setError(message);
      setIsLoading(false);
    }
  }, [sendMessage, sessionId, permissionMode, model]);

  return {
    messages,
    messageHistory,
    sendMessage: sendUserMessage,
    cancel,
    clearMessages,
    isLoading,
    hasInteractiveTools,
    isCompacting,
    error,
    setMessages,
    tokensSaved,
  };
}
