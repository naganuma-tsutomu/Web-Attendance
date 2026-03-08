# ShiftRequirementsPage API接続実装 - 作業報告

**作業日時:** 2025-03-08  
**対象アプリ:** Web-Attendance シフト表アプリ

## 実装内容

### 1. DBテーブル作成用SQL (`files/shift_requirements_migration.sql`)

`shift_requirements` テーブルを作成するSQLマイグレーションファイルを作成しました。

**テーブル構造:**
| カラム名 | 型 | 制約 |
|---------|-----|------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| class_id | text | NOT NULL |
| day_of_week | integer | NOT NULL, CHECK (0-7) |
| start_time | text | NOT NULL |
| end_time | text | NOT NULL |
| min_staff_count | integer | NOT NULL, CHECK (>= 0) |
| priority | integer | NOT NULL, CHECK (1-5) |
| created_at | timestamptz | DEFAULT NOW() |
| updated_at | timestamptz | DEFAULT NOW() |

**追加設定:**
- インデックス: `class_id`, `day_of_week`
- `updated_at` 自動更新トリガー
- RLSポリシー: 認証済みユーザーに全操作許可

### 2. API関数実装 (`src/lib/api.ts`)

以下の3関数を追加しました:

```typescript
// 全要件取得
getShiftRequirements(): Promise<ShiftRequirement[]>

// 一括保存（削除→挿入方式）
saveShiftRequirements(requirements: ShiftRequirement[]): Promise<void>

// 個別削除
deleteShiftRequirement(id: string): Promise<void>
```

エンドポイント: `/api/settings/shift-requirements`

### 3. コンポーネント更新 (`src/pages/settings/ShiftRequirementsPage.tsx`)

**変更点:**
- ローカルの `ShiftRequirement` インターフェースを削除し、`types/index.ts` からimport
- モックデータ `mockRequirements` を削除
- `useEffect` 内のデータ取得を `getShiftRequirements()` API呼び出しに変更
- `handleSave` 内の保存処理を `saveShiftRequirements()` API呼び出しに変更
- `setError('')` を適切な位置に追加してエラー状態をクリア

### 4. TypeScript構文チェック

`npx tsc --noEmit` を実行し、エラーなしを確認済み。

## 次のステップ

1. SupabaseでSQLマイグレーションを実行
2. バックエンドAPIエンドポイントを実装 (`/api/settings/shift-requirements`)
3. 動作テスト

## ファイル変更一覧

- `files/shift_requirements_migration.sql` (新規作成)
- `src/lib/api.ts` (API関数追加)
- `src/pages/settings/ShiftRequirementsPage.tsx` (API接続実装)
