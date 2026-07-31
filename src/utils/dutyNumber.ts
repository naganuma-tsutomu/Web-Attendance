// 2024-01-01 を基準日として日付オフセットを計算する。
// DB に duty_number が保存済みであれば自動計算は使われない（DB 値優先）。
const REF_DATE = new Date('2024-01-01').getTime();

/**
 * duty_number が保存済みならそれを返す。
 * 未設定（null/undefined）なら日付ベースのローテーションで自動計算する。
 *
 * fullTimeGroupIds を渡すと「正社員のみ1番ローテーション」モード：
 *   - 正社員は自グループ内でローテーション（1, 2, 3...）
 *   - パート等は正社員グループの後に固定順で続く（正社員数+1, +2...）
 * 省略時は全員でローテーション（従来動作）。
 *
 * ⚠ groupStaffIds の順序・長さに依存する:
 *   - 並び順が変わると全スタッフのローテーションが一斉にずれる。
 *   - 呼び出し元は staffs テーブルの display_order 昇順で渡すこと。
 *   - 新規スタッフを末尾に追加した場合、追加当日（dayOffset が同じ日）の番号は変わらないが、
 *     グループ人数 n が変わるため翌日以降の %n 計算結果が変化する。
 *     duty_number は DB に保存済みなら DB 値が優先されるため、
 *     確定済みの日付には影響しない。
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

export interface DutyNumberEntry {
    id: string;
    staffId: string;
    storedNumber: number | null | undefined;
}

/**
 * クラス内の当番番号を一括計算する。
 *
 * 有効な手動番号を先に固定し、残りのシフトには自動ローテーション順を
 * 保ちながら未使用番号を割り当てる。これにより手動番号と自動番号が
 * 衝突しても、表示結果は常に 1..人数の一意な連番になる。
 */
export function getEffectiveDutyNumbers(
    entries: DutyNumberEntry[],
    date: Date,
    fullTimeStaffIds?: string[]
): Map<string, number> {
    const result = new Map<string, number>();
    const groupStaffIds = entries.map(entry => entry.staffId);
    const groupSize = entries.length;
    if (groupSize === 0) return result;

    const validStoredNumbers = new Set<number>();
    for (const entry of entries) {
        const stored = entry.storedNumber;
        if (
            stored != null &&
            Number.isInteger(stored) &&
            stored >= 1 &&
            stored <= groupSize &&
            !validStoredNumbers.has(stored)
        ) {
            result.set(entry.id, stored);
            validStoredNumbers.add(stored);
        }
    }

    const remainingNumbers = Array.from(
        { length: groupSize },
        (_, index) => index + 1
    ).filter(number => !validStoredNumbers.has(number));

    const fullTimeGroupIds = fullTimeStaffIds
        ? groupStaffIds.filter(staffId => fullTimeStaffIds.includes(staffId))
        : undefined;

    const unassignedEntries = entries
        .map((entry, index) => ({
            entry,
            index,
            automaticNumber: getEffectiveDutyNumber(
                entry.staffId,
                null,
                date,
                groupStaffIds,
                fullTimeGroupIds
            ),
        }))
        .filter(({ entry }) => !result.has(entry.id))
        .sort((a, b) =>
            a.automaticNumber - b.automaticNumber ||
            a.index - b.index
        );

    unassignedEntries.forEach(({ entry }, index) => {
        result.set(entry.id, remainingNumbers[index]);
    });

    return result;
}
