import { useEffect, useState } from 'react'

// 选项页示例：读写 chrome.storage.sync
export default function OptionsApp() {
  const [enabled, setEnabled] = useState<boolean>(true)

  useEffect(() => {
    chrome.storage.sync.get({ enabled: true }, (res) => setEnabled(!!res.enabled))
  }, [])

  const save = () => {
    chrome.storage.sync.set({ enabled }, () => {
      // 简易反馈
      console.log('Saved', { enabled })
    })
  }

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif' }}>
      <h3 style={{ marginTop: 0 }}>Claude Options (Skeleton)</h3>
      <label style={{ display: 'block', marginBottom: 12 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ marginLeft: 8 }}>Enabled</span>
      </label>
      <button onClick={save} style={{ padding: '6px 10px' }}>Save</button>
    </div>
  )
}

