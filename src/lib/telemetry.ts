import { context, Span, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { HoneycombWebSDK } from "@honeycombio/opentelemetry-web";
import { getEnvConfig } from "./sentryService";

const TELEMETRY_SERVICE_NAME = "claude-browser-extension";
let telemetryStarted = false;

// 原函数名: Yy
export async function withTelemetrySpan<T>(
  name: string,
  executor: (span: Span) => Promise<T> | T,
  parentSpan?: Span
): Promise<T> {
  const tracer = trace.getTracer(TELEMETRY_SERVICE_NAME);
  const parentContext = parentSpan
    ? trace.setSpan(context.active(), parentSpan)
    : context.active();

  return tracer.startActiveSpan(
    name,
    { kind: SpanKind.INTERNAL },
    parentContext,
    async (span) => {
      try {
        const result = await executor(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

function randomHex(length: number): string {
  const alphabet = "0123456789abcdef";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export interface TraceHeaders {
  traceId: string;
  headers: Record<string, string>;
}

// 原函数名: Jy
export function generateTraceHeaders(forceSample: boolean): TraceHeaders {
  const traceId = randomHex(32);
  const parentId = randomHex(16);
  const sampledFlag = forceSample ? "1" : "0";
  const headers: Record<string, string> = {
    traceparent: `00-${traceId}-${parentId}-0${sampledFlag}`,
    "x-cloud-trace-context": `${traceId}/${parseInt(parentId, 16).toString()};o=${sampledFlag}`,
  };

  if (forceSample) {
    headers.baggage = "forceTrace=true";
    headers["x-refinery-force-trace"] = "true";
  }

  return { traceId, headers };
}

// 原函数名: Xy
export function initializeTelemetry(): void {
  if (telemetryStarted) return;

  const env = getEnvConfig();
  const version =
    typeof chrome !== "undefined" && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest().version
      : "0.0.0";

  try {
    const sdk = new HoneycombWebSDK({
      debug: env.environment !== "production",
      apiKey: "",
      serviceName: TELEMETRY_SERVICE_NAME,
      sampleRate: 1,
      resourceAttributes: {
        "extension.version": version,
        "build.type": "external",
      },
      webVitalsInstrumentationConfig: { enabled: false },
    });

    sdk.start();
    telemetryStarted = true;
  } catch {
    // Honeycomb SDK 初始化失败时静默降级
  }
}
