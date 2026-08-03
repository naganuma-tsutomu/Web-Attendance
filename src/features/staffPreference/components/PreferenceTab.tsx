import React, { useState, useMemo } from 'react';
import { format, getDay, startOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, Loader2 } from 'lucide-react';
import { savePreference } from '../../../lib/api';
import { CLOSED_DAY_HOLIDAY } from '../../../constants';
import { isFixedHoliday as checkFixedHoliday } from '../../../lib/holidayUtils';
import { createBusinessDayOverrideMap, resolveBusinessDay } from '../../../lib/businessDayUtils';
import type { ShiftPreferenceDetail, Shift, Holiday, BusinessDayOverride } from '../../../types';

interface PreferenceTabProps {
    staff: { id: string; name: string };
    currentMonth: Date;
    days: Date[];
    preferences: ShiftPreferenceDetail[];
    setPreferences: React.Dispatch<React.SetStateAction<ShiftPreferenceDetail[]>>;
    savedPreferences: ShiftPreferenceDetail[];
    setSavedPreferences: React.Dispatch<React.SetStateAction<ShiftPreferenceDetail[]>>;
    setMessage: (msg: { type: 'success' | 'error', text: string } | null) => void;
    myShifts: Shift[];
    holidays: Holiday[];
    businessDayOverrides: BusinessDayOverride[];
    myAvailableDays: any;
    closedDays: number[];
}

