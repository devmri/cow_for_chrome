// 原始函数: gx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { SystemCommand } from './App';
import SavedPromptsService, { SavedPrompt } from '../../../lib/savedPrompts';
import { cn } from '../../../utils/classNames';

interface SlashCommandMenuProps {
    searchTerm: string;
    onSelect: (item: SavedPrompt) => void;
    onClose: () => void;
    onCreateNew?: () => void;
    systemCommands?: SystemCommand[];
}

export function SlashCommandMenu({ searchTerm, onSelect, onClose, onCreateNew, systemCommands = [] }: SlashCommandMenuProps) {
    const [allPrompts, setAllPrompts] = useState<SavedPrompt[]>([]);
    const [filteredPrompts, setFilteredPrompts] = useState<SavedPrompt[]>([]);
    const [filteredSystemCommands, setFilteredSystemCommands] = useState<SystemCommand[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleSelect = useCallback(async (prompt: SavedPrompt) => {
        await SavedPromptsService.recordPromptUsage(prompt.id!);
        onSelect(prompt);
    }, [onSelect]);

    useEffect(() => {
        (async () => {
            const prompts = await SavedPromptsService.getAllPrompts();
            setAllPrompts(prompts.sort((a, b) =>
                (b.usageCount ?? 0) !== (a.usageCount ?? 0)
                    ? (b.usageCount ?? 0) - (a.usageCount ?? 0)
                    : (b.createdAt ?? 0) - (a.createdAt ?? 0)
            ));
        })();
    }, []);

    useEffect(() => {
        const lowerSearch = searchTerm.toLowerCase().trim();
        if (lowerSearch) {
            const filtered = allPrompts.filter(p => {
                if (p.command) {
                    const lowerCommand = p.command.toLowerCase();
                    if (lowerCommand.startsWith(lowerSearch)) return true;
                    const parts = lowerCommand.split('-');
                    for (let i = 1; i < parts.length; i++) {
                        if (parts[i].startsWith(lowerSearch)) return true;
                    }
                }
                return false;
            });
            const filteredSys = systemCommands.filter(c => {
                const lowerCommand = c.command.toLowerCase();
                if (lowerCommand.startsWith(lowerSearch)) return true;
                 const parts = lowerCommand.split('-');
                 for (let i = 1; i < parts.length; i++) {
                    if (parts[i].startsWith(lowerSearch)) return true;
                }
                return false;
            });
            setFilteredPrompts(filtered);
            setFilteredSystemCommands(filteredSys);
        } else {
            setFilteredPrompts(allPrompts);
            setFilteredSystemCommands(systemCommands);
        }
        setActiveIndex(0);
    }, [searchTerm, allPrompts, systemCommands]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const createNewCount = onCreateNew ? 1 : 0;
            const totalItems = filteredSystemCommands.length + filteredPrompts.length + createNewCount;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const sysLen = filteredSystemCommands.length;
                const promptLen = filteredPrompts.length;
                if (activeIndex < sysLen) {
                    filteredSystemCommands[activeIndex].execute();
                    onClose();
                } else if (activeIndex < sysLen + promptLen) {
                    handleSelect(filteredPrompts[activeIndex - sysLen]);
                } else if (onCreateNew && activeIndex === sysLen + promptLen) {
                    onCreateNew();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredSystemCommands, filteredPrompts, activeIndex, onClose, handleSelect, onCreateNew]);
    
    const hasItems = filteredSystemCommands.length > 0 || filteredPrompts.length > 0 || Boolean(onCreateNew);

    if (!hasItems) {
        return (
            <div ref={menuRef} className="absolute z-50 bg-bg-000 border-[0.5px] border-border-300 rounded-xl shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] p-2 w-full" style={{ bottom: 'calc(100% + 8px)', left: 0 }}>
                <div className="text-text-300 font-base">
                    {searchTerm ? `No shortcuts found for "/${searchTerm}"` : 'No shortcuts available'}
                </div>
            </div>
        );
    }
    
    return (
        <div ref={menuRef} className="absolute z-50 bg-bg-000 border-[0.5px] border-border-300 rounded-xl shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] p-1.5 w-full max-h-[300px] overflow-y-auto" style={{ bottom: 'calc(100% + 8px)', left: 0 }}>
            {filteredSystemCommands.map((cmd, index) => (
                <button
                    key={`system-${cmd.command}`}
                    onClick={() => { cmd.execute(); onClose(); }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn('w-full px-2 py-1.5 text-left rounded-lg transition-colors', 'hover:bg-bg-200 hover:text-text-000', activeIndex === index && 'bg-bg-200 text-text-000')}
                >
                    <div className="font-base text-text-300 flex items-center gap-1.5">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><span className="text-text-500/50 font-mono">/</span></div>
                        <span>{cmd.command}</span>
                        {cmd.description && <span className="text-text-400 text-xs ml-auto">{cmd.description}</span>}
                    </div>
                </button>
            ))}
            
            {filteredSystemCommands.length > 0 && filteredPrompts.length > 0 && <div className="my-1.5 border-t-[0.5px] border-border-300" />}

            {filteredPrompts.map((prompt, index) => {
                const itemIndex = filteredSystemCommands.length + index;
                return (
                    <button
                        key={prompt.id}
                        onClick={() => handleSelect(prompt)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        className={cn('w-full px-2 py-1.5 text-left rounded-lg transition-colors', 'hover:bg-bg-200 hover:text-text-000', activeIndex === itemIndex && 'bg-bg-200 text-text-000')}
                    >
                        <div className="font-base text-text-300 flex items-center gap-1.5">
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><span className="text-text-500/50 font-mono">/</span></div>
                            <span>{prompt.command || 'untitled'}</span>
                        </div>
                    </button>
                );
            })}
            
            {onCreateNew && (
                <>
                    {(filteredSystemCommands.length > 0 || filteredPrompts.length > 0) && <div className="my-1.5 border-t-[0.5px] border-border-300" />}
                    <button
                        onClick={onCreateNew}
                        onMouseEnter={() => setActiveIndex(filteredSystemCommands.length + filteredPrompts.length)}
                        className={cn('w-full px-2 py-1.5 text-left rounded-lg transition-colors flex items-center gap-1.5', 'hover:bg-bg-200 hover:text-text-000', activeIndex === filteredSystemCommands.length + filteredPrompts.length && 'bg-bg-200 text-text-000')}
                    >
                       <Plus size={16} className="text-text-300 flex-shrink-0" />
                       <span className="font-base text-text-300">Create new shortcut</span>
                    </button>
                </>
            )}
        </div>
    );
}
