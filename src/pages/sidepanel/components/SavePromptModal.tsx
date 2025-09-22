import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import SavedPromptsService, { SavedPrompt } from '../../../lib/savedPrompts';
import { Input } from '../../../components/Input';
import { Textarea } from '../../../components/Textarea';
import { Button } from '../../../components/Button';

interface SavePromptModalProps {
    prompt: string | Partial<SavedPrompt>;
    onClose: () => void;
    onSave: (command: string) => void;
}

export function SavePromptModal({ prompt, onClose, onSave }: SavePromptModalProps) {
    const initialPrompt = typeof prompt === 'string' ? prompt : prompt.prompt || '';
    const initialCommand = typeof prompt === 'string' ? '' : prompt.command || '';

    const [command, setCommand] = useState(initialCommand);
    const [promptText, setPromptText] = useState(initialPrompt);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isRendered, setIsRendered] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    
    const commandInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => {
            setIsRendered(true);
            commandInputRef.current?.focus();
        }, 10);
    }, []);

    const handleClose = () => {
        setIsClosing(true);
        setIsRendered(false);
        setTimeout(() => {
            onClose();
        }, 200);
    };

    const handleSave = async () => {
        setIsSaving(true);
        if (command.trim() && promptText.trim()) {
            setError('');
            try {
                await SavedPromptsService.savePrompt({
                    prompt: promptText.trim(),
                    command: command.trim(),
                    createdAt: Date.now(),
                    usageCount: 0,
                });
                onSave(command.trim());
                handleClose();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to save prompt');
                setIsSaving(false);
            }
        } else {
          // A check to set the error if fields are empty, but the original code seems to rely on the `required` prop visually.
          // This is added for completeness, but `hasSubmitted` is a better pattern.
           if(!command.trim()) setError('Name is required');
           else if(!promptText.trim()) setError('Prompt is required');
        }
    };
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Enter') {
                const activeEl = document.activeElement;
                if(activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA' && !isSaving) {
                    e.preventDefault();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [command, promptText, isSaving]);


    return (
        <>
            <div
                className={`fixed inset-0 z-40 transition-opacity duration-200 ${isRendered && !isClosing ? 'bg-black/20' : 'bg-black/0'}`}
                onClick={handleClose}
            />
            <div
                className={`fixed bottom-0 left-0 right-0 z-50 bg-bg-000 border-t-[0.5px] border-border-300 rounded-t-2xl shadow-xl transition-transform duration-200 ease-out ${isRendered && !isClosing ? 'translate-y-0' : 'translate-y-full'}`}
            >
                <div className="px-4 pb-4 pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-large-bold text-text-000">Create shortcut</h3>
                        <button onClick={handleClose} className="p-1 hover:bg-bg-200 rounded transition-colors" aria-label="Close">
                            <X size={16} className="text-text-300" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <Input
                            ref={commandInputRef}
                            label="Name"
                            type="text"
                            value={command}
                            onChange={(e) => {
                                const sanitized = e.target.value.replace(/\s/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
                                setCommand(sanitized);
                                if (error) setError('');
                            }}
                            prepend={<span className="text-text-300">/</span>}
                            placeholder="e.g., summarize"
                            error={error.includes("already in use") ? error : (isSaving && !command.trim() ? "Name is required" : undefined)}
                        />
                        <Textarea
                            label="Prompt"
                            required
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            className="min-h-32 max-h-64 overflow-y-auto"
                            placeholder="Enter your prompt text..."
                            error={isSaving && !promptText.trim() ? "Prompt is required" : undefined}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={handleClose} variant="ghost">Cancel</Button>
                        <Button onClick={handleSave} loading={isSaving}>Create shortcut</Button>
                    </div>
                </div>
            </div>
        </>
    );
}