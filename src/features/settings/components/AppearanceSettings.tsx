import { useState } from 'react';
import { toast } from 'sonner';
import { getWeekStartsOn, setWeekStartsOn as saveWeekStartsOn, STORAGE_KEYS } from '../../../utils/dateUtils';
import FacilityNameSection from './FacilityNameSection';
import BusinessHoursSection from './BusinessHoursSection';
import BreakSettingsSection from './BreakSettingsSection';
import DutyNumberSection from './DutyNumberSection';
import DisplayPreferencesSection from './DisplayPreferencesSection';

const AppearanceSettings = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => getWeekStartsOn());
    const [appearanceModified, setAppearanceModified] = useState(false);

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        setAppearanceModified(true);
    };

    const handleWeekStartsOnChange = (newDay: 0 | 1) => {
        setWeekStartsOn(newDay);
        setAppearanceModified(true);
    };

    const handleSaveAppearance = () => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
        saveWeekStartsOn(weekStartsOn);
        setAppearanceModified(false);
        toast.success('表示設定を保存しました');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            <FacilityNameSection />

            <DisplayPreferencesSection
                theme={theme}
                weekStartsOn={weekStartsOn}
                modified={appearanceModified}
                onThemeChange={handleThemeChange}
                onWeekStartsOnChange={handleWeekStartsOnChange}
                onSave={handleSaveAppearance}
            />

            <BusinessHoursSection />

            <BreakSettingsSection />

            <DutyNumberSection />
        </div>
    );
};

export default AppearanceSettings;
