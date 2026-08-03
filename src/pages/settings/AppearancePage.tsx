import { Palette } from 'lucide-react';
import AppearanceSettings from '../../features/settings/components/AppearanceSettings';

const AppearancePage = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 md:p-8">
                {/* Header */}
                <div className="mb-4 flex items-center space-x-2 sm:mb-6 sm:space-x-3">
                    <Palette className="h-6 w-6 text-indigo-500 sm:h-8 sm:w-8" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">基本設定</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                            アプリケーションの表示テーマやカレンダーの設定を変更します。
                        </p>
                    </div>
                </div>

                <AppearanceSettings />
            </div>
        </div>
    );
};

export default AppearancePage;
