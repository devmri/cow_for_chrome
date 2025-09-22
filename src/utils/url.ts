
export function decodeUriComponentPlus(input: string): string {
  try {
    return decodeURIComponent(input.replace(/\+/g, " "));
  } catch {
    return input;
  }
}

