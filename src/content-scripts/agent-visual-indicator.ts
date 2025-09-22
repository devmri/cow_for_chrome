/*
  内容脚本：Agent 视觉指示器（等价还原自 assets/agent-visual-indicator.js-4ldKcBi6.js）
  - 发光边框 + 居中“Stop Claude”按钮
  - 支持以下消息：
    SHOW_AGENT_INDICATORS, HIDE_AGENT_INDICATORS, HIDE_FOR_TOOL_USE, SHOW_AFTER_TOOL_USE
  - 点击按钮发送 { type: 'STOP_AGENT' } 至后台
*/

// 重构前变量名: n → glowBorderEl
let glowBorderEl: HTMLDivElement | null = null
// 重构前变量名: e → stopContainerEl
let stopContainerEl: HTMLDivElement | null = null
// 重构前变量名: t → isShown
let isShown = false
// 重构前变量名: a → hiddenForToolUse
let hiddenForToolUse = false

// 注入一次性样式（keyframes）
function ensureAnimationStyles(): void {
  const STYLE_ID = 'claude-agent-animation-styles'
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  // 与产物一致的关键帧动画
  style.textContent = `
      @keyframes claude-pulse {
        0% {
          box-shadow: 
            inset 0 0 20px rgba(59, 159, 237, 0.5),
            inset 0 0 40px rgba(59, 159, 237, 0.3),
            inset 0 0 60px rgba(59, 159, 237, 0.1);
        }
        50% {
          box-shadow: 
            inset 0 0 30px rgba(59, 159, 237, 0.7),
            inset 0 0 50px rgba(59, 159, 237, 0.5),
            inset 0 0 70px rgba(59, 159, 237, 0.2);
        }
        100% {
          box-shadow: 
            inset 0 0 20px rgba(59, 159, 237, 0.5),
            inset 0 0 40px rgba(59, 159, 237, 0.3),
            inset 0 0 60px rgba(59, 159, 237, 0.1);
        }
      }
    `
  document.head.appendChild(style)
}

function createGlowBorder(): HTMLDivElement {
  const el = document.createElement('div')
  el.id = 'claude-agent-glow-border'
  // 与产物一致的样式（直接使用 cssText）
  el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      animation: claude-pulse 2s ease-in-out infinite;
      box-shadow: 
        inset 0 0 20px rgba(59, 159, 237, 0.5),
        inset 0 0 40px rgba(59, 159, 237, 0.3),
        inset 0 0 60px rgba(59, 159, 237, 0.1);
    `
  return el
}

function createStopContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.id = 'claude-agent-stop-container'
  container.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
      z-index: 2147483647;
    `
  const btn = document.createElement('button')
  btn.id = 'claude-agent-stop-button'
  // 内联 SVG 与文案与产物一致
  btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" style="margin-right: 12px; vertical-align: middle;">
        <path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm40-112v56a12,12,0,0,1-12,12H100a12,12,0,0,1-12-12V100a12,12,0,0,1,12-12h56A12,12,0,0,1,168,100Z"></path>
      </svg>
      <span style="vertical-align: middle;">Stop Claude</span>
    `
  btn.style.cssText = `
      position: relative;
      transform: translateY(100px);
      padding: 12px 20px;
      background: #FAF9F5;
      color: #141413;
      border: 0.5px solid rgba(31, 30, 29, 0.4);
      border-radius: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 40px 80px 0 rgba(0, 0, 0, 0.15);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      user-select: none;
      pointer-events: auto;
      white-space: nowrap;
      margin: 0 auto;
    `
  // 悬浮态只在显示中时变化（与产物使用 t 判断一致）
  btn.addEventListener('mouseenter', () => {
    if (isShown) {
      btn.style.background = '#F5F4F0'
      btn.style.boxShadow = '0 40px 80px 0 rgba(0, 0, 0, 0.25)'
    }
  })
  btn.addEventListener('mouseleave', () => {
    if (isShown) {
      btn.style.background = '#FAF9F5'
      btn.style.boxShadow = '0 40px 80px 0 rgba(0, 0, 0, 0.15)'
    }
  })
  btn.addEventListener('click', () => {
    // 点击时通知后台
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' })
  })
  container.appendChild(btn)
  return container
}

// 显示指示器
function showAgentIndicators(): void {
  if (isShown) return
  isShown = true
  ensureAnimationStyles()
  if (!glowBorderEl) {
    glowBorderEl = createGlowBorder()
    document.body.appendChild(glowBorderEl)
  }
  if (!stopContainerEl) {
    stopContainerEl = createStopContainer()
    document.body.appendChild(stopContainerEl)
  }
  // 下一帧执行入场动效
  requestAnimationFrame(() => {
    if (glowBorderEl) glowBorderEl.style.opacity = '1'
    if (stopContainerEl) {
      const btn = stopContainerEl.querySelector<HTMLButtonElement>('#claude-agent-stop-button')
      if (btn) {
        btn.style.transform = 'translateY(0)'
        btn.style.opacity = '1'
      }
    }
  })
}

// 隐藏并在过渡结束后清理节点
function hideAgentIndicators(): void {
  if (!isShown) return
  isShown = false
  if (glowBorderEl) glowBorderEl.style.opacity = '0'
  if (stopContainerEl) {
    const btn = stopContainerEl.querySelector<HTMLButtonElement>('#claude-agent-stop-button')
    if (btn) {
      btn.style.transform = 'translateY(100px)'
      btn.style.opacity = '0'
    }
  }
  // 300ms 后若仍处于隐藏态则移除节点
  setTimeout(() => {
    if (!isShown) {
      if (glowBorderEl && glowBorderEl.parentNode) {
        glowBorderEl.parentNode.removeChild(glowBorderEl)
        glowBorderEl = null
      }
      if (stopContainerEl && stopContainerEl.parentNode) {
        stopContainerEl.parentNode.removeChild(stopContainerEl)
        stopContainerEl = null
      }
    }
  }, 300)
}

// 消息协议（等价还原）
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SHOW_AGENT_INDICATORS') {
    showAgentIndicators()
    sendResponse({ success: true })
    return
  }
  if (msg?.type === 'HIDE_AGENT_INDICATORS') {
    hideAgentIndicators()
    sendResponse({ success: true })
    return
  }
  if (msg?.type === 'HIDE_FOR_TOOL_USE') {
    // 记录当前显示状态，并临时隐藏（不改变 isShown）
    hiddenForToolUse = isShown
    if (glowBorderEl) glowBorderEl.style.display = 'none'
    if (stopContainerEl) stopContainerEl.style.display = 'none'
    sendResponse({ success: true })
    return
  }
  if (msg?.type === 'SHOW_AFTER_TOOL_USE') {
    if (hiddenForToolUse) {
      if (glowBorderEl) glowBorderEl.style.display = ''
      if (stopContainerEl) stopContainerEl.style.display = ''
    }
    hiddenForToolUse = false
    sendResponse({ success: true })
    return
  }
})

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  hideAgentIndicators()
})

// 供调试：标记注入完成
// console.debug('[agent-visual-indicator] ready')
