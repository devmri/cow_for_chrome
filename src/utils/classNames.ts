// 原辅助函数名: sb
// 说明：等价还原打包产物中基于 clsx 的样式合并逻辑，支持字符串与布尔对象。
export type ClassValue =
  | string
  | number
  | bigint
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value && value !== 0) continue;

    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
    } else if (typeof value === "object") {
      for (const [key, condition] of Object.entries(value)) {
        if (condition) classes.push(key);
      }
    }
  }

  return classes.join(" ");
}
