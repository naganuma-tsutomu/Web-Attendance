# Web-Attendance

シフト管理システム。スタッフの希望休収集からシフト自動生成・Excel出力までをカバーします。

## 技術スタック

| 分類 | 技術 |
|------|------|
| フロントエンド | React 19, TypeScript, Tailwind CSS v4, Vite |
| バックエンド | Cloudflare Pages Functions |
| データベース | Cloudflare D1 (SQLite) |
| 状態管理 | TanStack Query v5 |
| テスト | Vitest, Testing Library |

## ローカル開発

### 前提条件

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare アカウント（D1 データベースのアクセス用）

### セットアップ

```bash
# 依存関係インストール
npm install

# ローカル用 D1 データベースを初期化
npm run db:init:local

# 管理者パスワードを設定（.dev.vars ファイルを作成）
echo 'ADMIN_PASSWORD=your_password' > .dev.vars
```

### 開発サーバー起動

```bash
npm run dev
```

Cloudflare Workers のランタイムをエミュレートしながら起動します（`http://localhost:5173`）。

### テスト

```bash
npm test
```

Pull Requestとpushでは、GitHub Actionsがlint、型検査、全テスト、production build、空D1へのschema・seed適用を自動実行します。

## デプロイ（Cloudflare Pages）

### 初回セットアップ

```bash
# Cloudflare にログイン
wrangler login

# 本番用 D1 データベースを初期化
wrangler d1 execute web-attendance-restored-db --file=db/schema.sql

# 管理者パスワードを本番環境に設定
wrangler pages secret put ADMIN_PASSWORD
```

### デプロイ

```bash
npm run build
wrangler pages deploy dist
```

### スキーマ変更時のマイグレーション

**既存 D1 データベース**に対してスキーマ変更を反映する場合は、`db/schema.sql` を直接流すのではなく `db/migrations/` 内のスクリプトを使う。

#### 手順

1. **重複チェック**（インデックス追加前に必ず実行）

   ```bash
   # access_key 重複確認
   wrangler d1 execute web-attendance-restored-db \
     --command "SELECT access_key, COUNT(*) AS c FROM staffs WHERE access_key IS NOT NULL GROUP BY access_key HAVING c > 1;"

   # (date, classType, duty_number) 重複確認
   wrangler d1 execute web-attendance-restored-db \
     --command "SELECT date, classType, duty_number, COUNT(*) AS c FROM shifts WHERE duty_number IS NOT NULL GROUP BY date, classType, duty_number HAVING c > 1;"
   ```

   結果が 0 件であることを確認すること。重複が見つかった場合は手動で修正してから次のステップへ進む。

2. **マイグレーション実行**

   ```bash
   wrangler d1 execute web-attendance-restored-db --file=db/migrations/0001_initial_schema_updates.sql
   ```

   ローカルで事前検証する場合:

   ```bash
   wrangler d1 execute web-attendance-restored-db --local --file=db/migrations/0001_initial_schema_updates.sql
   ```

> **注意**: 新規環境（初回セットアップ）は `db/schema.sql` のみで OK。マイグレーションは不要。

機能追加後のマイグレーションは番号順に適用する。操作履歴機能を利用する環境では、次も実行する。

```bash
wrangler d1 execute web-attendance-restored-db --file=db/migrations/0004_audit_logs.sql
```

### 環境

`wrangler.toml` で本番・プレビューの2環境を管理しています。

| 環境 | D1 データベース |
|------|----------------|
| 本番 | `web-attendance-restored-db` |
| プレビュー | `web-attendance-preview-db` |

プレビュー環境へのデプロイ:

```bash
wrangler pages deploy dist --env preview
```

## 主な機能

| 機能 | 概要 |
|------|------|
| 希望休管理 | スタッフ別に希望休・部分休・研修日を月単位で収集・提出管理 |
| シフト自動生成 | 希望休・ローテーションルール・固定日設定を考慮してシフトを自動生成。生成後レポートで未割当・時間差分・クラス充足率を確認可能 |
| Excel 出力 | 月次シフト表を Excel ファイルで出力。スタッフ別ハイライト・当番番号表示に対応 |
| バックアップ / 復元 | 月次シフトをスナップショットとして保存し、任意の時点に復元可能 |
| CSV インポート | 外部で作成したシフトデータを CSV 形式でインポート |
| ローテーション設定 | 早番・遅番のローテーションルール（平日・土曜別）を設定画面から管理 |
| 生成レポート表示設定 | 自動生成後に生成レポートを自動表示するかを表示設定から切り替え可能 |
| シフト常時チェック | 希望休競合、休業日勤務、営業時間外、必要人数不足、目標時間超過などを月単位で検出 |
| 集計ダッシュボード | スタッフ別予定時間、クラス別充足率、未割当、希望休提出状況を表示 |
| 操作履歴 | シフト、希望休、ロック、バックアップ復元、個別営業日・休業日の主要変更を記録 |

## 運用上のセキュリティ設定

スタッフログインはスタッフ名と6桁アクセスキーを使います。アクセスキーは運用都合により6桁を維持するため、Cloudflare 側で `/api/auth/staff-login` に Rate Limiting を設定してください。

推奨の初期設定:

- 対象: `POST /api/auth/staff-login`
- 条件: 同一IPからの短時間の連続失敗を制限
- アクション: 一時ブロックまたは Managed Challenge
- 管理者ログイン `/api/auth/login` も同様に制限

本番・プレビューへデプロイした後は、両方の環境で設定漏れを検査します。

```bash
RATE_LIMIT_TARGET_URL=https://example.pages.dev npm run check:auth-rate-limit
```

スタッフ用・管理者用ログインの両方が、20回以内に `429 Too Many Requests` を返せば成功です。制限回数を20回より多く設定している場合は、`RATE_LIMIT_CHECK_ATTEMPTS`（最大100）で検査回数を指定できます。この検査は実際に失敗ログインを連続送信するため、デプロイ直後のスモークテストとしてのみ実行してください。

## プロジェクト構成

```
├── functions/          # Cloudflare Pages Functions（APIエンドポイント）
│   └── api/
├── db/                 # D1 データベース関連
│   ├── schema.sql      # 新規環境用スキーマ
│   ├── seed.sql        # ローカル開発用の初期データ
│   └── migrations/     # 既存環境用マイグレーション
├── docs/               # ユーザー向け文書・更新履歴
├── src/
│   ├── features/       # 機能単位のコンポーネント・フック
│   ├── lib/            # APIクライアント・アルゴリズム・共通ロジック
│   ├── pages/          # ルーティング対応ページ
│   ├── types/          # 型定義・Zodスキーマ
│   └── utils/          # ユーティリティ関数
└── wrangler.toml       # Cloudflare 設定
```

---

ユーザー向けの操作マニュアルは [USER_MANUAL.md](docs/USER_MANUAL.md) を参照してください。

監視、障害対応、D1復旧については [OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) を参照してください。

依存関係の監査方針と既知の例外は [DEPENDENCY_SECURITY.md](docs/DEPENDENCY_SECURITY.md) を参照してください。
