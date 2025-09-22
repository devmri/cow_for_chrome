// 重构前变量名: tr（promiseWithTimeout）

/**
 * 为 Promise 增加超时控制（与编译产物等价逻辑）。
 * 超时后以 Error("Promise timed out") 拒绝。
 */
export function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Promise timed out")), ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
