import { useState } from 'react';
import { toast } from 'sonner';
import { getWeekStartsOn, setWeekStartsOn as saveWeekStartsOn, STORAGE_KEYS } from '../../../utils/dateUtils';
import FacilityNameSection from './FacilityNameSection';
import BusinessHoursSection from './BusinessHoursSection';
import BreakSettingsSection from './BreakSettingsSection';
import DutyNumberSection from './DutyNumberSection';
import DisplayPreferencesSection from './DisplayPreferencesSection';
import { useSchedulePreferences, useUpdateSchedulePreferences } from '../../../lib/hooks';

const AppearanceSettings = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => getWeekStartsOn());
    const [autoOpenGenerationReportDraft, setAutoOpenGenerationReportDraft] = useState<boolean | null>(null);
    const [appearanceModified, setAppearanceModified] = useState(false);
    const { data: schedulePreferences } = useSchedulePreferences();
    const updateSchedulePreferences = useUpdateSchedulePreferences();
    const autoOpenGenerationReport = autoOpenGenerationReportDraft
        ?? schedulePreferences?.autoOpenGenerationReport
        ?? true;

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        setAppearanceModified(true);
    };

    const handleWeekStartsOnChange = (newDay: 0 | 1) => {
        setWeekStartsOn(newDay);
        setAppearanceModified(true);
    };

    const handleAutoOpenGenerationReportChange = (enabled: boolean) => {
        setAutoOpenGenerationReportDraft(enabled);
        setAppearanceModified(true);
    };

    const handleSaveAppearance = async () => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
        saveWeekStartsOn(weekStartsOn);
        try {
            await updateSchedulePreferences.mutateAsync({ autoOpenGenerationReport });
            setAutoOpenGenerationReportDraft(null);
            setAppearanceModified(false);
            toast.success('表示設定を保存しました');
        } catch (err) {
            console.error(err);
            toast.error('表示設定の保存に失敗しました');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            <FacilityNameSection />

            <DisplayPreferencesSection
                theme={theme}
                weekStartsOn={weekStartsOn}
                autoOpenGenerationReport={autoOpenGenerationReport}
                modified={appearanceModified}
                onThemeChange={handleThemeChange}
                onWeekStartsOnChange={handleWeekStartsOnChange}
                onAutoOpenGenerationReportChange={handleAutoOpenGenerationReportChange}
                onSave={handleSaveAppearance}
                saving={updateSchedulePreferences.isPending}
            />

            <BusinessHoursSection />

            <BreakSettingsSection />

            <DutyNumberSection />
        </div>
    );
};

export default AppearanceSettings;
