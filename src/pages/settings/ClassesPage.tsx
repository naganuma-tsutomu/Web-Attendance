import { useState, useEffect } from 'react';
import { CheckCircle, GraduationCap } from 'lucide-react';
import { getClasses } from '../../lib/api';
import type { ShiftClass } from '../../types';
import ClassesSettings from '../../features/settings/components/ClassesSettings';

const ClassesPage = () => {
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const classesData = await getClasses();
            setClasses(classesData);
        } catch (err) {
            console.error('Failed to load classes', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6">
                    <GraduationCap className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">クラス管理</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            スタッフが所属するクラスやグループを管理します。
                        </p>
                    </div>
                </div>

                {/* Toast Message */}
                {message && (
                    <div className="fixed top-20 right-4 z-50 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 shadow-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{message}</span>
                    </div>
                )}

                <ClassesSettings
                    classes={classes}
                    loading={loading}
                    onUpdate={fetchData}
                    setClasses={setClasses}
                    showMessage={showMessage}
                />
            </div>
        </div>
    );
};

export default ClassesPage;
