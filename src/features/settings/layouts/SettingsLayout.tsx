import React from 'react';

interface SettingsLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

const SettingsLayout = ({ sidebar, children }: SettingsLayoutProps) => {
    return (
        <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            {/* Sidebar */}
            {sidebar}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default SettingsLayout;
