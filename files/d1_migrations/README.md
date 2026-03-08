# Cloudflare D1 マイグレーションガイド

Web-Attendanceアプリ用のCloudflare D1データベースマイグレーションファイルです。

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `001_shift_requirements.sql` | shift_requirementsテーブル作成 |
| `002_holidays.sql` | holidaysテーブル作成 + 2025-2026年祝日データ |

## PostgreSQLからの変更点

| 項目 | PostgreSQL | D1/SQLite |
|-----|------------|-----------|
| UUID型 | `UUID` | `TEXT` |
| タイムスタンプ | `TIMESTAMPTZ` | `TEXT` (ISO 8601形式) |
| トリガー | `CREATE TRIGGER` | 非対応（アプリレベルで実装） |
| RLS | `CREATE POLICY` | 非対応（アプリレベルで実装） |

## 実行手順

### ローカル環境でテスト

```bash
wrangler d1 execute web-attendance-db --local --file=files/d1_migrations/001_shift_requirements.sql
wrangler d1 execute web-attendance-db --local --file=files/d1_migrations/002_holidays.sql
```

### 本番環境（remote）に適用

```bash
wrangler d1 execute web-attendance-db --remote --file=files/d1_migrations/001_shift_requirements.sql
wrangler d1 execute web-attendance-db --remote --file=files/d1_migrations/002_holidays.sql
```

## 注意事項

1. **トリガー非対応**: D1では`updated_at`自動更新用のトリガーが使えません。アプリケーション側でUPDATE時に`updated_at = datetime('now')`を設定してください。

2. **RLS非対応**: Row Level SecurityはD1でサポートされていません。認証・認可はアプリケーションレベル（Honoのミドルウェアなど）で実装してください。

3. **UUID生成**: D1には`gen_random_uuid()`関数がありません。アプリケーション側でUUIDを生成してINSERTしてください。

## 参考リンク

- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [SQLite データ型](https://www.sqlite.org/datatype3.html)
