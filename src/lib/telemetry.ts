// No-op telemetry implementation to remove reporting logic
import type { Span } from "@opentelemetry/api";

export interface TraceHeaders {
  traceId: string;
  headers: Record<string, string>;
}

export async function withTelemetrySpan<T>(
  _name: string,
  executor: (span: Span) => Promise<T> | T,
  _parentSpan?: Span
): Promise<T> {
  const noopSpan: any = {
    setAttribute: () => {},
    setStatus: () => {},
    recordException: () => {},
    end: () => {},
  };
  return await executor(noopSpan as Span);
}

export function generateTraceHeaders(_forceSample: boolean): TraceHeaders {
  return { traceId: "", headers: {} };
}

export function initializeTelemetry(): void {
  // intentionally left blank
}
