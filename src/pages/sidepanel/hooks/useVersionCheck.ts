
import { useState, useEffect } from "react";
import { getLocalValue, StorageKey } from "../../../lib/storage";

interface VersionInfo {
  isBlocked: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  minSupportedVersion: string | null;
}

export function useVersionCheck(): VersionInfo {
  const [currentVersion, setCurrentVersion] = useState("");
  const [hasUpdate, setHasUpdate] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    isBlocked: false,
    hasUpdate: false,
    currentVersion: "",
    minSupportedVersion: null,
  });
  
  const versionConfig = null as any;

  useEffect(() => {
    const manifest = chrome.runtime.getManifest();
    setCurrentVersion(manifest.version);
    
    (async () => {
      const updateAvailable = await getLocalValue(StorageKey.UPDATE_AVAILABLE);
      setHasUpdate(!!updateAvailable);
    })();

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[StorageKey.UPDATE_AVAILABLE]) {
        setHasUpdate(!!changes[StorageKey.UPDATE_AVAILABLE].newValue);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  useEffect(() => {
    if (!currentVersion) return;

    const minSupportedVersion: any = null;
    
    const isVersionOutdated = !!minSupportedVersion && versionCompare(currentVersion, minSupportedVersion) < 0;

    setVersionInfo({
      isBlocked: isVersionOutdated,
      hasUpdate: hasUpdate,
      currentVersion: currentVersion,
      minSupportedVersion: minSupportedVersion || null,
    });

  }, [currentVersion, hasUpdate]);

  return versionInfo;
}

/**
 * Compares two version strings (e.g., "1.0.1", "1.0.0").
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2.
 */
function versionCompare(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}
