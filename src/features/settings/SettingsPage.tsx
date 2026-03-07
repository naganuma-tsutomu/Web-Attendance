import { useState, useEffect } from 'react';
import { CheckCircle, Settings2 } from 'lucide-react';
import { getTimePatterns, getRoles, getClasses } from '../../lib/api';
import type { ShiftTimePattern, DynamicRole, ShiftClass } from '../../types';
import SettingsLayout from './layouts/SettingsLayout';
import SettingsSidebar from './components/SettingsSidebar';
import TimePatternsSettings from './components/TimePatternsSettings';
import RolesSettings from './components/RolesSettings';
import ClassesSettings from './components/ClassesSettings';
import AppearanceSettings from './components/AppearanceSettings';

const SettingsPage = () => {
    // State for Time Patterns
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loadingPatterns, setLoadingPatterns] = useState(true);

    // State for Roles
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);

    // State for Classes
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);

    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'patterns' | 'roles' | 'classes' | 'appearance'>('patterns');

    const fetchData = async () => {
        // We can optimize this to only fetch what's needed or fetch all.
        // For simplicity and consistency, let's keep fetching all for now as some components might need cross-data (e.g. roles need patterns).
        setLoadingPatterns(true);
        setLoadingRoles(true);
        setLoadingClasses(true);
        try {
            const [patternsData, rolesData, classesData] = await Promise.all([
                getTimePatterns(),
                getRoles(),
                getClasses()
            ]);
            setTimePatterns(patternsData);
            setRoles(rolesData);
            setClasses(classesData);
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoadingPatterns(false);
            setLoadingRoles(false);
            setLoadingClasses(false);
        }
    };

    // Specific fetchers for updates to avoid full reload flicker if desired,
    // but generic fetchData is safer for consistency.
    // We'll pass fetchData as onUpdate.

    useEffect(() => {
        fetchData();
    }, []);

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <SettingsLayout
            sidebar={
                <SettingsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            }
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                    <Settings2 className="w-7 h-7 text-indigo-500" />
                    <span>設定</span>
                </h2>
                {/* Mobile description only, or keep it consistent? Original had it. */}
                {/* <p className="text-slate-500 dark:text-slate-400 mt-1">勤務時間の種類と、役職ごとの利用可能パターンを定義します。</p> */}
            </div>

            {message && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-1 mb-6">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            {activeTab === 'patterns' && (
                <TimePatternsSettings
                    patterns={timePatterns}
                    loading={loadingPatterns}
                    onUpdate={fetchData}
                    showMessage={showMessage}
                />
            )}
            {activeTab === 'roles' && (
                <RolesSettings
                    roles={roles}
                    timePatterns={timePatterns}
                    loading={loadingRoles}
                    onUpdate={fetchData}
                    showMessage={showMessage}
                />
            )}
            {activeTab === 'classes' && (
                <ClassesSettings
                    classes={classes}
                    loading={loadingClasses}
                    onUpdate={fetchData}
                    setClasses={setClasses}
                    showMessage={showMessage}
                />
            )}
            {activeTab === 'appearance' && (
                <AppearanceSettings />
            )}
        </SettingsLayout>
    );
};

export default SettingsPage;
