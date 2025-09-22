import React from 'react';
import { WarningTriangleIcon, SkipPermissionsIllustration } from '../../../../components/icons';

const LEARN_MORE_URL = "https://support.anthropic.com/en/articles/12012173-getting-started-with-claude-for-chrome#h_d35ef0174c";

interface SkipPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function SkipPermissionsModal({ isOpen, onClose, onConfirm }: SkipPermissionsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="w-full h-screen bg-bg-100 flex items-center justify-center p-5 absolute inset-0 z-50">
            <div className="max-w-[520px] w-full">
                <div className="flex justify-start mb-4">
                   <SkipPermissionsIllustration />
                </div>
                <h2 className="text-text-100 font-styrene font-medium text-[20px] leading-[140%] mb-4" style={{ letterSpacing: '-0.6px' }}>
                    Skip all permissions across the internet?
                </h2>
                <div className="bg-danger-900 border-[0.5px] border-danger-200 rounded-lg p-4 mb-4">
                    <h3 className="text-[14px] font-styrene font-medium text-danger-000 leading-[140%] mb-2.5 flex items-center gap-1">
                        <WarningTriangleIcon size={16} className="text-danger-000" />
                        WARNING
                    </h3>
                    <ul className="text-[14px] font-styrene font-normal text-danger-000 leading-[140%] ml-4 list-disc space-y-2">
                        <li style={{ letterSpacing: '-0.36px' }}>This allows Cow to take any action on the internet.</li>
                        <li style={{ letterSpacing: '-0.36px' }}>This mode puts your data and the data of others at risk from malicious code.</li>
                        <li style={{ letterSpacing: '-0.36px' }}>You should oversee Cow when it is in this mode. You are fully responsible for all risks associated with permission-less Cow.</li>
                        <li style={{ letterSpacing: '-0.36px' }}>
                            Review{' '}
                            <button onClick={() => chrome.tabs.create({ url: LEARN_MORE_URL })} className="text-danger-000 underline hover:no-underline focus:outline-none">risks</button>
                            {' '}before you begin.
                        </li>
                    </ul>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-[14px] py-2 border border-border-300 text-text-200 rounded-[14px] hover:bg-bg-200 transition-colors font-styrene font-medium text-[14px]">
                        Cancel
                    </button>
                    <button onClick={async () => { await onConfirm(); onClose(); }} className="px-[14px] py-2 bg-text-100 text-bg-100 rounded-[14px] hover:bg-text-200 transition-colors font-styrene font-medium text-[14px]">
                        Skip permissions
                    </button>
                </div>
            </div>
        </div>
    );
}