// 原始函数: Qy

import React, { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Message } from '../types';

interface ConversationSummaryProps {
    message: Message;
}

/**
 * A component to display a conversation summary, which can be expanded or collapsed.
 * @original Qy
 */
export function ConversationSummary({ message }: ConversationSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const content = typeof message.content === 'string' ? message.content : '';

    return (
        <div className="mb-5 overflow-hidden border-[0.5px] border-border-200 rounded-[10px]">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={
                    "w-full px-4 py-2 transition-colors flex items-center justify-between text-left cursor-pointer " +
                    (isExpanded ? "bg-bg-000" : "bg-bg-100 hover:bg-bg-200")
                }
            >
                <span className="font-small text-text-300">Conversation summary</span>
                <ChevronRightIcon
                    className={
                        "w-4 h-4 text-text-400 transition-transform " +
                        (isExpanded ? "rotate-90" : "")
                    }
                />
            </button>
            {isExpanded && (
                <div className="px-4 pt-2 pb-4 bg-bg-000">
                    <div className="font-claude-response text-xs text-text-200 whitespace-pre-wrap">
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}