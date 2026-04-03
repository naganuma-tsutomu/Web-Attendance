import { Palette } from 'lucide-react';
import AppearanceSettings from '../../features/settings/components/AppearanceSettings';

const AppearancePage = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6">
                    <Palette className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">基本設定</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
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
