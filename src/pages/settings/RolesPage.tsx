import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { getTimePatterns, getRoles } from '../../lib/api';
import { handleApiError } from '../../lib/errorHandler';
import type { ShiftTimePattern, DynamicRole } from '../../types';
import RolesSettings from '../../features/settings/components/RolesSettings';

const RolesPage = () => {
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [patternsData, rolesData] = await Promise.all([
                getTimePatterns(),
                getRoles()
            ]);
            setTimePatterns(patternsData);
            setRoles(rolesData);
        } catch (err) {
            handleApiError(err, 'スタッフ区分の読み込みに失敗しました');
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
                    <Users className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">スタッフ区分管理</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            スタッフに割り当てるスタッフ区分と利用可能な勤務パターンを管理します。
                        </p>
                    </div>
                </div>

                <RolesSettings
                    roles={roles}
                    setRoles={setRoles}
                    timePatterns={timePatterns}
                    loading={loading}
                    onUpdate={fetchData}
                />
            </div>
        </div>
    );
};

export default RolesPage;
