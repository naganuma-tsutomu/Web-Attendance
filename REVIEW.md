# Web-Attendance コードレビュー (v2.5.0 / dev branch)

レビュー日: 2026-05-12 / 観点: 性能・UX・アクセシビリティ + 保守性・設計

## 1. エグゼクティブサマリー

- **全体所感**: 設定は堅牢、TanStack Query 中心の素直な構成、ロジック層のテスト基盤あり。直近のセキュリティ修正 (dev ブランチ未コミット分) で大穴は塞がっており、ハンドラ + middleware の二重防御も成立している。
- **残る重点課題**: フロントエンドの (a) 共通 `Modal` が事実上未使用で全モーダルが独自実装になっている、(b) `PreferencesPage` の派生 state、(c) god component 4 本、(d) アクセシビリティ。
- **バックエンド**: 直近修正は概ね良質。残る指摘は「冗長な防御コードの整理」と「middleware 経由の認可テスト追加」が中心。

### 優先度マップ

| 優先度 | 項目 | 推定工数 |
|---|---|---|
| 高 | `dark:hover:white` タイポ修正 ([PreferencesPage.tsx:210](src/features/preferences/PreferencesPage.tsx#L210)) | 5分 |
| 高 | モーダル群を共通 `Modal` に統一 (Esc/focus trap/aria-modal 一括対応) | 1-2日 |
| 中 | `PreferencesPage` の派生 state → `useMemo` 化 | 半日 |
| 中 | アイコンボタンへの `aria-label` 一斉追加 | 1日 |
| 中 | God component 4本の分割 | 各1日 |
| 中 | BigCalendar 内 inline component の切り出し | 半日 |
| 中 | `preferences/index.ts` の認可分岐をビルダーで集約 | 半日 |
| 中 | `shifts/replace` の middleware 経由認可テスト追加 | 半日 |
| 低 | `useSaveShiftsBatch` と `useReplaceShiftsForMonth` の使い分け明確化 | 半日 |
| 低 | wrangler `compatibility_date` 更新 | 5分 |
| 低 | `jsx-a11y` ESLint プラグイン導入 | 半日 |
| 低 | UI コンポーネントのスモークテスト追加 | 数日 |

---

## 2. 直近修正の品質チェック

### 2.1 肯定すべき修正

- **`getRequestAuthState` の集約** ([functions/utils.ts:5-35](functions/utils.ts#L5-L35))
  admin/staff/anonymous を 1 関数で判定するパターンは正解。cookie 解析を `extractCookieValue` に切り出した粒度も適切で、middleware 側の自前 `extractToken` ([_middleware.ts:66-73](functions/api/_middleware.ts#L66-L73)) と同等の役割を持つ。次のリファクタで両者を `extractCookieValue` に寄せると重複が解消できる。

- **GET `/api/staffs` の `...row` → 明示プロパティへの変更** ([functions/api/staffs/index.ts:55-67](functions/api/staffs/index.ts#L55-L67))
  staffs テーブルに将来カラムを足したときに「知らない列が API レスポンスに混入する」事故を防ぐ硬い書き方。`accessKey` を `admin` 分岐内でのみ付与するロジック ([staffs/index.ts:69-74](functions/api/staffs/index.ts#L69-L74)) も正しい。

- **`createServerError` から例外メッセージ露出を遮断** ([functions/utils/validation.ts:13-18](functions/utils/validation.ts#L13-L18))
  スタックトレース由来の情報漏洩を遮断、`console.error` でログ側には残す。OWASP A09 の典型対応。

- **`shifts/replace` の設計** ([functions/api/shifts/replace.ts](functions/api/shifts/replace.ts))
  旧 `delete → save` の 2 段呼び出しによる中間半端状態を排除し、`DELETE … WHERE date NOT IN (固定日)` と `INSERT` を 1 batch にまとめてアトミックに置換。`duty_number` 重複の事前検知 ([replace.ts:47-62](functions/api/shifts/replace.ts#L47-L62)) と UNIQUE 制約違反のフォールバック ([replace.ts:102-107](functions/api/shifts/replace.ts#L102-L107)) で 409 を正しく返す **二重防御** が秀逸。月境界も `nextMonth` 計算で 12 月跨ぎまで網羅。

- **`serverSecurity.test.ts` のカバレッジ** ([src/lib/__tests__/serverSecurity.test.ts](src/lib/__tests__/serverSecurity.test.ts))
  admin/staff 両分岐を並べてテストし、`replace` の「不正データなら batch を呼ばない」 ([serverSecurity.test.ts:190-209](src/lib/__tests__/serverSecurity.test.ts#L190-L209)) と「duty_number 重複なら batch を呼ばない」 ([serverSecurity.test.ts:211-233](src/lib/__tests__/serverSecurity.test.ts#L211-L233)) まで網羅されている。境界条件まで設計の意図が表現されているテスト。

- **`POST /api/preferences` のハンドラ側本人確認** ([functions/api/preferences/index.ts:73-82](functions/api/preferences/index.ts#L73-L82))
  middleware ([_middleware.ts:110-129](functions/api/_middleware.ts#L110-L129)) でも `body.staffId === staffId` を検証しているうえに、ハンドラ側でも再チェック。Defense in depth ◎。

- **README の Rate Limiting 運用記載** ([README.md:121-130](README.md#L121-L130))
  6桁 access_key のブルートフォース対策を Cloudflare 側 (運用層) で担保する判断と手順を明記。アプリ側に冗長な実装を入れないバランス感覚は良い分業。

### 2.2 直近修正の中で「もう一歩」の余地

- **ハンドラ側の `if (ADMIN_PASSWORD)` フォールバックは事実上デッドコード** ([functions/api/staffs/index.ts:6-9](functions/api/staffs/index.ts#L6-L9), [functions/api/preferences/index.ts:13-16](functions/api/preferences/index.ts#L13-L16), [functions/api/preferences/index.ts:73-75](functions/api/preferences/index.ts#L73-L75))
  middleware ([_middleware.ts:55-61](functions/api/_middleware.ts#L55-L61)) が `ADMIN_PASSWORD` 未設定時に 500 を返すため、ハンドラに到達した時点で必ず設定済み。**実害はない** が、`if (ADMIN_PASSWORD) { … } else { anonymous フォールバック }` のコードが各所に散らばっており、読み手に「未設定だと素通り？」と誤解させる。改善: `ADMIN_PASSWORD!` で受けるか、`getRequestAuthState` 側で `!secret` 時に例外を投げる契約にする。

- **`GET /api/preferences` の認可分岐の冗長化** ([functions/api/preferences/index.ts:13-34](functions/api/preferences/index.ts#L13-L34))
  legacy/normalized 双方で `if (authState.kind === 'staff') ... else ...` を別々に書いており、staffId フィルタが 4 通り展開されている。改善: `buildAuthFilter(authState): { sql: string; binds: unknown[] }` で 1 箇所に集約し、2 つのクエリに同じ条件を適用すると 30 行程度短くなる。

- **`shifts/replace` の middleware 経由認可テストが未カバー**
  ハンドラ単体テスト ([serverSecurity.test.ts:159-188](src/lib/__tests__/serverSecurity.test.ts#L159-L188)) は cookie なし (空文字列) でも成功する形になっており、これは「middleware が事前にブロックする」前提のテスト。staffReadEndpoints に POST `/api/shifts/replace` が含まれていないこと (= 管理者必須) を担保する **middleware 経由の統合テスト** を別途追加すると、将来 middleware を編集したときの安全網になる。

- **`useSaveShiftsBatch` の残置** ([src/lib/hooks.ts:135-149](src/lib/hooks.ts#L135-L149))
  新 `useReplaceShiftsForMonth` を追加するも旧 `useSaveShiftsBatch` がそのまま残っている。`useScheduleData` は `replace` に切り替わったが、ほかのコードパス (旧 `saveShiftsBatch` を呼ぶ箇所) が残っているかを 1 度棚卸しすると保守性が上がる。残すなら JSDoc コメントで「単発の追記用、月単位の置換は `useReplaceShiftsForMonth` を使う」と明記。

- **`cloudflare-pages.d.ts` の自前定義** ([src/types/cloudflare-pages.d.ts](src/types/cloudflare-pages.d.ts))
  `@cloudflare/workers-types` を使わない理由 (型バージョン固定、CI 軽量化等) を README または `cloudflare-pages.d.ts` 冒頭コメントに 2-3 行残すと将来のメンバーが迷わない。

- **`accessKey` リトライ 5 回の妥当性** ([functions/api/staffs/index.ts](functions/api/staffs/index.ts))
  6 桁 × 100 万通りに対しスタッフ 100 人なら衝突確率 0.01% 程度なので 5 回で十分。修正の妥当性 OK、特に直す箇所なし。

---

## 3. 性能・UX

### 3.1 `PreferencesPage` の派生 state 化が再描画と同期バグの温床

[src/features/preferences/PreferencesPage.tsx:23,65-92](src/features/preferences/PreferencesPage.tsx#L65-L92)

`preferences` を `useState` + 巨大な `useEffect` で導出している。`rawPrefs` / `staffList` / `holidays` / `closedDays` / `selectedStaffId` / `targetDate` が変わるたびに `setPreferences` で state を上書きしており、本来 `useMemo` で導出すべき派生値。

問題:
1. サーバ再取得中に古い preferences が一瞬残る (中間状態)。
2. 依存配列が 6 要素と多く、どれかが変わると全部の派生計算が走る。
3. 「派生」と「ユーザー編集中のドラフト」が同じ state に同居しており、編集破棄の挙動が読みづらい。

改善: ベースは `useMemo` で計算し、編集中の差分のみを `Map<dateStr, override>` 状の小さい state に分離する。「破棄」は差分を空にするだけで済む。

### 3.2 `SchedulePage` の BigCalendar inline component が毎レンダー再生成

[src/features/schedule/SchedulePage.tsx:227-287](src/features/schedule/SchedulePage.tsx#L227-L287)

`components.month.dateHeader` と `dateCellWrapper` を JSX 内のクロージャで渡している。`schedule.fixedDates` 等が更新されると BigCalendar の `components` プロパティが新しい参照になり、配下のセルが再マウント相当の挙動になりやすい。月切替などで顕著にちらつく場合は影響大。

改善: 上位で `useMemo` してから渡すか、`DateCellWrapper` / `DateHeader` として専用コンポーネントへ切り出し。

### 3.3 `useScheduleQueries` の複数月フェッチ

`Set` による重複排除はおおむね妥当。`staleTime` を `businessHours` 並みに伸ばすか、表示中の月のみ active にし他は cache-only にするチューニング余地がある。

### 3.4 評価のみ (修正不要)

- [vite.config.ts](vite.config.ts) の手動 chunk 分割 (React/Query/Calendar) は良好。
- TanStack Query の `QUERY_KEYS` 定数化 ([src/lib/hooks.ts](src/lib/hooks.ts)) は読みやすい。

---

## 4. アクセシビリティ

### 4.1 共通 `Modal` が事実上未使用、モーダルごとに a11y 実装が分散

[src/components/ui/Modal.tsx](src/components/ui/Modal.tsx) は Esc キーとバックドロップクローズを実装しているが、リポジトリ全体で **使用箇所が 1 ファイルのみ** ([src/features/settings/components/TimePatternEditModal.tsx:4](src/features/settings/components/TimePatternEditModal.tsx#L4))。`ShiftEditModal`、`ConfirmModal`、`DateEditModal`、`SubmitConfirmDialog`、`DailyTimelineModal`、`StaffFormModal`、`RoleEditModal` などはすべて独自に div を組み立てており、

- Esc キーで閉じない (`SchedulePage` の `ShiftEditModal` も親で trap していない)
- `role="dialog"` / `aria-modal="true"` がない
- focus trap がない
- ボタンに `aria-label` がない (`<X/>` アイコンのみ)

加えて [SchedulePage.tsx:80-88](src/features/schedule/SchedulePage.tsx#L80-L88) で **Modal.tsx と同じバックドロップ判定を再実装** している。

改善: 既存 `Modal` を拡張 (`role="dialog"`、`aria-modal`、focus trap、`aria-labelledby`) して、全モーダルを差し替え。一度に終わる仕事ではないので、まず `ConfirmModal` と `ShiftEditModal` から段階的に。

### 4.2 アイコンのみのボタンに `aria-label` がない

[src/features/preferences/PreferencesPage.tsx:199-213](src/features/preferences/PreferencesPage.tsx#L199-L213) — 月送りの `<ChevronLeft/>` `<ChevronRight/>`。スクリーンリーダーには「button」としか読み上げられない。

改善: `aria-label="前月へ"` / `"翌月へ"` を付与。SchedulePage のヘッダー、設定ページのアイコンボタンなど同種の箇所が多数。`jsx-a11y/control-has-associated-label` を ESLint で自動検出可能。

### 4.3 良い点

- [PreferencesPage.tsx:254](src/features/preferences/PreferencesPage.tsx#L254) でエラーバナーに `role="alert"`。
- [PreferencesPage.tsx:263](src/features/preferences/PreferencesPage.tsx#L263) の再試行ボタンに `aria-label`。

### 4.4 ARIA 属性の総量

リポジトリ全体で `aria-*` / `role=*` / `tabIndex` は約 24 箇所 (約 1.7 万行に対して)。フォーム入力ラベル、テーブル/グリッドへの `role="grid"` 等の補強余地。

---

## 5. UI バグ・タイポ

### 5.1 ダークモードクラスのタイポ

[src/features/preferences/PreferencesPage.tsx:210](src/features/preferences/PreferencesPage.tsx#L210)

```
className="... dark:hover:text-slate-800 dark:hover:white ..."
```

`dark:hover:white` は Tailwind で無効 (text color にも background にもならない)。`dark:hover:text-white` の意図と思われる。前月ボタン側 ([PreferencesPage.tsx:201](src/features/preferences/PreferencesPage.tsx#L201)) は `dark:hover:text-white` になっているので、翌月ボタンのみのミス。

改善: `dark:hover:text-white` に修正。5 分で終わる。

---

## 6. 保守性・設計

### 6.1 God component 群 (>500行)

| ファイル | 行数 | 主因 |
|---|---|---|
| [src/features/settings/components/ClassManagement.tsx](src/features/settings/components/ClassManagement.tsx) | 702 | クラス CRUD + 並び替え + ダイアログを 1 ファイルに集約 |
| [src/features/settings/components/AppearanceSettings.tsx](src/features/settings/components/AppearanceSettings.tsx) | 618 | テーマ + Excel + 表示オプションのフォームが集約 |
| [src/features/schedule/DailyTimelineView.tsx](src/features/schedule/DailyTimelineView.tsx) | 616 | タイムラインのレイアウト計算が密 |
| [src/features/settings/components/RolesSettings.tsx](src/features/settings/components/RolesSettings.tsx) | 586 | ロール + パターンの編集を 1 ファイル |

改善方針: 編集/削除/並び替えのアクション単位で 200-300 行を目安に分割。`StaffFormModal.tsx` (389行) などは現状許容範囲。

### 6.2 `useShiftEdit` (349行) と `useScheduleData` (281行) の責務集中

- [src/features/schedule/hooks/useShiftEdit.ts](src/features/schedule/hooks/useShiftEdit.ts) — reducer + drag 状態 + 検証ロジック。reducer action と drag 系は別フックに分離可能。
- [src/features/schedule/hooks/useScheduleData.ts](src/features/schedule/hooks/useScheduleData.ts) — クエリ集約 + 派生計算 + アルゴリズム呼び出しが混在。直近の `replace` API 切替で `handleGenerate` ([useScheduleData.ts:121-160](src/features/schedule/hooks/useScheduleData.ts#L121-L160)) は簡素化された。残るのは「データ取得 (useScheduleQueries)」と「変更ハンドラ群」を別フックに切ること。

### 6.3 `ScheduleHeader` への props drilling

[src/features/schedule/SchedulePage.tsx:93-120](src/features/schedule/SchedulePage.tsx#L93-L120) で 20+ props を渡している。

改善: `schedule` オブジェクトをそのまま受け取らせるか、`ScheduleContext` で共有。ヘッダーが必要なのは大部分 `schedule.*` の subset なので、context 経由が素直。

### 6.4 モーダルのバックドロップ処理重複

§4.1 で詳細。`SchedulePage` 内で `Modal.tsx` と同じ判定ロジックを再実装している。

### 6.5 `preferences/index.ts` の認可分岐の冗長化

§2.2 で詳細。`buildAuthFilter` で集約推奨。

---

## 7. テスト

### 7.1 強み

- ロジック層 (algorithm, dateUtils, validation, AuthContext, holidayUtils, leaderRebalance, rotationAlgorithm) は充実。
- 新 [serverSecurity.test.ts](src/lib/__tests__/serverSecurity.test.ts) で API 認可境界もカバー。admin/staff の両分岐をペアで検証する形は秀逸。

### 7.2 弱み

- UI 層 (`SchedulePage`、`PreferencesPage` 等) のコンポーネントテストがほぼ無い。
- `shifts/replace` の **middleware 経由** の認可テストは未カバー (テストはハンドラ直呼びで cookie 空でも成功してしまう)。

### 7.3 改善

- 主要ページに `@testing-library/react` でのスモークテスト追加。
- `jest-axe` (or `vitest-axe`) で a11y チェックの自動化。
- middleware を経由する統合テスト (今は wrangler dev で手動になっている)。

---

## 8. 残るセキュリティ観点 (限定)

直近修正で重大なものはほぼ対応済み (§2 で詳細)。残るのは:

- **`PATCH /api/preferences` の認可** — 直近修正は `onRequestPost` 側を主に強化。`onRequestPatch` (submitted 切替) は middleware で管理者のみが許可される設計のはずなので、middleware 一覧 ([_middleware.ts:93-103](functions/api/_middleware.ts#L93-L103)) に PATCH が含まれない (= 管理者必須) ことを確認済み。**問題なし**。
- **CORS 未設定** — [_middleware.ts:17-22](functions/api/_middleware.ts#L17-L22) コメントの通り、Cloudflare Pages 同一ホスト配信が前提。SameSite=Strict Cookie で別オリジン経由は遮断される。**現状は正しい判断**、将来別ドメイン配信する際は要追加。

---

## 9. 設定・ツール

- **Wrangler `compatibility_date`** ([wrangler.toml](wrangler.toml)) — `2024-03-20` 固定。2025-12 など現行寄りに上げる検討余地。
- **ESLint** — recommended 中心。`no-console`、`@tanstack/eslint-plugin-query`、`jsx-a11y` の追加で品質ルール拡充可。
- **`@typescript-eslint/no-explicit-any: warn`** — 段階緩和は妥当だが、`as` 多用箇所 ([src/lib/api.ts](src/lib/api.ts) 等) の段階的解消ロードマップを明記すると良い。
- **マイグレーション運用** — [migrations/0001_*.sql](migrations/) のみで、連番ルール / down 戦略 / 適用判断を README に明示すると新メンバーが安心。

---

## 10. 推奨対応ロードマップ

### 今週 (短時間で効果大)

1. `dark:hover:white` のタイポ修正 (5分)
2. `preferences/index.ts` の認可分岐を `buildAuthFilter` で集約 (半日)
3. `ADMIN_PASSWORD` のハンドラ側フォールバック整理 — `getRequestAuthState` に契約を寄せて、各ハンドラの `if (ADMIN_PASSWORD)` を削除 (半日)

### 今月 (中規模)

4. 共通 `Modal` を a11y 対応に拡張 + `ConfirmModal` と `ShiftEditModal` を移植 (1-2日)
5. アイコンボタン `aria-label` 一斉付与 + `jsx-a11y` ESLint プラグイン導入 (1日)
6. `PreferencesPage` 派生 state → `useMemo` 化 (半日)
7. `BigCalendar` inline component の切り出し (半日)
8. `shifts/replace` の middleware 経由認可テスト追加 (半日)

### 中長期

9. God component 4本の段階的分割
10. `useShiftEdit` / `useScheduleData` の責務分割
11. UI コンポーネントのスモークテストカバレッジ整備
12. `useSaveShiftsBatch` と `useReplaceShiftsForMonth` の棚卸し
