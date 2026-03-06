import React from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X } from 'lucide-react';
import type { Shift, Staff } from '../../types';

interface DailyTimelineModalProps {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    onClose: () => void;
}

const DailyTimelineModal: React.FC<DailyTimelineModalProps> = ({ date, shifts, staffList, onClose }) => {
    // 時間帯の設定
    const startHour = 8;
    const endHour = 19;
    const totalHours = endHour - startHour;

    // ガイド用 時間配列 [8, 9, 10, ... 19]
    const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

    // シフトの横幅・位置を計算する関数
    const getShiftStyle = (startTime: string, endTime: string) => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const startVal = startH + startM / 60;
        let endVal = endH + endM / 60;

        // 終了時間が翌日の場合 (ex: 24:00) 
        if (endVal < startVal) {
            endVal += 24;
        }

        const clampedStart = Math.max(startHour, startVal);
        const clampedEnd = Math.min(endHour, endVal);

        const left = ((clampedStart - startHour) / totalHours) * 100;
        const width = ((clampedEnd - clampedStart) / totalHours) * 100;

        return {
            left: `${left}%`,
            width: `${Math.max(0, width)}%`,
        };
    };

    // 勤務時間の算出
    const calculateDuration = (startTime: string, endTime: string) => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        let startVal = startH * 60 + startM;
        let endVal = endH * 60 + endM;
        if (endVal < startVal) endVal += 24 * 60;

        const diffMins = endVal - startVal;
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    // クラス名からバーの色を決定
    const getBarColor = (classType: string, isError?: boolean) => {
        if (isError) return 'bg-red-400 border-red-500';
        if (classType === '虹組') return 'bg-yellow-300 border-yellow-400';
        if (classType === 'スマイル組') return 'bg-blue-300 border-blue-400';
        if (classType === '特殊') return 'bg-emerald-300 border-emerald-400';
        return 'bg-purple-300 border-purple-400';
    };

    // 背景の補助線（30分ごと）
    const renderGridLines = () => {
        const lines = [];
        for (let i = 0; i < totalHours * 2; i++) {
            const isHour = i % 2 === 0;
            const leftOffset = (i / (totalHours * 2)) * 100;
            lines.push(
                <div
                    key={i}
                    className={`absolute top-0 bottom-0 border-l ${isHour ? 'border-slate-300' : 'border-slate-100 border-dashed'} z-0`}
                    style={{ left: `${leftOffset}%` }}
                />
            );
        }
        return lines;
    };

    // 該当日のシフトを抽出してソート (名前順や時間順など)
    const targetDateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === targetDateStr).sort((a, b) => {
        if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
        return a.startTime.localeCompare(b.startTime);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 min-h-screen bg-slate-900/50 backdrop-blur-sm overflow-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                            <span>{format(date, 'yyyy年M月d日 (E)', { locale: ja })}</span>
                            <span className="text-slate-500 text-base font-normal">のタイムライン</span>
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 min-h-0">
                    <div className="min-w-[800px] border border-slate-300 rounded-lg overflow-hidden flex flex-col">

                        {/* Header Row */}
                        <div className="flex bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-700 select-none relative z-20 sticky top-0">
                            <div className="flex w-[280px] flex-shrink-0 bg-slate-100">
                                <div className="w-24 p-2 border-r border-slate-300 flex items-center justify-center">名前</div>
                                <div className="w-16 p-2 border-r border-slate-300 flex items-center justify-center">開始</div>
                                <div className="w-16 p-2 border-r border-slate-300 flex items-center justify-center">終了</div>
                                <div className="w-14 p-2 border-r border-slate-300 flex items-center justify-center">時間</div>
                            </div>

                            {/* Time Headers */}
                            <div className="flex-1 relative flex bg-slate-100">
                                {hours.slice(0, -1).map((h) => (
                                    <div key={h} className="flex-1 flex text-[10px] text-slate-500 relative">
                                        <div className="absolute -left-3 top-2 w-6 text-center bg-slate-100">{h}:00</div>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-6 text-center text-slate-400">{h}:30</div>
                                    </div>
                                ))}
                                <div className="absolute -right-3 top-2 w-6 text-center text-[10px] text-slate-500 bg-slate-100">{endHour}:00</div>
                            </div>
                        </div>

                        {/* Shifts Rows */}
                        <div className="flex-1 bg-white relative pb-4">
                            {dayShifts.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">この日のシフトはありません。</div>
                            ) : (
                                dayShifts.map((shift) => {
                                    const staff = staffList.find(s => s.id === shift.staffId);
                                    const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

                                    return (
                                        <div key={shift.id} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors group">
                                            {/* Info cells */}
                                            <div className="flex w-[280px] flex-shrink-0 text-sm">
                                                <div className="w-24 p-2 border-r border-slate-200 flex flex-col justify-center truncate font-medium text-slate-800">
                                                    <div>{staffName}</div>
                                                    <div className="text-[10px] text-slate-500 font-normal">
                                                        {shift.classType === '特殊' ? 'ヘルプ' : shift.classType}
                                                    </div>
                                                </div>
                                                <div className="w-16 p-2 border-r border-slate-200 flex items-center justify-center text-slate-600 tabular-nums">
                                                    {shift.startTime}
                                                </div>
                                                <div className="w-16 p-2 border-r border-slate-200 flex items-center justify-center text-slate-600 tabular-nums">
                                                    {shift.endTime}
                                                </div>
                                                <div className="w-14 p-2 border-r border-slate-200 flex items-center justify-center text-slate-600 tabular-nums font-semibold">
                                                    {calculateDuration(shift.startTime, shift.endTime)}
                                                </div>
                                            </div>

                                            {/* Timeline track */}
                                            <div className="flex-1 relative py-2 border-r border-slate-200 min-h-[44px]">
                                                {/* Grid Lines per row */}
                                                {renderGridLines()}

                                                {/* Shift Bar */}
                                                <div
                                                    className={`absolute top-2 bottom-2 rounded text-[10px] border shadow flex items-center justify-center font-bold text-slate-800/80 truncate px-2 z-10 transition-transform hover:scale-105 hover:z-20 hover:shadow-md cursor-default
                                                        ${getBarColor(shift.classType, shift.isError)}
                                                    `}
                                                    style={getShiftStyle(shift.startTime, shift.endTime)}
                                                    title={`${staffName} (${shift.startTime}-${shift.endTime})`}
                                                >
                                                    {shift.classType !== '特殊' ? shift.classType : 'ヘルプ'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-yellow-300 border border-yellow-400 rounded-sm"></div><span>虹組</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-blue-300 border border-blue-400 rounded-sm"></div><span>スマイル組</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-emerald-300 border border-emerald-400 rounded-sm"></div><span>ヘルプ/特殊</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-red-400 border border-red-500 rounded-sm"></div><span>エラー(未割り当て)</span></div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DailyTimelineModal;
