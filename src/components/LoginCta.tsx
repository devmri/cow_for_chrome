// 重构前的变量名: Fc（登录按钮与提示 UI 组件）
// 说明：严格等价还原，保持样式与交互逻辑不变，仅将打包器生成的变量/运行时（m/S）改为规范的 React 写法
import React, { Fragment, useState } from "react";
import { startOAuthFlow } from "../lib/sentryService";

// 重构前的变量名: jc（SVG 图标）
// 说明：按原路径与属性等价还原，仅命名语义化
const LoginArrowIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="17"
    viewBox="0 0 17 17"
    fill="none"
  >
    <path
      d="M13.0003 4.5V11C13.0003 11.1326 12.9476 11.2598 12.8538 11.3536C12.7601 11.4473 12.6329 11.5 12.5003 11.5C12.3677 11.5 12.2405 11.4473 12.1467 11.3536C12.053 11.2598 12.0003 11.1326 12.0003 11V5.70687L4.85403 12.8538C4.76021 12.9476 4.63296 13.0003 4.50028 13.0003C4.3676 13.0003 4.24035 12.9476 4.14653 12.8538C4.05271 12.7599 4 12.6327 4 12.5C4 12.3673 4.05271 12.2401 4.14653 12.1462L11.2934 5H6.00028C5.86767 5 5.74049 4.94732 5.64672 4.85355C5.55296 4.75979 5.50028 4.63261 5.50028 4.5C5.50028 4.36739 5.55296 4.24021 5.64672 4.14645C5.74049 4.05268 5.86767 4 6.00028 4H12.5003C12.6329 4 12.7601 4.05268 12.8538 4.14645C12.9476 4.24021 13.0003 4.36739 13.0003 4.5Z"
      className="fill-bg-100"
    />
  </svg>
);

// 等价还原组件：点击触发 OAuth 登录；加载态与样式与产物完全一致
// @origin: Fc
export const LoginCta: React.FC = () => {
  const [loading, setLoading] = useState(false); // 重构前: [e, t] = S.useState(!1)

  return (
    <div className="flex flex-col items-center">
      <h2
        className="text-text-300 text-center font-heading"
        style={{
          fontSize: "36px",
          lineHeight: "130%",
          letterSpacing: "-0.9px",
        }}
      >
        Log in
      </h2>

      <p
        className="text-text-300 text-center font-claude-response mt-3 text-base"
        style={{
          fontWeight: 400,
          lineHeight: "150%",
          letterSpacing: "-0.08px",
        }}
      >
        Cow for Chrome is available to a
        <br />
        limited set of Max plan subscribers
      </p>

      <button
        onClick={async () => {
          setLoading(true);
          try {
            // 重构前调用: startOAuthFlow()
            await startOAuthFlow();
          } catch (_) {
            // 保持与产物一致：忽略错误，不抛出
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="flex items-center justify-center gap-2 bg-text-100 text-bg-100 font-styrene rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          height: "44px",
          minWidth: "75px",
          padding: "3px 14px",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "140%",
          letterSpacing: "-0.28px",
          marginTop: "22px",
        }}
      >
        {loading ? (
          <Fragment>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-bg-100" />
            Signing in...
          </Fragment>
        ) : (
          <Fragment>
            Log in
            <LoginArrowIcon />
          </Fragment>
        )}
      </button>
    </div>
  );
};

export default LoginCta;
