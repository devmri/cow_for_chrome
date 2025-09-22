/*
  等价还原：assets/content-script.ts-Bwa5rY9t.js
  - 监听页面点击，若命中 #claude-onboarding-button，读取 data-task-prompt 并通知后台打开侧边栏
*/

// 重构前变量名：匿名 IIFE + 内联 async 函数
function handleOnboardingButtonClick(btn: Element): void {
  const prompt = btn.getAttribute('data-task-prompt')
  if (!prompt) return
  // 与产物一致：发送 open_side_panel，并附带 prompt
  chrome.runtime.sendMessage({ type: 'open_side_panel', prompt })
}

// 事件代理到 body，保持与产物一致的匹配与时机（manifest: document_end）
document.body.addEventListener('click', (ev) => {
  const target = ev.target as Element | null
  if (!target?.closest) return
  const btn = target.closest('#claude-onboarding-button')
  if (btn) handleOnboardingButtonClick(btn)
})

