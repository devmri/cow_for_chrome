// 原始函数: mx
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Sparkle, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../../utils/classNames';

interface PermissionToggleProps {
    skipAllPermissions: boolean;
    onToggle: (skip: boolean) => void;
    disabled?: boolean;
}

const OPTIONS = [
    { label: "Ask before acting", value: false, icon: <Shield size={12} className="text-text-300" />, description: "Claude asks for permission before every action" },
    { label: "Act without asking", value: true, icon: <Sparkle size={16} className="text-text-300" />, description: "Claude takes actions without asking for permission" }
];

export function PermissionToggle({ skipAllPermissions, onToggle, disabled = false }: PermissionToggleProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const currentLabel = skipAllPermissions ? "Act without asking" : "Ask before acting";

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="flex items-center gap-1 pl-1 pr-1 py-1.5 text-sm text-text-200 hover:bg-bg-200 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Toggle permission mode"
            >
                <div className="w-4 h-4 flex items-center justify-center">
                    {skipAllPermissions ? <Sparkle size={16} className="text-text-300" /> : <Shield size={12} className="text-text-300" />}
                </div>
                <span className="font-small">{currentLabel}</span>
                <ChevronDown size={12} className="text-text-400" />
            </button>
            {isOpen && (
                <div className="absolute z-50 bg-bg-000 border-[0.5px] border-border-300 rounded-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] p-1.5 w-[240px]" style={{ bottom: 'calc(100% + 8px)', left: 0 }}>
                    {OPTIONS.map(option => (
                        <button
                            key={option.label}
                            onClick={() => { onToggle(option.value); setIsOpen(false); }}
                            className={cn('w-full px-2 py-2 text-left rounded-lg transition-colors', 'hover:bg-bg-200')}
                        >
                            <div className="flex items-start gap-2">
                                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">{option.icon}</div>
                                <div className="flex-1">
                                    <div className="font-base text-text-200">{option.label}</div>
                                    <div className="font-small text-text-400 mt-0.5">{option.description}</div>
                                </div>
                                {skipAllPermissions === option.value && <Check size={16} className="text-accent-secondary-100 flex-shrink-0 mt-0.5" />}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}