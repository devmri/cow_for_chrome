
import React, { useState } from "react";
import LoginCta from "../../../components/LoginCta";
import { setLocalObject, StorageKey } from "../../../lib/storage";

export function LoginCtaScreen() {
  const [mocking, setMocking] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-bg-100 items-center justify-center p-4">
      <LoginCta />
      <button
        type="button"
        onClick={async () => {
          setMocking(true);
          try {
            await setLocalObject({
              [StorageKey.MOCK_AUTH_ENABLED]: true,
              [StorageKey.MOCK_STATSIG_ENABLED]: true,
            });
          } finally {
            setMocking(false);
          }
        }}
        disabled={mocking}
        className="mt-6 px-4 py-2 rounded-lg bg-accent-main-200 text-oncolor-100 font-button-lg hover:bg-accent-main-100 transition-colors disabled:opacity-60"
      >
        {mocking ? "正在开启模拟模式..." : "一键开启模拟模式"}
      </button>
    </div>
  );
}
