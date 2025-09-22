// 重构前变量名: Ui（decodeUriComponentPlus）

/**
 * 解码 URL 组件，并将加号（+）视为空格（与产物等价实现）。
 */
export function decodeUriComponentPlus(input: string): string {
  try {
    return decodeURIComponent(input.replace(/\+/g, " "));
  } catch {
    // 与编译产物等价：异常时返回原字符串
    return input;
  }
}

