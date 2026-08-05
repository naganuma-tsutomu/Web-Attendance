import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Loader2, Users, Settings as SettingsIcon, Clock } from 'lucide-react';
import { getShiftsByMonth, getPreferencesByMonth, getStaffList, getClasses, getTimePatterns, getRoles, getHolidays, getBusinessHours, getBusinessDayOverrides } from '../lib/api';
import { QUERY_KEYS } from '../lib/hooks';
import type { ShiftPreferenceDetail } from '../types';

import { useStaffSession } from '../features/staffPreference/hooks/useStaffSession';
import PreferenceTab from '../features/staffPreference/components/PreferenceTab';
import ShiftViewTab from '../features/staffPreference/components/ShiftViewTab';
import StaffSettingsTab from '../features/staffPreference/components/StaffSettingsTab';

type TabType = 'preference' | 'shifts' | 'settings';

const StaffPreferencePage = () => {
    const navigate = useNavigate();
    const { staff } = useStaffSession();
    
    const [activeTab, setActiveTab] = useState<TabType>('preference');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [preferences, setPreferences] = useState<ShiftPreferenceDetail[]>([]);
    const [savedPreferences, setSavedPreferences] = useState<ShiftPreferenceDetail[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const monthStr = format(currentMonth, 'yyyy-MM');
    const currentYear = currentMonth.getFullYear();

    // ── 静的データ ──
    const { data: staffList = [], isLoading: staffListLoading, isError: staffListHasError, refetch: refetchStaffList } = useQuery({
        queryKey: QUERY_KEYS.staffs,
        queryFn: getStaffList,
        enabled: !!staff,
    });
    const { data: classes = [] } = useQuery({
        queryKey: QUERY_KEYS.classes,
        queryFn: getClasses,
        enabled: !!staff,
    });
    const { data: timePatterns = [] } = useQuery({
        queryKey: QUERY_KEYS.timePatterns,
        queryFn: getTimePatterns,
        enabled: !!staff,
    });
    const { data: roles = [] } = useQuery({
        queryKey: QUERY_KEYS.roles,
        queryFn: getRoles,
        enabled: !!staff,
    });
    const { data: businessHours, isLoading: businessHoursLoading, isError: businessHoursHasError, refetch: refetchBusinessHours } = useQuery({
        queryKey: QUERY_KEYS.businessHours,
        queryFn: getBusinessHours,
        enabled: !!staff,
        staleTime: 30 * 60 * 1000,
    });
    const closedDays = businessHours?.closedDays ?? [];

    // ── 月依存データ ──
    const { data: allShifts = [], isLoading: shiftsLoading } = useQuery({
        queryKey: QUERY_KEYS.shifts(monthStr),
        queryFn: () => getShiftsByMonth(monthStr),
        select: data => data.shifts,
        enabled: !!staff,
    });
    const { data: holidays = [], isLoading: holidaysLoading, isError: holidaysHasError, refetch: refetchHolidays } = useQuery({
        queryKey: QUERY_KEYS.holidays(currentYear),
        queryFn: () => getHolidays(currentYear),
        enabled: !!staff,
        staleTime: 24 * 60 * 60 * 1000,
    });
    const { data: businessDayOverrides = [], isLoading: overridesLoading, isError: overridesHasError, refetch: refetchOverrides } = useQuery({
        queryKey: QUERY_KEYS.businessDayOverrides(monthStr),
        queryFn: () => getBusinessDayOverrides(monthStr),
        enabled: !!staff,
    });
    const { data: prefsData, isLoading: prefsLoading, isError: prefsHasError, refetch: refetchPreferences } = useQuery({
        queryKey: QUERY_KEYS.preferences(monthStr),
        queryFn: () => getPreferencesByMonth(monthStr),
        enabled: !!staff,
    });

    const loading = shiftsLoading || prefsLoading || staffListLoading || businessHoursLoading || holidaysLoading || overridesLoading;
    const preferenceDataError = prefsHasError || staffListHasError || businessHoursHasError || holidaysHasError || overridesHasError;

    const retryPreferenceData = () => {
        refetchPreferences();
        refetchStaffList();
        refetchBusinessHours();
        refetchHolidays();
        refetchOverrides();
    };

    // ── 自分の希望休を同期 ──
    useEffect(() => {
        if (!staff || !prefsData) return;
        const myPref = prefsData.find(p => p.staffId === staff.id);
        const details = myPref?.details || [];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreferences(details);
        setSavedPreferences(details);
    }, [prefsData, staff]);

    const handleLogout = async () => {
        await fetch('/api/auth/staff-logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(e => console.warn('Logout failed', e));
        navigate('/staff/login');
    };

    if (!staff) return null;

    const myAvailableDays = staffList.find(s => s.id === staff?.id)?.availableDays;
    const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const myShifts = allShifts.filter(s => s.staffId === staff.id);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
            {/* Top Navigation */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 dark:text-white leading-none">
                            {activeTab === 'preference' ? '希望休提出' : activeTab === 'shifts' ? 'シフト確認' : '設定'}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{staff.name} さん</p>
                    </div>
                </div>
                
                {/* Desktop Tabs */}
                <nav className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('preference')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'preference' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Clock className="w-4 h-4" /><span>希望休</span>
                    </button>
                    <button onClick={() => setActiveTab('shifts')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'shifts' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Users className="w-4 h-4" /><span>シフト確認</span>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'settings' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <SettingsIcon className="w-4 h-4" /><span>設定</span>
                    </button>
                </nav>

                <div className="hidden md:block w-10"></div>
            </header>

            {/* Month Selector */}
            {activeTab !== 'settings' && (
                <div className="sticky top-[68px] z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 px-4 sm:px-6 py-3">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} aria-label="前月へ" className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div className="flex items-center space-x-2">
                                <span className="text-xl font-black text-slate-800 dark:text-white lowercase tracking-tight">
                                    {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                                </span>
                                {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
                            </div>
                            <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} aria-label="翌月へ" className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500">
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Message Banner */}
                {message && (
                    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md pointer-events-none">
                        <div className={`flex items-center gap-3 p-4 rounded-xl border animate-in fade-in slide-in-from-top-4 duration-300 shadow-lg backdrop-blur-md ${
                            message.type === 'success' 
                                ? 'bg-[#ebfbf1]/95 border-[#bbf0ce] text-[#1b8044] dark:bg-green-900/90 dark:border-green-800 dark:text-green-400' 
                                : 'bg-red-50/95 border-red-200 text-red-700 dark:bg-red-900/90 dark:border-red-800 dark:text-red-400'
                        }`}>
                            {message.type === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0 text-white fill-[#1b8044] dark:fill-green-500" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
                            <span className="font-bold text-sm sm:text-base pointer-events-auto">{message.text}</span>
                        </div>
                    </div>
                )}

                {activeTab === 'preference' && preferenceDataError && (
                    <div className="p-4 rounded-2xl border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-center justify-between gap-3" role="alert">
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            希望休または営業日データの読み込みに失敗しました。編集は停止されています。
                        </div>
                        <button type="button" onClick={retryPreferenceData} disabled={loading} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-bold whitespace-nowrap">
                            再試行
                        </button>
                    </div>
                )}

                {activeTab === 'preference' && loading && !preferenceDataError && (
                    <div className="p-8 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        営業日データを読み込んでいます
                    </div>
                )}

                {activeTab === 'preference' && !loading && !preferenceDataError && (
                    <PreferenceTab
                        staff={staff}
                        currentMonth={currentMonth}
                        days={days}
                        preferences={preferences}
                        setPreferences={setPreferences}
                        savedPreferences={savedPreferences}
                        setSavedPreferences={setSavedPreferences}
                        setMessage={setMessage}
                        myShifts={myShifts}
                        holidays={holidays}
                        businessDayOverrides={businessDayOverrides}
                        myAvailableDays={myAvailableDays ?? []}
                        closedDays={closedDays}
                    />
                )}

                {activeTab === 'shifts' && (
                    <ShiftViewTab 
                        loading={loading}
                        staff={staff}
                        days={days} 
                        allShifts={allShifts} 
                        staffList={staffList}
                        classes={classes}
                        timePatterns={timePatterns}
                        roles={roles}
                    />
                )}

                {activeTab === 'settings' && (
                    <StaffSettingsTab 
                        staff={staff} 
                        handleLogout={handleLogout} 
                    />
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-2xl z-50 p-2 flex items-center justify-around">
                <button onClick={() => setActiveTab('preference')} className={`flex flex-col items-center px-6 py-3 rounded-xl transition-all ${activeTab === 'preference' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'}`}>
                    <Clock className="w-6 h-6" /><span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">希望休</span>
                </button>
                <button onClick={() => setActiveTab('shifts')} className={`flex flex-col items-center px-6 py-3 rounded-xl transition-all ${activeTab === 'shifts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'}`}>
                    <Users className="w-6 h-6" /><span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">シフト</span>
                </button>
                <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center px-6 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'}`}>
                    <SettingsIcon className="w-6 h-6" /><span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">設定</span>
                </button>
            </nav>
        </div>
    );
};

export default StaffPreferencePage;
