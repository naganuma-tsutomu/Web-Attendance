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
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 md:p-8">
                {/* Header */}
                <div className="mb-4 flex items-center space-x-2 sm:mb-6 sm:space-x-3">
                    <Clock className="h-6 w-6 text-indigo-500 sm:h-8 sm:w-8" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">勤務時間パターン</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
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
