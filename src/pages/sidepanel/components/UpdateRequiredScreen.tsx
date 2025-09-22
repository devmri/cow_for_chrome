import React from 'react';
import { CircleAlert } from 'lucide-react';

interface UpdateRequiredScreenProps {
    currentVersion: string;
    minSupportedVersion: string;
}

export function UpdateRequiredScreen({ currentVersion, minSupportedVersion }: UpdateRequiredScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bg-100 p-4">
            <div className="max-w-md w-full">
                <div className="bg-bg-000 rounded-xl shadow-sm border border-border-200 p-6">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-danger-900 rounded-full flex items-center justify-center mb-3">
                            <CircleAlert className="w-6 h-6 text-danger-200" />
                        </div>
                        <h2 className="font-xl-bold text-text-100 mb-2">Extension Update Required</h2>
                        <p className="font-base-sm text-text-300 mb-4">
                            Your extension version ({currentVersion}) is no longer supported. Please update to version {minSupportedVersion} or later to continue using Cow.
                        </p>
                        <button
                            onClick={() => { chrome.runtime.reload(); }}
                            className="w-full px-4 py-2 bg-accent-main-200 text-oncolor-100 font-button-lg rounded-lg hover:bg-accent-main-100 transition-colors"
                        >
                            Update Extension
                        </button>
                        <p className="font-caption text-text-400 mt-3">
                            Clicking the button will reload the extension to apply any pending updates.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}