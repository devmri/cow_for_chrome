// 重构前变量名: xr（isBrowser）
// 重构前变量名: Er（isNonBrowser）
// 重构前变量名: Cr（isOnline）
// 重构前变量名: Pr（isOffline）

// 判断是否运行在浏览器环境（与编译产物等价：typeof window !== 'undefined'）
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// 导出：是否非浏览器环境（等价 Er: !xr()）
export function isNonBrowser(): boolean {
  return !isBrowser();
}

// 导出：在线状态（等价 Cr: !xr() || window.navigator.onLine）
export function isOnline(): boolean {
  return !isBrowser() || window.navigator.onLine;
}

// 导出：离线状态（等价 Pr: !Cr()）
export function isOffline(): boolean {
  return !isOnline();
}