export default function PreferenceTab({
    staff,
    currentMonth,
    days,
    preferences,
    setPreferences,
    savedPreferences,
    setSavedPreferences,
    setMessage,
    myShifts,
    holidays,
    businessDayOverrides,
    myAvailableDays,
    closedDays
}: PreferenceTabProps) {
    const [saving, setSaving] = useState(false);
    const [selectedDateAction, setSelectedDateAction] = useState<string | null>(null);
    const [selectedStartTime, setSelectedStartTime] = useState<string>('09:00');
    const [selectedEndTime, setSelectedEndTime] = useState<string>('18:00');
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const hasChanges = useMemo(() => JSON.stringify(
        [...preferences].sort((a, b) => a.date.localeCompare(b.date))
    ) !== JSON.stringify(
        [...savedPreferences].sort((a, b) => a.date.localeCompare(b.date))
    ), [preferences, savedPreferences]);

    const overrideMap = useMemo(() => createBusinessDayOverrideMap(businessDayOverrides), [businessDayOverrides]);
    const isFixedHoliday = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const override = overrideMap.get(dateStr);
        const holiday = holidays.find(item => item.date === dateStr);
        const facility = resolveBusinessDay({ date, dateStr, closedDays, holiday, override });
        if (!facility.isOpen) return true;
        const effectiveClosedDays = override?.status === 'open'
            ? closedDays.filter(day => day !== getDay(date) && day !== CLOSED_DAY_HOLIDAY)
            : closedDays;
        return checkFixedHoliday(date, holidays, effectiveClosedDays, CLOSED_DAY_HOLIDAY, myAvailableDays);
    };

    const handleDateClick = (dateStr: string) => {
        const existing = preferences.find(p => p.date === dateStr);
        if (existing && existing.type === 'training') {
            return; // 研修の日は編集不可
        }
        setSelectedDateAction(dateStr);
        if (existing && existing.startTime && existing.endTime) {
            setSelectedStartTime(existing.startTime);
            setSelectedEndTime(existing.endTime);
        } else {
            setSelectedStartTime('09:00');
            setSelectedEndTime('18:00');
        }
    };

    const applyPreference = (type: 'full' | 'partial' | 'clear') => {
        if (!selectedDateAction) return;
        setPreferences(prev => {
            const filtered = prev.filter(p => p.date !== selectedDateAction);
            if (type === 'clear') return filtered;
            if (type === 'full') {
                return [...filtered, { date: selectedDateAction, startTime: null, endTime: null }];
            }
            return [...filtered, { date: selectedDateAction, startTime: selectedStartTime, endTime: selectedEndTime }];
        });
        setSelectedDateAction(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await savePreference({
                staffId: staff.id,
                yearMonth: format(currentMonth, 'yyyy-MM'),
                submitted: true,
                details: preferences
            });
            setSavedPreferences(preferences);
            setMessage({ type: 'success', text: '休暇希望を保存しました' });
            setTimeout(() => setMessage(null), 3000);
        } catch {
            setMessage({ type: 'error', text: '保存に失敗しました' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="font-black text-slate-800 dark:text-white tracking-tight flex items-center space-x-2">
                        <span>休暇希望</span>
                        <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase">Tap to Select</span>
                    </h2>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <div key={d} className={`text-center text-[10px] sm:text-xs font-black uppercase tracking-widest pb-2 ${
                                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                            }`}>
                                {d}
                            </div>
                        ))}
                        {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const pref = preferences.find(p => p.date === dateStr);
                            const isSelected = !!pref;
                            const isTraining = pref && pref.type === 'training';
                            const isPartial = pref && pref.startTime && pref.endTime && !isTraining;
                            const hasShift = myShifts.some(s => s.date === dateStr);
                            const isSunday = getDay(day) === 0;
                            const override = overrideMap.get(dateStr);
                            const fixedHoliday = isFixedHoliday(day);
                            const holidayData = holidays.find(h => h.date === dateStr);
                            const isNationalHoliday = !!holidayData && !holidayData.isWorkday;
                            const closedLabel = override?.status === 'closed'
                                ? override.name
                                : isNationalHoliday
                                    ? (holidayData?.name || '祝日')
                                    : isSunday
                                        ? '休日'
                                        : '固定休';

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => !fixedHoliday && handleDateClick(dateStr)}
                                    disabled={fixedHoliday}
                                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1 transition-all relative border-2 ${
                                        fixedHoliday
                                            ? isNationalHoliday
                                                ? 'bg-red-50/50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 cursor-not-allowed'
                                                : isSunday
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-300 dark:text-red-700 cursor-not-allowed'
                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                            : isTraining
                                                ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-600 dark:text-amber-400 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600 dark:text-red-400'
                                                    : isNationalHoliday
                                                        ? 'bg-white dark:bg-slate-900 border-red-200 hover:border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
                                                        : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <span className="text-sm font-black">{format(day, 'd')}</span>
                                    {fixedHoliday && (
                                        <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1">{closedLabel}</span>
                                    )}
                                    {!fixedHoliday && isNationalHoliday && !isSelected && (
                                        <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1">{holidayData?.name || '祝日'}</span>
                                    )}
                                    {!fixedHoliday && hasShift && !isSelected && (
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-0.5" />
                                    )}
                                    {!fixedHoliday && isSelected && (
                                        <span className="text-[8px] font-bold mt-0.5 uppercase">
                                            {isTraining ? '研修' : isPartial ? '部分休' : '休'}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 w-full">
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={saving || !hasChanges}
                            className="flex-1 sm:flex-none px-2 sm:px-8 py-3.5 sm:py-4 bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-2xl transition-all font-black uppercase tracking-widest flex items-center justify-center text-[11px] sm:text-base whitespace-nowrap"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="flex-1 sm:flex-none px-2 sm:px-8 py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-2xl shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all font-black uppercase tracking-widest flex items-center justify-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-base whitespace-nowrap"
                        >
                            {saving ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <span>希望を保存</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Partial Selection Modal */}
            {selectedDateAction && (
                <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDateAction(null); }}>
                    <div role="dialog" aria-modal="true" className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-base font-black text-slate-800 dark:text-white">
                                {format(new Date(selectedDateAction), 'M月d日 (E)', { locale: ja })} の希望
                            </h3>
                            <button onClick={() => setSelectedDateAction(null)} aria-label="閉じる" className="bg-white dark:bg-slate-700 p-1.5 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <button
                                onClick={() => applyPreference('full')}
                                className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50 flex items-center justify-center gap-2"
                            >
                                <span>終日お休み</span>
                                <span className="text-xs font-medium opacity-70">1日中働くことができません</span>
                            </button>

                            <div className="p-3 bg-indigo-50 hover:bg-indigo-100/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl transition-colors">
                                <div className="text-center font-bold text-indigo-700 dark:text-indigo-400 mb-2 text-sm">一部の時間だけ不可</div>
                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-3">
                                    <input
                                        type="time"
                                        value={selectedStartTime}
                                        onChange={e => setSelectedStartTime(e.target.value)}
                                        className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-base text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="font-bold text-slate-400 text-xs shrink-0">〜</span>
                                    <input
                                        type="time"
                                        value={selectedEndTime}
                                        onChange={e => setSelectedEndTime(e.target.value)}
                                        className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-base text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => applyPreference('partial')}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                                >
                                    この時間帯を不可にする
                                </button>
                            </div>

                            <button
                                onClick={() => applyPreference('clear')}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                            >
                                就業可能（クリア）
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowCancelConfirm(false); }}>
                    <div role="dialog" aria-modal="true" className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-base font-black text-slate-800 dark:text-white">変更を破棄しますか？</h3>
                            <button onClick={() => setShowCancelConfirm(false)} aria-label="閉じる" className="bg-white dark:bg-slate-700 p-1.5 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 text-center">保存していない変更はすべて元に戻ります。</p>
                            <button
                                onClick={() => { setPreferences(savedPreferences); setShowCancelConfirm(false); }}
                                className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50"
                            >
                                破棄する
                            </button>
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                            >
                                戻る
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
