import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { getClasses, getStaffList } from '../../lib/api';
import { handleApiError } from '../../lib/errorHandler';
import type { ShiftClass, Staff } from '../../types';
import ClassesSettings from '../../features/settings/components/ClassesSettings';

const ClassesPage = () => {
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [staffs, setStaffs] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [classesData, staffsData] = await Promise.all([
                getClasses(),
                getStaffList()
            ]);
            setClasses(classesData);
            setStaffs(staffsData);
        } catch (err) {
            handleApiError(err, 'クラスデータの読み込みに失敗しました');
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
                    <GraduationCap className="w-8 h-8 text-indigo-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">クラス管理</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            スタッフが所属するクラスやグループを管理します。
                        </p>
                    </div>
                </div>

                <ClassesSettings
                    classes={classes}
                    staffs={staffs}
                    loading={loading}
                    onUpdate={fetchData}
                    setClasses={setClasses}
                />
            </div>
        </div>
    );
};

export default ClassesPage;
