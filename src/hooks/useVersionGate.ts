import { useEffect, useMemo, useState } from 'react'
import { getLocalValue, StorageKey } from '../lib/storage'

export interface VersionGateState {
  isBlocked: boolean
  hasUpdate: boolean
  currentVersion: string
  minSupportedVersion: string | null
}

export function useVersionGate(): VersionGateState {
  const [currentVersion, setCurrentVersion] = useState('')
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    const v = chrome.runtime.getManifest().version
    setCurrentVersion(v)
    ;(async () => {
      const flag = await getLocalValue<boolean>(StorageKey.UPDATE_AVAILABLE)
      setHasUpdate(!!flag)
    })()
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[StorageKey.UPDATE_AVAILABLE]) {
        setHasUpdate(Boolean(changes[StorageKey.UPDATE_AVAILABLE].newValue === true))
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const minSupportedVersion: any = null;

  const isBlocked = useMemo(() => {
    if (!currentVersion || !minSupportedVersion) return false
    const a = currentVersion.split('.').map(Number)
    const b = minSupportedVersion.split('.').map(Number)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] || 0
      const bv = b[i] || 0
      if (av < bv) return true
      if (av > bv) return false
    }
    return false
  }, [currentVersion, minSupportedVersion])

  return { isBlocked, hasUpdate, currentVersion, minSupportedVersion }
}
