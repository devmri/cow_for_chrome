// CDP 助手：等价还原 sidepanel 资产中的 z/B 功能子集
// - attach/detach 调试器
// - 发送 CDP 命令
// - 鼠标点击/滚轮/键盘/插入文本
// - 截图并按 token/像素约束缩放
// - 维护截图上下文用于坐标缩放

type KeyDef = {
  key: string
  code: string
  keyCode: number
  text?: string
  windowsVirtualKeyCode?: number
  location?: number
  isKeypad?: boolean
}

export type ScreenshotInfo = {
  base64: string
  width: number
  height: number
  format: 'png'
  viewportWidth: number
  viewportHeight: number
}

type ResizeParams = { pxPerToken: number; maxTargetPx: number; maxTargetTokens: number }

class ComputerContextStore {
  private contexts = new Map<number, {
    viewportWidth: number
    viewportHeight: number
    screenshotWidth: number
    screenshotHeight: number
  }>()

  setContext(tabId: number, info: ScreenshotInfo) {
    if (info.viewportWidth && info.viewportHeight) {
      this.contexts.set(tabId, {
        viewportWidth: info.viewportWidth,
        viewportHeight: info.viewportHeight,
        screenshotWidth: info.width,
        screenshotHeight: info.height,
      })
    }
  }

  getContext(tabId: number) {
    return this.contexts.get(tabId)
  }

  clearContext(tabId: number) {
    this.contexts.delete(tabId)
  }

  clearAllContexts() {
    this.contexts.clear()
  }
}

function gridTokens(w: number, h: number, pxPerToken: number) {
  const cols = Math.floor((w - 1) / pxPerToken) + 1
  const rows = Math.floor((h - 1) / pxPerToken) + 1
  return cols * rows
}

function bestResize(w: number, h: number, p: ResizeParams): [number, number] {
  const { pxPerToken, maxTargetPx, maxTargetTokens } = p
  if (w <= maxTargetPx && h <= maxTargetPx && gridTokens(w, h, pxPerToken) <= maxTargetTokens) return [w, h]
  if (h > w) {
    const [nw, nh] = bestResize(h, w, p)
    return [nh, nw]
  }
  const ratio = w / h
  let hi = w, lo = 1
  for (;;) {
    if (lo + 1 === hi) return [lo, Math.max(Math.round(lo / ratio), 1)]
    const mid = Math.floor((lo + hi) / 2)
    const mh = Math.max(Math.round(mid / ratio), 1)
    if (mid <= maxTargetPx && gridTokens(mid, mh, pxPerToken) <= maxTargetTokens) lo = mid
    else hi = mid
  }
}

const contexts = new ComputerContextStore()

class CDPHelper {
  private debuggerAttached = new Map<number, boolean>()
  private pendingAttachments = new Map<number, Promise<void>>()
  private isMac = false
  defaultResizeParams: ResizeParams = { pxPerToken: 28, maxTargetPx: 1568, maxTargetTokens: 1568 }

  constructor() {
    this.isMac = navigator.platform.toUpperCase().includes('MAC') || navigator.userAgent.toUpperCase().includes('MAC')
  }

