import { FileSpreadsheet } from 'lucide-react';
import ExcelSettings from '../../features/settings/components/ExcelSettings';

const ExcelSettingsPage = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-4 flex items-center space-x-2 sm:mb-6 sm:space-x-3">
          <FileSpreadsheet className="h-6 w-6 text-indigo-500 sm:h-8 sm:w-8" />
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">Excel出力設定</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
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
