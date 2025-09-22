// 原始函数: yd

/**
 * Parses an error object or string to extract a user-friendly message.
 * It handles nested error objects from API responses.
 * @original yd
 * @param error The error to parse, can be of any type.
 * @returns A user-friendly error message string.
 */
export function parseErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    // Check for JSON embedded in a string with a status code
    const jsonMatch = error.match(/^(\d{3})\s+(\{.+\})$/s);
    let potentialJson = error;
    if (jsonMatch) {
      potentialJson = jsonMatch[2];
    }

    try {
      const parsed = JSON.parse(potentialJson);
      return parsed?.error?.message ?? parsed?.message ?? error;
    } catch {
      return error;
    }
  }

  if (error instanceof Error) {
    const message = error.message;
    const jsonMatch = message.match(/^(\d{3})\s+(\{.+\})$/s);
    let potentialJson = message;
    if (jsonMatch) {
      potentialJson = jsonMatch[2];
    }
    try {
      const parsed = JSON.parse(potentialJson);
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {
      // Ignore parsing errors and return original message
    }
    return error.message;
  }

  if (error && typeof error === "object") {
    if (
      "error" in error &&
      typeof error.error === "object" &&
      error.error &&
      "message" in error.error
    ) {
      return String(error.error.message);
    }
    if ("message" in error) {
      return String(error.message);
    }
  }

  return String(error);
}