  async attachDebugger(tabId: number): Promise<void> {
    if (this.debuggerAttached.get(tabId)) return
    try {
      const targets = await new Promise<chrome.debugger.TargetInfo[]>((resolve) => chrome.debugger.getTargets(resolve))
      if (targets.find((t) => t.tabId === tabId && t.attached)) {
        this.debuggerAttached.set(tabId, true)
        return
      }
    } catch {}
    const pending = this.pendingAttachments.get(tabId)
    if (pending) return pending
    const p = new Promise<void>((resolve, reject) => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        this.debuggerAttached.set(tabId, true)
        chrome.debugger.onDetach.addListener((info) => {
          if (info.tabId === tabId) this.debuggerAttached.delete(tabId)
        })
        resolve()
      })
    })
    this.pendingAttachments.set(tabId, p)
    try { await p } finally { this.pendingAttachments.delete(tabId) }
  }

  async detachDebugger(tabId: number): Promise<void> {
    if (!this.debuggerAttached.get(tabId)) return
    await new Promise<void>((resolve) => chrome.debugger.detach({ tabId }, () => { this.debuggerAttached.delete(tabId); resolve() }))
  }

  async sendCommand<T = any>(tabId: number, method: string, params?: any): Promise<T> {
    await this.attachDebugger(tabId)
    return await new Promise<T>((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else resolve(result as T)
      })
    })
  }

  async dispatchMouseEvent(tabId: number, evt: any): Promise<void> {
    const payload: any = { type: evt.type, x: Math.round(evt.x), y: Math.round(evt.y), modifiers: evt.modifiers || 0 }
    if (['mousePressed', 'mouseReleased', 'mouseMoved'].includes(evt.type)) {
      payload.button = evt.button || 'none'
      if (['mousePressed', 'mouseReleased'].includes(evt.type)) payload.clickCount = evt.clickCount || 1
    }
    if (evt.type !== 'mouseWheel') payload.buttons = evt.buttons ?? 0
    if (evt.type === 'mouseWheel' && (evt.deltaX !== undefined || evt.deltaY !== undefined)) {
      payload.deltaX = evt.deltaX || 0
      payload.deltaY = evt.deltaY || 0
    }
    await this.sendCommand(tabId, 'Input.dispatchMouseEvent', payload)
  }

  async dispatchKeyEvent(tabId: number, evt: any): Promise<void> {
    const payload = { modifiers: 0, ...evt }
    await this.sendCommand(tabId, 'Input.dispatchKeyEvent', payload)
  }

  async insertText(tabId: number, text: string): Promise<void> { await this.sendCommand(tabId, 'Input.insertText', { text }) }

  async click(tabId: number, x: number, y: number, button: 'left'|'right'|'middle' = 'left', clickCount = 1): Promise<void> {
    try { await chrome.tabs.sendMessage(tabId, { type: 'HIDE_FOR_TOOL_USE' }); await new Promise(r => setTimeout(r, 50)) } catch {}
    try {
      let buttons = 0
      if (button === 'left') buttons = 1; else if (button === 'right') buttons = 2; else if (button === 'middle') buttons = 4
      await this.dispatchMouseEvent(tabId, { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
      await new Promise(r => setTimeout(r, 100))
      for (let c = 1; c <= clickCount; c++) {
        await this.dispatchMouseEvent(tabId, { type: 'mousePressed', x, y, button, buttons, clickCount: c })
        await new Promise(r => setTimeout(r, 12))
        await this.dispatchMouseEvent(tabId, { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: c })
        if (c < clickCount) await new Promise(r => setTimeout(r, 100))
      }
    } finally { try { await chrome.tabs.sendMessage(tabId, { type: 'SHOW_AFTER_TOOL_USE' }) } catch {} }
  }

  async type(tabId: number, text: string): Promise<void> {
    for (const ch of text) {
      let keyStr = ch
      if (ch === '\n' || ch === '\r') keyStr = 'Enter'
      const kd = this.getKeyCode(keyStr)
      if (kd) {
        const mods = this.requiresShift(ch) ? 8 : 0
        await this.pressKey(tabId, kd, mods)
      } else {
        await this.insertText(tabId, ch)
      }
    }
  }

  async keyDown(tabId: number, kd: KeyDef, modifiers = 0, commands?: string[]): Promise<void> {
    await this.dispatchKeyEvent(tabId, {
      type: kd.text ? 'keyDown' : 'rawKeyDown',
      key: kd.key,
      code: kd.code,
      windowsVirtualKeyCode: kd.windowsVirtualKeyCode || kd.keyCode,
      modifiers,
      text: kd.text ?? '',
      unmodifiedText: kd.text ?? '',
      location: kd.location ?? 0,
      commands: commands ?? [],
      isKeypad: kd.isKeypad ?? false,
    })
  }
  async keyUp(tabId: number, kd: KeyDef, modifiers = 0): Promise<void> {
    await this.dispatchKeyEvent(tabId, {
      type: 'keyUp', key: kd.key, modifiers, windowsVirtualKeyCode: kd.windowsVirtualKeyCode || kd.keyCode, code: kd.code, location: kd.location ?? 0,
    })
  }
  async pressKey(tabId: number, kd: KeyDef, modifiers = 0, commands?: string[]): Promise<void> { await this.keyDown(tabId, kd, modifiers, commands); await this.keyUp(tabId, kd, modifiers) }

  async pressKeyChord(tabId: number, chord: string): Promise<void> {
    const parts = chord.toLowerCase().split('+')
    const mods: string[] = []
    let key = ''
    for (const p of parts) {
      if (['ctrl','control','alt','shift','cmd','meta','command','win','windows'].includes(p)) mods.push(p)
      else key = p
    }
    let modBits = 0
    const map: Record<string, number> = { alt: 1, ctrl: 2, control: 2, meta: 4, cmd: 4, command: 4, win: 4, windows: 4, shift: 8 }
    for (const m of mods) modBits |= map[m] || 0
    const kd = this.getKeyCode(key)
    if (!kd) throw new Error(`Unknown key: ${chord}`)
    // Mac 上根据组合键传入 commands，等价资产中的 U 映射
    let commands: string[] | undefined
    if (this.isMac) {
      const cmd = MAC_COMMANDS[chord.toLowerCase()]
      if (cmd) commands = Array.isArray(cmd) ? cmd : [cmd]
    }
    await this.keyDown(tabId, kd, modBits, commands)
    await this.keyUp(tabId, kd, modBits)
  }

  async scrollWheel(tabId: number, x: number, y: number, dx: number, dy: number): Promise<void> {
    await this.dispatchMouseEvent(tabId, { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy })
  }

  getKeyCode(key: string): KeyDef | undefined {
    const t = key.toLowerCase()
    if (KEY_ALIASES[t]) return KEY_ALIASES[t]
    if (key.length === 1) {
      const upper = key.toUpperCase()
      let code: string | undefined
      if (upper >= 'A' && upper <= 'Z') code = `Key${upper}`
      else if (key >= '0' && key <= '9') code = `Digit${key}`
      if (code) return { key, code, keyCode: upper.charCodeAt(0), text: key }
    }
    return undefined
  }

  isAttached(tabId: number) { return this.debuggerAttached.get(tabId) || false }
  async detachAllDebuggers() { const ids = Array.from(this.debuggerAttached.keys()); await Promise.all(ids.map((id) => this.detachDebugger(id))) }
  requiresShift(ch: string) { return '~!@#$%^&*()_+{}|:"<>?'.includes(ch) || (ch >= 'A' && ch <= 'Z') }

  async screenshot(tabId: number, params?: ResizeParams): Promise<ScreenshotInfo> {
    const p = params || this.defaultResizeParams
    try { await chrome.tabs.sendMessage(tabId, { type: 'HIDE_FOR_TOOL_USE' }); await new Promise(r => setTimeout(r, 50)) } catch {}
    try {
      const vp = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio }) })
      if (!vp || !vp[0]?.result) throw new Error('Failed to get viewport information')
      const { width: vw, height: vh, devicePixelRatio: dpr } = vp[0].result as any
      const cap = await this.sendCommand<{ data: string }>(tabId, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
      if (!cap || !cap.data) throw new Error('Failed to capture screenshot via CDP')
      const dataUrl = `data:image/png;base64,${cap.data}`
      const processed = await new Promise<ScreenshotInfo>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          let sw = img.width, sh = img.height
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Failed to create 2D context for screenshot processing'))
          if (dpr > 1) {
            sw = Math.round(img.width / dpr)
            sh = Math.round(img.height / dpr)
            canvas.width = sw; canvas.height = sh
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, sw, sh)
          } else { canvas.width = sw; canvas.height = sh; ctx.drawImage(img, 0, 0) }
          const [tw, th] = bestResize(sw, sh, p)
          if (sw !== tw || sh !== th) {
            const c2 = document.createElement('canvas')
            const g2 = c2.getContext('2d')!
            c2.width = tw; c2.height = th
            g2.drawImage(canvas, 0, 0, sw, sh, 0, 0, tw, th)
            const b64 = c2.toDataURL('image/png').split(',')[1]
            resolve({ base64: b64, width: tw, height: th, format: 'png', viewportWidth: vw, viewportHeight: vh })
          } else {
            const b64 = canvas.toDataURL('image/png').split(',')[1]
            resolve({ base64: b64, width: sw, height: sh, format: 'png', viewportWidth: vw, viewportHeight: vh })
          }
        }
        img.onerror = () => reject(new Error('Failed to load screenshot image'))
        img.src = dataUrl
      })
      contexts.setContext(tabId, processed)
      return processed
    } finally { try { await chrome.tabs.sendMessage(tabId, { type: 'SHOW_AFTER_TOOL_USE' }) } catch {} }
  }
}

