const REF_DATE = new Date('2024-01-01').getTime();

/**
 * duty_number が保存済みならそれを返す。
 * 未設定（null/undefined）なら日付ベースのローテーションで自動計算する。
 *
 * fullTimeGroupIds を渡すと「正社員のみ1番ローテーション」モード：
 *   - 正社員は自グループ内でローテーション（1, 2, 3...）
 *   - パート等は正社員グループの後に固定順で続く（正社員数+1, +2...）
 * 省略時は全員でローテーション（従来動作）。
 */
export function getEffectiveDutyNumber(
    staffId: string,
    storedNumber: number | null | undefined,
    date: Date,
    groupStaffIds: string[],
    fullTimeGroupIds?: string[]
): number {
    if (storedNumber != null) return storedNumber;
    const n = groupStaffIds.length;
    if (n === 0) return 1;
    const dayOffset = Math.floor((date.getTime() - REF_DATE) / 86400000);

    if (fullTimeGroupIds && fullTimeGroupIds.length > 0) {
        const ftIds = groupStaffIds.filter(id => fullTimeGroupIds.includes(id));
        const ptIds = groupStaffIds.filter(id => !fullTimeGroupIds.includes(id));
        const ftIdx = ftIds.indexOf(staffId);
        if (ftIdx >= 0) {
            return ((ftIdx + dayOffset) % ftIds.length) + 1;
        }
        const ptIdx = ptIds.indexOf(staffId);
        return ptIdx < 0 ? 1 : ftIds.length + ptIdx + 1;
    }

    const idx = groupStaffIds.indexOf(staffId);
    if (idx < 0) return 1;
    return ((idx + dayOffset) % n) + 1;
}
