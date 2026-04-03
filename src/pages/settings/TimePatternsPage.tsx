import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getTimePatterns } from '../../lib/api';
import { handleApiError } from '../../lib/errorHandler';
import type { ShiftTimePattern } from '../../types';
import TimePatternsSettings from '../../features/settings/components/TimePatternsSettings';

const TimePatternsPage = () => {
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const patternsData = await getTimePatterns();
            setTimePatterns(patternsData);
        } catch (err) {
            handleApiError(err, '勤務時間パターンの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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

                <TimePatternsSettings
                    patterns={timePatterns}
                    setPatterns={setTimePatterns}
                    loading={loading}
                    onUpdate={fetchData}
                />
            </div>
        </div>
    );
};

export default TimePatternsPage;
