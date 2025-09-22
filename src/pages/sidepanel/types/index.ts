import { Span } from "@opentelemetry/api";
import Anthropic from "@anthropic-ai/sdk";
import { PermissionsManager, ToolAction } from "../../../lib/permissions";

export interface AnthropicImageSource {
  type: "base64";
  media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
}

export type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: AnthropicImageSource }
  | { type: "tool_use"; id: string; name: string; input: any }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | AnthropicContent[];
      is_error?: boolean;
    };

export interface Message {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
  id?: string; // Used for feedback
  isCompactSummary?: boolean;
  isCompactionMessage?: boolean;
  traceId?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface ToolUse {
  id: string;
  name: string;
  input: any;
}

export interface ActionData {
  screenshot?: string;
  coordinate?: [number, number];
  start_coordinate?: [number, number];
  text?: string;
  ref?: string;
  value?: string | number | boolean;
  fromDomain?: string;
  toDomain?: string;
}

export interface PermissionRequest {
  type: "permission_required";
  tool: ToolAction;
  url: string;
  toolUseId: string;
  actionData?: ActionData;
}

export type ToolResultContent = {
  output?: string;
  base64Image?: string;
  error?: string;
};

export type ToolOutput = (ToolResultContent | PermissionRequest) & {
  type?: "permission_required";
};

export interface ToolContext {
  toolUseId: string;
  tabId: number;
  sessionId: string;
  createAnthropicMessage: (
    params: any,
    parentSpan?: Span,
  ) => Promise<any>;
  permissionManager: PermissionsManager;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: ToolContext) => Promise<ToolOutput>;
  toAnthropicSchema: (
    context: { tabId: number },
  ) => Promise<any>;
}