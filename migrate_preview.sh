#!/bin/bash

# このスクリプトは、すでに存在するカラムによるエラーで
# 全部の追加処理がキャンセル（ロールバック）されるのを防ぐため、
# 1行ずつ個別にリモートDBへカラム追加を実行します。

echo "リモート（プレビュー）DBへ順次カラム追加を実行します..."

echo "1/6: weeklyHoursTarget"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN weeklyHoursTarget REAL;"

echo "2/6: isHelpStaff"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN isHelpStaff INTEGER DEFAULT 0;"

echo "3/6: defaultWorkingHoursStart"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN defaultWorkingHoursStart TEXT;"

echo "4/6: defaultWorkingHoursEnd"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN defaultWorkingHoursEnd TEXT;"

echo "5/6: display_order"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN display_order INTEGER DEFAULT 0;"

echo "6/7: staffs access_key"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE staffs ADD COLUMN access_key TEXT;"

echo "7/8: roles weeklyHoursTarget"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE roles ADD COLUMN weeklyHoursTarget REAL;"

echo "8/8: classes color"
npx wrangler d1 execute web-attendance-preview-db --remote --command="ALTER TABLE classes ADD COLUMN color TEXT DEFAULT '#818cf8';"

echo "最後にその他の新規テーブル作成（schema.sql）を実行します..."
npx wrangler d1 execute web-attendance-preview-db --remote --file=schema.sql

echo "完了しました！ ('duplicate column name' などのエラーが出ても既に追加済みという意味なので全く問題ありません)"
