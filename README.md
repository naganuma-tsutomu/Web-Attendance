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
