// 原始函数: Jy

import React from 'react';

/**
 * A visual separator indicating that the conversation has been compacted.
 * @original Jy
 */
export function CompactionIndicator() {
    return (
        <div className="flex items-center gap-2 py-2 my-2">
            <div className="flex-1 h-[0.5px] bg-border-300" />
            <div className="text-xs text-text-400 px-2 bg-bg-100">
                Conversation compacted
            </div>
            <div className="flex-1 h-[0.5px] bg-border-300" />
        </div>
    );
}