export const cdp = new CDPHelper()
export const computerContexts = contexts

// Mac 平台组合键 → WebKit Commands（等价资产中的 U）
// 仅在 Mac 下传入 commands，可影响编辑器行为（选择/删除/滚动等）
const MAC_COMMANDS: Record<string, string | string[]> = {
  backspace: 'deleteBackward',
  enter: 'insertNewline',
  numpadenter: 'insertNewline',
  kp_enter: 'insertNewline',
  escape: 'cancelOperation',
  arrowup: 'moveUp',
  arrowdown: 'moveDown',
  arrowleft: 'moveLeft',
  arrowright: 'moveRight',
  up: 'moveUp',
  down: 'moveDown',
  left: 'moveLeft',
  right: 'moveRight',
  f5: 'complete',
  delete: 'deleteForward',
  home: 'scrollToBeginningOfDocument',
  end: 'scrollToEndOfDocument',
  pageup: 'scrollPageUp',
  pagedown: 'scrollPageDown',
  'shift+backspace': 'deleteBackward',
  'shift+enter': 'insertNewline',
  'shift+escape': 'cancelOperation',
  'shift+arrowup': 'moveUpAndModifySelection',
  'shift+arrowdown': 'moveDownAndModifySelection',
  'shift+arrowleft': 'moveLeftAndModifySelection',
  'shift+arrowright': 'moveRightAndModifySelection',
  'shift+up': 'moveUpAndModifySelection',
  'shift+down': 'moveDownAndModifySelection',
  'shift+left': 'moveLeftAndModifySelection',
  'shift+right': 'moveRightAndModifySelection',
  'shift+delete': 'deleteForward',
  'shift+pageup': 'pageUp',
  'shift+pagedown': 'pageDown',
  'alt+b': 'moveWordBackward',
  'alt+f': 'moveWordForward',
  'alt+backspace': 'deleteWordBackward',
  'shift+alt+b': 'moveWordBackwardAndModifySelection',
  'shift+alt+f': 'moveWordForwardAndModifySelection',
  'shift+alt+backspace': 'deleteWordBackward',
  'cmd+numpadsubtract': 'cancel',
  'cmd+backspace': 'deleteToBeginningOfLine',
  'cmd+arrowup': 'moveToBeginningOfDocument',
  'cmd+arrowdown': 'moveToEndOfDocument',
  'cmd+arrowleft': 'moveToLeftEndOfLine',
  'cmd+arrowright': 'moveToRightEndOfLine',
  'cmd+home': 'moveToBeginningOfDocument',
  'cmd+up': 'moveToBeginningOfDocument',
  'cmd+down': 'moveToEndOfDocument',
  'cmd+left': 'moveToLeftEndOfLine',
  'cmd+right': 'moveToRightEndOfLine',
  'shift+cmd+numpadsubtract': 'cancel',
  'shift+cmd+backspace': 'deleteToBeginningOfLine',
  'shift+cmd+arrowup': 'moveToBeginningOfDocumentAndModifySelection',
  'shift+cmd+arrowdown': 'moveToEndOfDocumentAndModifySelection',
  'shift+cmd+arrowleft': 'moveToLeftEndOfLineAndModifySelection',
  'shift+cmd+arrowright': 'moveToRightEndOfLineAndModifySelection',
  'cmd+a': 'selectAll',
  'cmd+c': 'copy',
  'cmd+x': 'cut',
  'cmd+v': 'paste',
  'cmd+z': 'undo',
  'shift+cmd+z': 'redo',
}

