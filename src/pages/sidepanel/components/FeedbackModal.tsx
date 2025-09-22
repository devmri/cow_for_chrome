// 原始函数: ox

import React, { useState } from 'react';
import { Message } from '../types';
import { ThumbsUp, ThumbsDown, X, ChevronDown } from 'lucide-react';

interface FeedbackModalProps {
    onClose: () => void;
    onSubmit: (data: { thumbs: 'positive' | 'negative'; type: string; message: string; messageId: string }) => void;
    feedbackType: 'positive' | 'negative';
    message: Message | null;
}

const NEGATIVE_FEEDBACK_OPTIONS = [
    { value: "ui_bug", label: "UI bug" },
    { value: "incorrect_assumptions", label: "Made incorrect assumptions" },
    { value: "incomplete_request", label: "Incomplete request" },
    { value: "too_much_input", label: "Asked for too much input" },
    { value: "ui_misunderstanding", label: "Didn't understand the UI" },
    { value: "unauthorized_action", label: "Did something it shouldn't have done" },
    { value: "navigation_error", label: "Navigation, clicking, typing, scrolling error" },
    { value: "other", label: "Other" },
];

export function FeedbackModal({ onClose, onSubmit, feedbackType, message }: FeedbackModalProps) {
    const [issueType, setIssueType] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="bg-bg-000 rounded-[14px]">
            <div className="flex items-center justify-between py-[10px] px-4">
                <div className="flex items-center gap-2">
                    {feedbackType === 'positive' ? <ThumbsUp size={20} className="text-text-100" /> : <ThumbsDown size={20} className="text-text-100" />}
                    <h3 className="font-styrene text-[14px] font-normal leading-[140%] text-text-100">Share {feedbackType} feedback</h3>
                </div>
                <button onClick={onClose} className="p-1 text-text-300 hover:bg-bg-100 rounded transition-colors" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
            <div className="border-t border-border-300 mb-4" />
            <div className="space-y-4 px-4">
                {feedbackType === 'negative' && (
                    <>
                        <div>
                            <p className="font-base-bold text-text-100 mb-2">What type of issue do you wish to report? (optional)</p>
                            <div className="relative">
                                <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
                                    className="w-full h-10 px-3 bg-bg-100 border border-border-200 rounded-lg text-text-100 text-sm font-normal font-styrene leading-tight focus:outline-none focus:ring-2 focus:ring-accent-main-200 focus:border-transparent appearance-none"
                                >
                                    <option value="">Select</option>
                                    {NEGATIVE_FEEDBACK_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-text-300 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <p className="font-base-bold text-text-100 mb-2">Please provide details: (optional)</p>
                            <textarea value={details} onChange={e => setDetails(e.target.value)}
                                placeholder="What was unsatisfying about this response?"
                                className="w-full h-28 p-3 bg-bg-100 border border-border-200 rounded-lg text-text-100 placeholder-text-400 text-sm font-normal font-styrene leading-tight resize-none focus:outline-none focus:ring-2 focus:ring-accent-main-200 focus:border-transparent"
                            />
                        </div>
                    </>
                )}
                {feedbackType === 'positive' && (
                     <div>
                        <p className="font-base-bold text-text-100 mb-2">Please provide details: (optional)</p>
                        <textarea value={details} onChange={e => setDetails(e.target.value)}
                            placeholder="What was satisfying about this response?"
                            className="w-full h-28 p-3 bg-bg-100 border border-border-200 rounded-lg text-text-100 placeholder-text-400 text-sm font-normal font-styrene leading-tight resize-none focus:outline-none focus:ring-2 focus:ring-accent-main-200 focus:border-transparent"
                        />
                    </div>
                )}
                <div className="text-text-300">
                    <p className="text-xs font-small font-styrene">
                        Submitting this report will send the entire current conversation to Anthropic for future improvements to our models.
                        {' '}
                        <a href="https://privacy.anthropic.com/en/articles/10023548-how-long-do-you-store-my-data" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:text-text-200">Learn more</a>
                    </p>
                </div>
            </div>
            <div className="px-3 py-[10px] space-y-[5px] mt-[10px] mb-0.5">
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="h-8 min-w-20 px-3.5 py-[3px] rounded-lg outline outline-[0.50px] outline-offset-[-0.50px] outline-border-200/30 flex justify-center items-center gap-2 overflow-hidden hover:bg-bg-100 transition-colors">
                        <div className="flex-1 text-center justify-start text-text-100 text-sm font-medium font-styrene leading-tight">Cancel</div>
                    </button>
                    <button onClick={() => {
                        setIsSubmitting(true);
                        try {
                            if (!message?.id) return;
                            onSubmit({ thumbs: feedbackType, type: issueType, message: details, messageId: message.id });
                        } finally {
                            setIsSubmitting(false);
                            onClose();
                        }
                    }} className="h-8 min-w-20 px-3.5 py-[3px] bg-text-100 rounded-lg flex justify-center items-center gap-2 overflow-hidden hover:bg-text-200 transition-colors">
                        <div className="flex-1 text-center justify-start text-bg-100 text-sm font-medium font-styrene leading-tight">{isSubmitting ? 'Submitting...' : 'Submit'}</div>
                    </button>
                </div>
            </div>
        </div>
    );
}