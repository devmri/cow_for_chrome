
function isBrowser(): boolean {
  return typeof window !== "undefined";
}


export function isNonBrowser(): boolean {
  return !isBrowser();
}


export function isOnline(): boolean {
  return !isBrowser() || window.navigator.onLine;
}


export function isOffline(): boolean {
  return !isOnline();
}
