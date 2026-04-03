import { useState, useEffect, useMemo } from 'react';
import { Calendar, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { syncHolidays } from '../../lib/api';
import { useStaffList, usePreferencesByMonth, useSavePreference, useUpdatePreferenceSubmitted, useHolidays, useBusinessHours } from '../../lib/hooks';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { saveActiveMonth, loadActiveMonth } from '../../utils/dateUtils';
import { isStaffFixedHoliday } from '../../lib/availabilityUtils';
import { toast } from 'sonner';
import { generateMonthDays } from './utils';
import type { AllPrefsForMonth } from './types';
import SummaryCard from './components/SummaryCard';
import StaffSelector from './components/StaffSelector';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import CalendarFooter from './components/CalendarFooter';
import DateEditModal from './components/DateEditModal';
import SubmitConfirmDialog from './components/SubmitConfirmDialog';

const PreferencesPage = () => {
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState<Date>(() => loadActiveMonth());
    const [preferences, setPreferences] = useState<ReturnType<typeof generateMonthDays>>([]);
    const [syncingHolidays, setSyncingHolidays] = useState(false);
    const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
    const [isEditingModalMode, setIsEditingModalMode] = useState(false);
    const [editStartTime, setEditStartTime] = useState<string>('09:00');
    const [editEndTime, setEditEndTime] = useState<string>('18:00');
    const [confirmSubmit, setConfirmSubmit] = useState<{ submitted: boolean } | null>(null);

    const yearMonth = format(targetDate, 'yyyy-MM');

    const { data: staffList = [], isLoading: staffLoading } = useStaffList();
    const { data: rawPrefs = [], isLoading: prefLoading, isError: prefHasError, refetch: refetchPrefs } = usePreferencesByMonth(yearMonth);
    const { data: holidays = [] } = useHolidays(targetDate.getFullYear());
    const { data: businessHours } = useBusinessHours();
    const closedDays = useMemo(() => businessHours?.closedDays || [], [businessHours]);

    const savePreferenceMutation = useSavePreference();
    const saving = savePreferenceMutation.isPending;

    const updateSubmittedMutation = useUpdatePreferenceSubmitted();
    const updatingSubmitted = updateSubmittedMutation.isPending;

    const prefError = prefHasError ? '希望休データの読み込みに失敗しました。' : null;

    const allPrefsForMonth = useMemo(() => {
        const map: AllPrefsForMonth = {};
        rawPrefs.forEach(p => {
            map[p.staffId] = { details: p.details || [], submitted: p.submitted === true };
        });
        return map;
    }, [rawPrefs]);

    useEffect(() => {
        if (staffList.length > 0 && !selectedStaffId) {
            setSelectedStaffId(staffList[0].id);
        }
    }, [staffList, selectedStaffId]);

    useEffect(() => {
        saveActiveMonth(targetDate);
    }, [targetDate]);

    useEffect(() => {
        const baseDays = generateMonthDays(targetDate, holidays);
        if (selectedStaffId) {
            const staff = staffList.find(s => s.id === selectedStaffId);
            const unavailable = allPrefsForMonth[selectedStaffId]?.details || [];

            setPreferences(baseDays.map(day => {
                let isFixedHoliday = false;
                if (staff) {
                    isFixedHoliday = isStaffFixedHoliday(staff, new Date(day.dateStr), closedDays, !!day.isNationalHoliday);
                }

                if (isFixedHoliday) return { ...day, status: 'fixed' };

                const pref = unavailable.find(u => u.date === day.dateStr);

                return {
                    ...day,
                    status: pref ? 'unavailable' : 'available',
                    startTime: pref?.startTime,
                    endTime: pref?.endTime,
                    type: pref?.type
                };
            }));
        } else {
            setPreferences(baseDays);
        }
    }, [selectedStaffId, targetDate, allPrefsForMonth, staffList, holidays, closedDays]);

    const handleDateClick = (index: number) => {
        const item = preferences[index];
        if (item.status === 'fixed' || item.isHoliday) return;
        setIsEditingModalMode(false);
        setEditingDateIndex(index);
        if (item.startTime && item.endTime) {
            setEditStartTime(item.startTime);
            setEditEndTime(item.endTime);
        } else {
            setEditStartTime('09:00');
            setEditEndTime('18:00');
        }
    };

    const applyDatePreference = (type: 'full' | 'partial' | 'clear' | 'training') => {
        if (editingDateIndex === null) return;
        const newPrefs = [...preferences];
        if (type === 'clear') {
            newPrefs[editingDateIndex].status = 'available';
            newPrefs[editingDateIndex].startTime = null;
            newPrefs[editingDateIndex].endTime = null;
            newPrefs[editingDateIndex].type = null;
        } else if (type === 'full') {
            newPrefs[editingDateIndex].status = 'unavailable';
            newPrefs[editingDateIndex].startTime = null;
            newPrefs[editingDateIndex].endTime = null;
            newPrefs[editingDateIndex].type = null;
        } else if (type === 'training') {
            newPrefs[editingDateIndex].status = 'unavailable';
            newPrefs[editingDateIndex].startTime = null;
            newPrefs[editingDateIndex].endTime = null;
            newPrefs[editingDateIndex].type = 'training';
        } else {
            newPrefs[editingDateIndex].status = 'unavailable';
            newPrefs[editingDateIndex].startTime = editStartTime;
            newPrefs[editingDateIndex].endTime = editEndTime;
            newPrefs[editingDateIndex].type = null;
        }
        setPreferences(newPrefs);
        setEditingDateIndex(null);
    };

    const handleSave = async () => {
        if (!selectedStaffId) return;
        try {
            const details = preferences
                .filter(p => p.status === 'unavailable')
                .map(p => ({ date: p.dateStr, startTime: p.startTime || null, endTime: p.endTime || null, type: p.type || null }));

            await savePreferenceMutation.mutateAsync({ staffId: selectedStaffId, yearMonth, details });
            toast.success('休日設定を保存しました');
        } catch (err) {
            console.error(err);
            const errMsg = err instanceof Error ? err.message : '保存に失敗しました。';
            toast.error(errMsg);
        }
    };

    const handleToggleSubmitted = (submitted: boolean) => {
        if (!selectedStaffId) return;
        setConfirmSubmit({ submitted });
    };

    const handleConfirmSubmitted = async () => {
        if (!selectedStaffId || !confirmSubmit) return;
        const { submitted } = confirmSubmit;
        setConfirmSubmit(null);
        try {
            await updateSubmittedMutation.mutateAsync({ staffId: selectedStaffId, yearMonth, submitted });
            toast.success(submitted ? '提出済みに変更しました' : '未提出に戻しました');
        } catch (err) {
            console.error(err);
            toast.error('提出状態の変更に失敗しました');
        }
    };

    const handleSyncHolidays = async () => {
        setSyncingHolidays(true);
        try {
            const res = await syncHolidays();
            if (res.success) {
                toast.success(`祝日を同期しました（${res.synced}件追加）`);
            }
        } catch (err) {
            console.error(err);
            toast.error('祝日の同期に失敗しました。');
        } finally {
            setSyncingHolidays(false);
        }
    };

    const selectedStaff = staffList.find(s => s.id === selectedStaffId);
    const submittedCount = staffList.filter(s => allPrefsForMonth[s.id]?.submitted === true).length;

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto w-full p-4 sm:p-6 md:p-8">
                {/* ヘッダー */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">休日管理</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">スタッフごとの休日・出勤不可日を入力・管理します</p>
                    </div>
                    {/* 月ナビゲーション */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                        <button
                            onClick={() => setTargetDate(d => subMonths(d, 1))}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-28 text-center">
                            {format(targetDate, 'yyyy年M月', { locale: ja })}
                        </span>
                        <button
                            onClick={() => setTargetDate(d => addMonths(d, 1))}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    {/* 祝日同期ボタン */}
                    <button
                        onClick={handleSyncHolidays}
                        disabled={syncingHolidays}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
                        title="今年と来年の祝日データを最新に更新します"
                    >
                        <RefreshCw className={`w-4 h-4 text-indigo-500 ${syncingHolidays ? 'animate-spin' : ''}`} />
                        <span>{syncingHolidays ? '同期中...' : '祝日を同期'}</span>
                    </button>
                </div>

                <SummaryCard submittedCount={submittedCount} totalCount={staffList.length} />

                <div className="flex flex-col lg:flex-row gap-6">
                    <StaffSelector
                        staffList={staffList}
                        staffLoading={staffLoading}
                        selectedStaffId={selectedStaffId}
                        setSelectedStaffId={setSelectedStaffId}
                        allPrefsForMonth={allPrefsForMonth}
                    />

                    {/* カレンダーエリア */}
                    <div className="flex-1">
                        {!selectedStaffId ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
                                <div className="text-center">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p>スタッフを選択してください</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                <CalendarHeader selectedStaff={selectedStaff} targetDate={targetDate} />


                                {/* エラー */}
                                {prefError && (
                                    <div className="mx-5 mt-4 p-3 rounded-xl flex items-center justify-between gap-2 text-sm font-medium border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" role="alert">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            {prefError}
                                        </div>
                                        <button
                                            onClick={() => refetchPrefs()}
                                            disabled={prefLoading}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                                            aria-label="再試行"
                                        >
                                            {prefLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            再試行
                                        </button>
                                    </div>
                                )}

                                <CalendarGrid
                                    preferences={preferences}
                                    prefLoading={prefLoading}
                                    handleDateClick={handleDateClick}
                                />

                                {editingDateIndex !== null && (
                                    <DateEditModal
                                        editingDateIndex={editingDateIndex}
                                        preferences={preferences}
                                        selectedStaff={selectedStaff}
                                        isEditingModalMode={isEditingModalMode}
                                        setIsEditingModalMode={setIsEditingModalMode}
                                        editStartTime={editStartTime}
                                        editEndTime={editEndTime}
                                        setEditStartTime={setEditStartTime}
                                        setEditEndTime={setEditEndTime}
                                        applyDatePreference={applyDatePreference}
                                        setEditingDateIndex={setEditingDateIndex}
                                    />
                                )}

                                <CalendarFooter
                                    preferences={preferences}
                                    selectedStaffId={selectedStaffId}
                                    allPrefsForMonth={allPrefsForMonth}
                                    handleSave={handleSave}
                                    saving={saving}
                                    prefLoading={prefLoading}
                                    handleToggleSubmitted={handleToggleSubmitted}
                                    updatingSubmitted={updatingSubmitted}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {confirmSubmit && (
                <SubmitConfirmDialog
                    confirmSubmit={confirmSubmit}
                    setConfirmSubmit={setConfirmSubmit}
                    selectedStaff={selectedStaff}
                    targetDate={targetDate}
                    handleConfirmSubmitted={handleConfirmSubmitted}
                    updatingSubmitted={updatingSubmitted}
                />
            )}
        </>
    );
};

export default PreferencesPage;
