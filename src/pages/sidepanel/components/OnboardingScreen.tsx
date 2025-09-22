
import React from 'react';
import { EyeIcon as ShieldIconSolid, FilterIcon as SparkleIcon, WarningTriangleIcon } from '../../../components/icons';

interface OnboardingScreenProps {
    onAccept: () => void;
}

const LEARN_MORE_URL = "https://support.anthropic.com/en/articles/12012173-getting-started-with-claude-for-chrome#h_d35ef0174c";

export function OnboardingScreen({ onAccept }: OnboardingScreenProps) {
    return (
        <div className="w-full h-screen bg-bg-100 flex items-center justify-center p-5">
            <div className="max-w-[520px] w-full">
                <h1 className="text-center text-text-300 mb-[22px]" style={{ fontFamily: 'Copernicus, var(--font-ui-serif)', fontSize: '26px', fontWeight: 500, lineHeight: '130%', letterSpacing: '-0.65px' }}>
                    Let ai<br />control your browser
                </h1>
                <div className="border border-border-300 rounded-[24px] mb-[22px]">
                    <div className="flex gap-3 pt-5 pb-4 px-4">
                        <div className="mt-0.5"><ShieldIconSolid size={20} className="text-text-100" /></div>
                        <p className="text-[12px] text-text-300 flex-1 leading-[140%]">
                            LLM can view the URL of tabs where the panel is open and take screenshots when responding. For privacy, avoid using LLM on sensitive sites like health and dating platforms.
                        </p>
                    </div>
                    <div className="border-t-[0.5px] border-border-300 px-4" />
                    <div className="flex gap-3 py-4 px-4">
                        <div className="mt-0.5"><SparkleIcon size={20} className="text-text-100" /></div>
                        <p className="text-[12px] text-text-300 flex-1 leading-[140%]">
                            This is a beta feature with unique risks distinct from other llm products. You are fully responsible for all risks associated with use of this product.
                        </p>
                    </div>
                    <div className="border-t-[0.5px] border-border-300 px-4" />
                    <div className="flex gap-3 pt-4 pb-5 px-4">
                        <div className="mt-0.5"><WarningTriangleIcon size={20} className="text-danger-000" /></div>
                        <div className="flex-1">
                            <p className="text-[12px] text-danger-000 leading-[140%]">
                                Malicious code buried in sites may override your instructions in order to steal your data, inject malware into your systems, or take over your system to attack other users.
                                {' '}
                                <button onClick={() => { chrome.tabs.create({ url: LEARN_MORE_URL }); }} className="text-danger-000 underline hover:no-underline focus:outline-none">
                                    Learn more
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={onAccept} className="px-4 py-2.5 rounded-[14px] bg-text-100 hover:bg-text-200 active:bg-text-000 text-bg-100 font-button transition-all hover:shadow-md">
                        I understand
                    </button>
                </div>
            </div>
        </div>
    );
}