import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessHours, useUpdateBusinessHours } from '../../../lib/hooks';

const hourOptions = Array.from({ length: 49 }, (_, i) => i * 0.5);
const formatHour = (h: number) => {
    const hh = Math.floor(h);
    const mm = h % 1 === 0.5 ? '30' : '00';
    return `${String(hh).padStart(2, '0')}:${mm}`;
};
const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土', '祝日'];

const BusinessHoursSection = () => {
    const { data: businessHours, isLoading: isLoadingHours } = useBusinessHours();
    const updateBusinessHoursMutation = useUpdateBusinessHours();
    const [startHour, setStartHour] = useState(8);
    const [endHour, setEndHour] = useState(19);
    const [closedDays, setClosedDays] = useState<number[]>([]);
    const [hoursModified, setHoursModified] = useState(false);

    useEffect(() => {
        if (businessHours) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStartHour(businessHours.startHour);
            setEndHour(businessHours.endHour);
            setClosedDays(businessHours.closedDays || []);
            setHoursModified(false);
        }
    }, [businessHours]);

    const handleSaveBusinessHours = async () => {
        if (startHour >= endHour) {
            toast.error('開始時間は終了時間より前に設定してください');
            return;
        }
        if (endHour - startHour < 2) {
            toast.error('営業時間は最低2時間必要です');
            return;
        }
        try {
            await updateBusinessHoursMutation.mutateAsync({ startHour, endHour, closedDays });
            toast.success('営業時間・休館日を保存しました');
            setHoursModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">営業時間</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            タイムラインの表示範囲とExcel出力の時間範囲を設定します。
                        </p>
                    </div>
                </div>

                {isLoadingHours ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-slate-400 text-sm animate-pulse">読み込み中...</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
                            <div className="flex items-center gap-3">
                                <label htmlFor="biz-start-hour" className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[60px]">
                                    開始時間
                                </label>
                                <select
                                    id="biz-start-hour"
                                    value={startHour}
                                    onChange={(e) => { setStartHour(parseFloat(e.target.value)); setHoursModified(true); }}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                >
                                    {hourOptions.filter(h => h < 24).map(h => (
                                        <option key={h} value={h}>{formatHour(h)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-slate-400 hidden sm:block">〜</div>
                            <div className="flex items-center gap-3">
                                <label htmlFor="biz-end-hour" className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[60px]">
                                    終了時間
                                </label>
                                <select
                                    id="biz-end-hour"
                                    value={endHour}
                                    onChange={(e) => { setEndHour(parseFloat(e.target.value)); setHoursModified(true); }}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                >
                                    {hourOptions.filter(h => h >= 1).map(h => (
                                        <option key={h} value={h}>{formatHour(h)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {startHour >= endHour && (
                            <p className="text-sm text-red-500 font-medium">
                                ⚠ 開始時間は終了時間より前に設定してください
                            </p>
                        )}
                        {endHour - startHour > 0 && endHour - startHour < 2 && (
                            <p className="text-sm text-red-500 font-medium">
                                ⚠ 営業時間は最低2時間必要です
                            </p>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-3">
                                休館日（定休日）
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((dayName, idx) => {
                                    const isClosed = closedDays.includes(idx);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setClosedDays(prev =>
                                                    prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                                                );
                                                setHoursModified(true);
                                            }}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                                isClosed
                                                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/40 dark:border-red-800 dark:text-red-400'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            {dayName}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                選択した曜日は自動でスケジュールから除外されます。
                            </p>
                        </div>

                        {hoursModified && (
                            <div className="flex justify-end animate-in slide-in-from-bottom-2 pt-2">
                                <button
                                    onClick={handleSaveBusinessHours}
                                    disabled={updateBusinessHoursMutation.isPending || startHour >= endHour || endHour - startHour < 2}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {updateBusinessHoursMutation.isPending ? (
                                        <span className="animate-pulse">保存中...</span>
                                    ) : (
                                        '営業時間設定を保存'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessHoursSection;
