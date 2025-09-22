import React, { useState, useEffect, useCallback } from "react";
import { useDarkMode } from "../hooks/useDarkMode";
import { getLocalValue, setLocalKey, StorageKey } from "../../../lib/storage";

interface DomainConfig {
  logo_url: string;
  header_text: string;
  prompts: { prompt_title: string; prompt: string }[];
}

interface InitialScreenProps {
  tabId?: number;
  onPromptClick: (prompt: string) => void;
}

const TIP_CONFIG = {
    pin_extension: { maxDisplays: 1 }
};

function useTip(tipId: 'pin_extension', entityId?: number) {
    const [canShow, setCanShow] = useState(false);
    const [limitReached, setLimitReached] = useState(false);

    useEffect(() => {
        (async () => {
            if (entityId) {
                try {
                    const tipConfig = TIP_CONFIG[tipId];
                    const displayCounts = (await getLocalValue<Record<string, string[]>>(StorageKey.TIP_DISPLAY_COUNTS)) || {};
                    const shownForEntity = displayCounts[tipId] || [];
                    const hasBeenShown = shownForEntity.includes(String(entityId));
                    const isLimitReached = shownForEntity.length >= tipConfig.maxDisplays;

                    setLimitReached(isLimitReached);
                    setCanShow(!hasBeenShown && !isLimitReached);
                } catch (e) {
                    setCanShow(false);
                    setLimitReached(false);
                }
            } else {
                setCanShow(false);
            }
        })();
    }, [tipId, entityId]);

    const markAsShown = useCallback(async () => {
        if (entityId) {
            try {
                const displayCounts = (await getLocalValue<Record<string, string[]>>(StorageKey.TIP_DISPLAY_COUNTS)) || {};
                const shownForEntity = displayCounts[tipId] || [];
                if (!shownForEntity.includes(String(entityId))) {
                    shownForEntity.push(String(entityId));
                    displayCounts[tipId] = shownForEntity;
                    await setLocalKey(StorageKey.TIP_DISPLAY_COUNTS, displayCounts);
                }
            } catch (e) { /* ignore */ }
        }
    }, [tipId, entityId]);
    
    return { canShow, limitReached, markAsShown };
}


const MountedTrigger = ({ children, onMount }: { children: React.ReactNode; onMount: () => void }) => {
    useEffect(() => {
        onMount();
    }, [onMount]);
    return <>{children}</>;
};

export function InitialScreen({ tabId, onPromptClick }: InitialScreenProps) {
  const [domain, setDomain] = useState("");
  const [isPinned, setIsPinned] = useState<boolean | null>(null);
  // domain-specific prompts removed
  const pinExtensionTip = useTip('pin_extension', tabId);

  useEffect(() => {
    (async () => {
        try {
            if (!chrome.action || !chrome.action.getUserSettings) {
                setIsPinned(false);
                return;
            }
            const settings = await chrome.action.getUserSettings();
            setIsPinned(settings.isOnToolbar ?? false);
        } catch(e) {
            setIsPinned(false);
        }
    })();
  }, []);

  useEffect(() => {
    const updateDomain = (tab: chrome.tabs.Tab) => {
        if (tab.url) {
            try {
                const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
                setDomain(hostname);
            } catch(e) {
                setDomain("");
            }
        } else {
            setDomain("");
        }
    };
    if (tabId) {
        chrome.tabs.get(tabId).then(updateDomain).catch(() => setDomain(""));
    }
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        if (updatedTabId === tabId && changeInfo.url) {
            updateDomain(tab);
        }
    };
    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  }, [tabId]);

  const domainConfig = undefined as unknown as DomainConfig | undefined;

  if (domainConfig) {
    return <DomainSpecificScreen domainConfig={domainConfig} onPromptClick={onPromptClick} />;
  }

  if (isPinned === null) return null;

  if (!isPinned && pinExtensionTip.canShow) {
      return (
          <MountedTrigger onMount={pinExtensionTip.markAsShown}>
              <div className="flex flex-col items-center justify-center h-full">
                  <TipCard
                      lightImage="/assets/extension-light-min-CwWd0kAK.svg"
                      darkImage="/assets/extension-dark-min-Ctxo0Z8w.svg"
                      title="Pin Cow for quick access"
                      subtitle="Click the pin icon in the top right corner of the extension window"
                  />
              </div>
          </MountedTrigger>
      );
  }

  return null;
}

function DomainSpecificScreen({ domainConfig, onPromptClick }: { domainConfig: DomainConfig, onPromptClick: (p: string) => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full px-4 py-8">
            <div className="w-12 h-12 rounded-xl border-[0.5px] border-border-300 bg-always-white shadow-sm mb-4 overflow-hidden">
                <img src={domainConfig.logo_url} alt="" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-ui-sm text-text-500 mb-[22px]">{domainConfig.header_text}</h2>
            <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                {domainConfig.prompts.map((prompt, index) => (
                    <button
                        key={index}
                        onClick={() => onPromptClick(prompt.prompt)}
                        className="min-w-[75px] h-8 px-[14px] py-[3px] font-base text-text-100 border-[0.5px] border-border-300 bg-white/30 hover:bg-bg-200 transition-colors text-center"
                        style={{ borderRadius: '38px' }}
                    >
                        {prompt.prompt_title}
                    </button>
                ))}
            </div>
        </div>
    );
}

function TipCard({ lightImage, darkImage, title, subtitle }: { lightImage: string; darkImage: string; title: string; subtitle: string; }) {
    const isDarkMode = useDarkMode();
    return (
        <div className="flex flex-col items-center">
            <img src={isDarkMode ? darkImage : lightImage} alt={title} className="w-[188px] h-[122px] rounded-[14px]" />
            <div className="mt-4 flex flex-col items-center gap-1 w-[188px]">
                <p className="text-text-300 text-center font-styrene text-xs font-medium leading-[140%] tracking-[-0.24px]">{title}</p>
                <p className="text-text-500 text-center font-styrene text-xs font-normal leading-[140%] tracking-[-0.24px]">{subtitle}</p>
            </div>
        </div>
    );
}
