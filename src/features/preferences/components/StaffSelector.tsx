import type { Staff } from '../../../types';
import type { AllPrefsForMonth } from '../types';

interface StaffSelectorProps {
    staffList: Staff[];
    staffLoading: boolean;
    selectedStaffId: string | null;
    setSelectedStaffId: (id: string) => void;
    allPrefsForMonth: AllPrefsForMonth;
}

const StaffSelector = ({ staffList, staffLoading, selectedStaffId, setSelectedStaffId, allPrefsForMonth }: StaffSelectorProps) => (
    <>
        {/* デスクトップ用サイドバー */}
        <div className="hidden lg:block lg:w-56 flex-shrink-0">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">スタッフ選択</p>
                </div>
                {staffLoading ? (
                    <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">読み込み中...</div>
                ) : (
                    <ul className="p-2 space-y-1">
                        {staffList.map(staff => {
                            const isSelected = staff.id === selectedStaffId;
                            const hasSubmitted = allPrefsForMonth[staff.id]?.submitted === true;
                            return (
                                <li key={staff.id}>
                                    <button
                                        onClick={() => setSelectedStaffId(staff.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-sm font-medium flex items-center justify-between gap-2 ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                    >
                                        <span className="truncate">{staff.name}</span>
                                        {hasSubmitted
                                            ? <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="提出済み" />
                                            : <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" title="未提出" />
                                        }
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            {/* 凡例 */}
            <div className="mt-3 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />提出済み</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 inline-block" />未提出</div>
            </div>
        </div>

        {/* モバイル用ドロップダウン */}
        <div className="lg:hidden">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
                <label htmlFor="staff-select" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    スタッフ選択
                </label>
                {staffLoading ? (
                    <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">読み込み中...</div>
                ) : (
                    <select
                        id="staff-select"
                        value={selectedStaffId || ''}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.5rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '2.5rem'
                        }}
                    >
                        {staffList.map(staff => {
                            const hasSubmitted = allPrefsForMonth[staff.id]?.submitted === true;
                            return (
                                <option key={staff.id} value={staff.id}>
                                    {staff.name} {hasSubmitted ? '✓' : ''}
                                </option>
                            );
                        })}
                    </select>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <span className="text-emerald-500">✓</span>
                        <span>提出済み</span>
                    </div>
                </div>
            </div>
        </div>
    </>
);

export default StaffSelector;