// 键位别名表（等价资产中的 Z，覆盖常见键与符号/小键盘）
const KEY_ALIASES: Record<string, KeyDef> = {
  enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  return: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  kp_enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r', isKeypad: true },
  tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
  backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
  space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  ' ': { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  home: { key: 'Home', code: 'Home', keyCode: 36 },
  end: { key: 'End', code: 'End', keyCode: 35 },
  pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
  pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
  // 功能键
  f1: { key: 'F1', code: 'F1', keyCode: 112 }, f2: { key: 'F2', code: 'F2', keyCode: 113 }, f3: { key: 'F3', code: 'F3', keyCode: 114 }, f4: { key: 'F4', code: 'F4', keyCode: 115 }, f5: { key: 'F5', code: 'F5', keyCode: 116 }, f6: { key: 'F6', code: 'F6', keyCode: 117 }, f7: { key: 'F7', code: 'F7', keyCode: 118 }, f8: { key: 'F8', code: 'F8', keyCode: 119 }, f9: { key: 'F9', code: 'F9', keyCode: 120 }, f10: { key: 'F10', code: 'F10', keyCode: 121 }, f11: { key: 'F11', code: 'F11', keyCode: 122 }, f12: { key: 'F12', code: 'F12', keyCode: 123 },
  // 标点与符号
  ';': { key: ';', code: 'Semicolon', keyCode: 186, text: ';' },
  '=': { key: '=', code: 'Equal', keyCode: 187, text: '=' },
  ',': { key: ',', code: 'Comma', keyCode: 188, text: ',' },
  '-': { key: '-', code: 'Minus', keyCode: 189, text: '-' },
  '.': { key: '.', code: 'Period', keyCode: 190, text: '.' },
  '/': { key: '/', code: 'Slash', keyCode: 191, text: '/' },
  '`': { key: '`', code: 'Backquote', keyCode: 192, text: '`' },
  '[': { key: '[', code: 'BracketLeft', keyCode: 219, text: '[' },
  '\\': { key: '\\', code: 'Backslash', keyCode: 220, text: '\\' },
  ']': { key: ']', code: 'BracketRight', keyCode: 221, text: ']' },
  "'": { key: "'", code: 'Quote', keyCode: 222, text: "'" },
  '!': { key: '!', code: 'Digit1', keyCode: 49, text: '!' },
  '@': { key: '@', code: 'Digit2', keyCode: 50, text: '@' },
  '#': { key: '#', code: 'Digit3', keyCode: 51, text: '#' },
  '$': { key: '$', code: 'Digit4', keyCode: 52, text: '$' },
  '%': { key: '%', code: 'Digit5', keyCode: 53, text: '%' },
  '^': { key: '^', code: 'Digit6', keyCode: 54, text: '^' },
  '&': { key: '&', code: 'Digit7', keyCode: 55, text: '&' },
  '*': { key: '*', code: 'Digit8', keyCode: 56, text: '*' },
  '(': { key: '(', code: 'Digit9', keyCode: 57, text: '(' },
  ')': { key: ')', code: 'Digit0', keyCode: 48, text: ')' },
  '_': { key: '_', code: 'Minus', keyCode: 189, text: '_' },
  '+': { key: '+', code: 'Equal', keyCode: 187, text: '+' },
  '{': { key: '{', code: 'BracketLeft', keyCode: 219, text: '{' },
  '}': { key: '}', code: 'BracketRight', keyCode: 221, text: '}' },
  '|': { key: '|', code: 'Backslash', keyCode: 220, text: '|' },
  ':': { key: ':', code: 'Semicolon', keyCode: 186, text: ':' },
  '"': { key: '"', code: 'Quote', keyCode: 222, text: '"' },
  '<': { key: '<', code: 'Comma', keyCode: 188, text: '<' },
  '>': { key: '>', code: 'Period', keyCode: 190, text: '>' },
  '?': { key: '?', code: 'Slash', keyCode: 191, text: '?' },
  '~': { key: '~', code: 'Backquote', keyCode: 192, text: '~' },
  // 锁定类
  capslock: { key: 'CapsLock', code: 'CapsLock', keyCode: 20 },
  numlock: { key: 'NumLock', code: 'NumLock', keyCode: 144 },
  scrolllock: { key: 'ScrollLock', code: 'ScrollLock', keyCode: 145 },
  pause: { key: 'Pause', code: 'Pause', keyCode: 19 },
  insert: { key: 'Insert', code: 'Insert', keyCode: 45 },
  printscreen: { key: 'PrintScreen', code: 'PrintScreen', keyCode: 44 },
  // 小键盘
  numpad0: { key: '0', code: 'Numpad0', keyCode: 96, isKeypad: true },
  numpad1: { key: '1', code: 'Numpad1', keyCode: 97, isKeypad: true },
  numpad2: { key: '2', code: 'Numpad2', keyCode: 98, isKeypad: true },
  numpad3: { key: '3', code: 'Numpad3', keyCode: 99, isKeypad: true },
  numpad4: { key: '4', code: 'Numpad4', keyCode: 100, isKeypad: true },
  numpad5: { key: '5', code: 'Numpad5', keyCode: 101, isKeypad: true },
  numpad6: { key: '6', code: 'Numpad6', keyCode: 102, isKeypad: true },
  numpad7: { key: '7', code: 'Numpad7', keyCode: 103, isKeypad: true },
  numpad8: { key: '8', code: 'Numpad8', keyCode: 104, isKeypad: true },
  numpad9: { key: '9', code: 'Numpad9', keyCode: 105, isKeypad: true },
  numpadmultiply: { key: '*', code: 'NumpadMultiply', keyCode: 106, isKeypad: true },
  numpadadd: { key: '+', code: 'NumpadAdd', keyCode: 107, isKeypad: true },
  numpadsubtract: { key: '-', code: 'NumpadSubtract', keyCode: 109, isKeypad: true },
  numpaddecimal: { key: '.', code: 'NumpadDecimal', keyCode: 110, isKeypad: true },
  numpaddivide: { key: '/', code: 'NumpadDivide', keyCode: 111, isKeypad: true },
}
