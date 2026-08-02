import { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    useBusinessDayOverrides, useBusinessHours, useCreateBusinessDayOverride,
    useDeleteBusinessDayOverride, useUpdateBusinessDayOverride,
    useHolidays,
} from '../../../lib/hooks';
import { resolveBusinessDay } from '../../../lib/businessDayUtils';
import type { BusinessDayOverride } from '../../../types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const BusinessDayOverridesSection = () => {
    const [month, setMonth] = useState(() => startOfMonth(new Date()));
    const yearMonth = format(month, 'yyyy-MM');
    const { data: overrides = [], isLoading: isLoadingOverrides } = useBusinessDayOverrides(yearMonth);
    const { data: businessHours, isLoading: isLoadingBusinessHours } = useBusinessHours();
    const { data: holidays = [], isLoading: isLoadingHolidays } = useHolidays(month.getFullYear());
    const createMutation = useCreateBusinessDayOverride();
    const updateMutation = useUpdateBusinessDayOverride();
    const deleteMutation = useDeleteBusinessDayOverride();
    const [selectedDate, setSelectedDate] = useState('');
    const [status, setStatus] = useState<'open' | 'closed'>('closed');
    const [name, setName] = useState('');

    const overrideMap = useMemo(() => new Map(overrides.map(item => [item.date, item])), [overrides]);
    const holidayMap = useMemo(() => new Map(holidays.map(item => [item.date, item])), [holidays]);
    const closedDays = businessHours?.closedDays ?? [];
    const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);
    const selected = selectedDate ? overrideMap.get(selectedDate) : undefined;
    const saving = createMutation.isPending || updateMutation.isPending;
    const isLoading = isLoadingOverrides || isLoadingBusinessHours || isLoadingHolidays;

    const selectDate = (date: string) => {
        const item = overrideMap.get(date);
        const day = new Date(`${date}T00:00:00`);
        const current = resolveBusinessDay({
            date: day,
            dateStr: date,
            closedDays,
            holiday: holidayMap.get(date),
            override: item,
        });
        setSelectedDate(date);
        // 未設定の日は、現在の営業状態を反転する選択肢を初期値にする。
        setStatus(item?.status ?? (current.isOpen ? 'closed' : 'open'));
        setName(item?.name ?? '');
    };

    const save = async () => {
        if (!selectedDate || !name.trim()) {
            toast.error('日付と名称を入力してください');
            return;
        }
        try {
            if (selected) {
                await updateMutation.mutateAsync({ id: selected.id, data: { status, name: name.trim() }, yearMonth });
            } else {
                await createMutation.mutateAsync({ date: selectedDate, status, name: name.trim() });
            }
            toast.success('個別営業日・休業日を保存しました');
        } catch (error) {
            console.error(error);
            toast.error('個別設定の保存に失敗しました');
        }
    };

    const remove = async (item: BusinessDayOverride) => {
        if (!window.confirm(`${item.date}「${item.name}」の個別設定を削除しますか？`)) return;
        try {
            await deleteMutation.mutateAsync({ id: item.id, yearMonth });
            if (selectedDate === item.date) { setSelectedDate(''); setName(''); }
            toast.success('個別設定を削除しました');
        } catch (error) {
            console.error(error);
            toast.error('個別設定の削除に失敗しました');
        }
    };

    return (
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 space-y-5">
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">個別営業日・休業日</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">祝日や固定休館日より優先する、日付ごとの営業状態を設定します。</p>
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto">
                <button type="button" aria-label="前月" onClick={() => { setMonth(subMonths(month, 1)); setSelectedDate(''); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5" /></button>
                <span className="font-bold text-slate-700 dark:text-slate-200">{format(month, 'yyyy年 M月')}</span>
                <button type="button" aria-label="翌月" onClick={() => { setMonth(addMonths(month, 1)); setSelectedDate(''); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight className="w-5 h-5" /></button>
            </div>

            <div className="max-w-md mx-auto">
                <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-1">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getDay(days[0]) }, (_, i) => <span key={`blank-${i}`} />)}
                    {days.map(day => {
                        const date = format(day, 'yyyy-MM-dd');
                        const item = overrideMap.get(date);
                        const holiday = holidayMap.get(date);
                        const isNationalHoliday = !!holiday && !holiday.isWorkday;
                        const current = resolveBusinessDay({ date: day, dateStr: date, closedDays, holiday, override: item });
                        const active = selectedDate === date;
                        const stateLabel = item
                            ? `個別${current.isOpen ? '営業' : '休業'}: ${item.name}`
                            : isNationalHoliday
                                ? `祝日（${current.isOpen ? '営業' : '休業'}）: ${holiday.name}`
                                : current.reason === 'weekly_closed'
                                    ? '固定休館日'
                                    : '営業日';
                        return (
                            <button key={date} type="button" onClick={() => selectDate(date)} title={stateLabel}
                                aria-label={`${format(day, 'M月d日')} ${stateLabel}`}
                                className={`aspect-square rounded-lg text-sm border transition-colors flex flex-col items-center justify-center ${active ? 'ring-2 ring-indigo-500' : ''} ${item?.status === 'open' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : item?.status === 'closed' ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:text-red-200' : isNationalHoliday && !current.isOpen ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300' : current.reason === 'weekly_closed' ? 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-900/60 dark:border-slate-600 dark:text-slate-400' : isNationalHoliday ? 'border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/20' : 'border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                                <span>{format(day, 'd')}</span>
                                {item && <span className="text-[8px] font-bold leading-none mt-0.5">個別</span>}
                                {!item && isNationalHoliday && <span className="text-[8px] font-bold leading-none mt-0.5">祝日</span>}
                                {!item && !isNationalHoliday && current.reason === 'weekly_closed' && <span className="text-[8px] font-bold leading-none mt-0.5">休館</span>}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-600 mr-1" />固定休館日</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-red-300 bg-red-50 dark:bg-red-900 mr-1" />祝日</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-800 mr-1" />個別営業</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-300 dark:bg-red-700 mr-1" />個別休業</span>
                </div>
            </div>

            {selectedDate && (
                <div className="max-w-xl mx-auto grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">営業状態
                        <select value={status} onChange={e => setStatus(e.target.value as 'open' | 'closed')} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2">
                            <option value="closed">個別に休業</option><option value="open">個別に営業</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">名称・理由
                        <input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="例：夏季休業" className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2" />
                    </label>
                    <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50">{saving ? '保存中' : '保存'}</button>
                </div>
            )}

            <div className="space-y-2">
                {isLoading && <p className="text-sm text-slate-400">読み込み中...</p>}
                {!isLoading && overrides.length === 0 && <p className="text-sm text-slate-400">この月の個別設定はありません。</p>}
                {overrides.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div><span className="font-mono text-sm">{item.date}</span><span className={`ml-3 text-xs font-bold ${item.status === 'open' ? 'text-emerald-600' : 'text-red-600'}`}>{item.status === 'open' ? '営業' : '休業'}</span><span className="ml-3 text-sm text-slate-600 dark:text-slate-300">{item.name}</span></div>
                        <button type="button" aria-label={`${item.name}を削除`} onClick={() => remove(item)} disabled={deleteMutation.isPending} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default BusinessDayOverridesSection;
