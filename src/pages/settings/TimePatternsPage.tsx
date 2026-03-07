import { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { getTimePatterns } from '../../lib/api';
import type { ShiftTimePattern } from '../../types';
import TimePatternsSettings from '../../features/settings/components/TimePatternsSettings';

const TimePatternsPage = () => {
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const patternsData = await getTimePatterns();
            setTimePatterns(patternsData);
        } catch (err) {
            console.error('Failed to load time patterns', err);
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
                    <Clock className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">勤務時間パターン</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            シフト作成時に選択可能な勤務時間帯を定義します。
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

                <TimePatternsSettings
                    patterns={timePatterns}
                    loading={loading}
                    onUpdate={fetchData}
                    showMessage={showMessage}
                />
            </div>
        </div>
    );
};

export default TimePatternsPage;
