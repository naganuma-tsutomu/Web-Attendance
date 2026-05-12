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

## デプロイ（Cloudflare Pages）

### 初回セットアップ

```bash
# Cloudflare にログイン
wrangler login

# 本番用 D1 データベースを初期化
wrangler d1 execute web-attendance-db --file=schema.sql

# 管理者パスワードを本番環境に設定
wrangler pages secret put ADMIN_PASSWORD
```

### デプロイ

```bash
npm run build
wrangler pages deploy dist
```

### スキーマ変更時のマイグレーション

**既存 D1 データベース**に対してスキーマ変更を反映する場合は、`schema.sql` を直接流すのではなく `migrations/` 内のスクリプトを使う。

#### 手順

1. **重複チェック**（インデックス追加前に必ず実行）

   ```bash
   # access_key 重複確認
   wrangler d1 execute web-attendance-db \
     --command "SELECT access_key, COUNT(*) AS c FROM staffs WHERE access_key IS NOT NULL GROUP BY access_key HAVING c > 1;"

   # (date, classType, duty_number) 重複確認
   wrangler d1 execute web-attendance-db \
     --command "SELECT date, classType, duty_number, COUNT(*) AS c FROM shifts WHERE duty_number IS NOT NULL GROUP BY date, classType, duty_number HAVING c > 1;"
   ```

   結果が 0 件であることを確認すること。重複が見つかった場合は手動で修正してから次のステップへ進む。

2. **マイグレーション実行**

   ```bash
   wrangler d1 execute web-attendance-db --file=migrations/0001_add_fk_and_unique.sql
   wrangler d1 execute web-attendance-db --file=migrations/0002_add_shift_snapshots.sql
   wrangler d1 execute web-attendance-db --file=migrations/0003_scope_duty_number_by_class.sql
   ```

   ローカルで事前検証する場合:

   ```bash
   wrangler d1 execute web-attendance-db --local --file=migrations/0001_add_fk_and_unique.sql
   wrangler d1 execute web-attendance-db --local --file=migrations/0002_add_shift_snapshots.sql
   wrangler d1 execute web-attendance-db --local --file=migrations/0003_scope_duty_number_by_class.sql
   ```

> **注意**: 新規環境（初回セットアップ）は `schema.sql` のみで OK。マイグレーションは不要。

### 環境

`wrangler.toml` で本番・プレビューの2環境を管理しています。

| 環境 | D1 データベース |
|------|----------------|
| 本番 | `web-attendance-db` |
| プレビュー | `web-attendance-preview-db` |

プレビュー環境へのデプロイ:

```bash
wrangler pages deploy dist --env preview
```

## 運用上のセキュリティ設定

スタッフログインはスタッフ名と6桁アクセスキーを使います。アクセスキーは運用都合により6桁を維持するため、Cloudflare 側で `/api/auth/staff-login` に Rate Limiting を設定してください。

推奨の初期設定:

- 対象: `POST /api/auth/staff-login`
- 条件: 同一IPからの短時間の連続失敗を制限
- アクション: 一時ブロックまたは Managed Challenge
- 管理者ログイン `/api/auth/login` も同様に制限

## プロジェクト構成

```
├── functions/          # Cloudflare Pages Functions（APIエンドポイント）
│   └── api/
├── src/
│   ├── features/       # 機能単位のコンポーネント・フック
│   ├── lib/            # APIクライアント・アルゴリズム・共通ロジック
│   ├── pages/          # ルーティング対応ページ
│   ├── types/          # 型定義・Zodスキーマ
│   └── utils/          # ユーティリティ関数
├── schema.sql          # D1 データベーススキーマ
└── wrangler.toml       # Cloudflare 設定
```

---

ユーザー向けの操作マニュアルは [USER_MANUAL.md](USER_MANUAL.md) を参照してください。
