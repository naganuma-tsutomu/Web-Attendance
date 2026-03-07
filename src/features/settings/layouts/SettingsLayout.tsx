import React from 'react';

interface SettingsLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

const SettingsLayout = ({ sidebar, children }: SettingsLayoutProps) => {
    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            {/* Sidebar - Fixed on desktop, scrollable on mobile */}
            <div className="md:fixed md:left-0 md:top-16 md:bottom-0 md:w-64 md:z-10">
                {sidebar}
            </div>

            {/* Main Content - Offset by sidebar width on desktop */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto min-h-[calc(100vh-4rem)]">
                <div className="max-w-4xl mx-auto space-y-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default SettingsLayout;
