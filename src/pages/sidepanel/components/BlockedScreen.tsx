// 原始函数: Gy

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

/**
 * A screen indicating that Claude cannot access the current page.
 * @original Gy
 */
export function BlockedScreen() {
    const isDarkMode = useDarkMode();
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg-100 p-8">
            <div className="max-w-md text-center">
                <div className="w-12 h-12 flex items-center justify-center mx-auto">
                    <img
                        src={isDarkMode ? '/assets/darkshield-C5QZAT-q.svg' : '/assets/lightshield-Dx3kyqnQ.svg'}
                        alt="Shield"
                        className="w-12 h-12"
                    />
                </div>
                <h2 className="font-large-bold text-text-100 mt-[22px]">Can't access this page</h2>
                <p className="font-base text-text-300 mt-[7px]">Claude cannot assist with the content on this page.</p>
            </div>
        </div>
    );
}