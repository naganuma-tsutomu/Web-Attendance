import { FileSpreadsheet } from 'lucide-react';
import ExcelSettings from '../../features/settings/components/ExcelSettings';

const ExcelSettingsPage = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Excel出力設定</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Excel形式でシフト表を出力する際の外観や表示ルールを詳細に設定できます。
            </p>
          </div>
        </div>

        <ExcelSettings />
      </div>
    </div>
  );
};

export default ExcelSettingsPage;
