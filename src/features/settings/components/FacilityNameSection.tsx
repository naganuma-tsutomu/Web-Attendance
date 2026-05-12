import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFacilityName, useUpdateFacilityName } from '../../../lib/hooks';

const FacilityNameSection = () => {
    const { data: facilityNameData } = useFacilityName();
    const updateFacilityNameMutation = useUpdateFacilityName();
    const [facilityName, setFacilityName] = useState('');
    const [facilityNameModified, setFacilityNameModified] = useState(false);

    useEffect(() => {
        if (facilityNameData !== undefined) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFacilityName(facilityNameData);
            setFacilityNameModified(false);
        }
    }, [facilityNameData]);

    const handleSaveFacilityName = async () => {
        try {
            await updateFacilityNameMutation.mutateAsync(facilityName);
            toast.success('施設名を保存しました');
            setFacilityNameModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">施設名</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">サイドバーに表示される施設名を設定します。</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={facilityName}
                        onChange={(e) => { setFacilityName(e.target.value); setFacilityNameModified(true); }}
                        maxLength={50}
                        placeholder="施設名を入力"
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                    {facilityNameModified && (
                        <button
                            onClick={handleSaveFacilityName}
                            disabled={updateFacilityNameMutation.isPending || !facilityName.trim()}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updateFacilityNameMutation.isPending ? '保存中...' : '保存'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FacilityNameSection;
