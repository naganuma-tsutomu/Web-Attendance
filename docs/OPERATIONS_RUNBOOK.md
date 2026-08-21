# 運用・障害対応Runbook

最終確認日: 2026-08-04

## 1. 対象環境

| 環境 | D1データベース | 用途 |
|---|---|---|
| 本番 | `web-attendance-restored-db` | 利用者向け環境 |
| preview | `web-attendance-preview-db` | リリース前確認 |

本番操作では、コマンド実行前に対象DB名とCloudflareアカウントを二人で確認する。ローカル検証には必ず `--local` を付け、本番DB名だけを根拠に接続先を判断しない。

## 2. 監視項目と初期基準

認証はCloudflare Rate Limitingを外側の防御として使い、アプリケーション側でもD1に失敗回数を記録する。管理者は送信元IP単位、スタッフは送信元IPと氏名単位で、10分間に10回失敗すると15分間ログインを拒否する。拒否時はHTTP 429と`Retry-After`を返す。Cloudflare側の設定を省略する理由にはならない。

基準は運用開始後4週間の実測値を基に見直す。

| 監視項目 | 警告 | 緊急 | 確認場所 |
|---|---:|---:|---|
| Functionsのエラー率 | 5分間で1%以上 | 5分間で5%以上 | Workers & PagesのMetrics |
| 連続ログイン失敗 | 同一IPまたは利用者で10回/10分 | 広範囲で急増 | Rate Limitingイベント、Functionsログ |
| D1クエリ応答時間 | 平常時の2倍が15分継続 | タイムアウトまたは書込み失敗 | D1 Metrics |
| D1 rows read/written | 前週同時間帯の3倍 | 上限接近または急増継続 | D1 Metrics |
| シフト置換API | 500が1回以上 | 複数利用者で失敗 | Functionsログ、監査ログ |
| フロント例外 | 同一例外が5回/15分 | 主要画面が利用不能 | 導入済み例外監視サービス |

最低限、平日は始業前と終業後に本番のFunctionsエラー、D1書込み失敗、ログイン失敗を確認する。通知サービスが未導入の場合、この手動確認を省略しない。

## 3. ログ確認

Cloudflare Dashboardでは `Workers & Pages` → 対象Pagesプロジェクト → 対象deployment → `View details` → `Functions` から確認する。

リアルタイム確認:

```bash
npx wrangler pages deployment tail
```

Pages Functionsのストリーミングログは永続保存されない。障害調査に必要なイベントは、発生日時、request ID、対象API、HTTPステータス、例外名をインシデント記録へ転記する。アクセスキー、Cookie、パスワード、完全なリクエスト本文は記録しない。

## 4. 日常点検

### データ整合性

以下がすべて0件であることを確認する。

```sql
SELECT COUNT(*) AS orphan_shifts
FROM shifts s LEFT JOIN staffs st ON st.id = s.staffId
WHERE st.id IS NULL;

SELECT date, classType, duty_number, COUNT(*) AS count
FROM shifts
WHERE duty_number IS NOT NULL
GROUP BY date, classType, duty_number
HAVING count > 1;

SELECT access_key, COUNT(*) AS count
FROM staffs
WHERE access_key IS NOT NULL
GROUP BY access_key
HAVING count > 1;
```

本番での確認例:

```bash
npx wrangler d1 execute web-attendance-restored-db --remote --command "SELECT COUNT(*) AS orphan_shifts FROM shifts s LEFT JOIN staffs st ON st.id = s.staffId WHERE st.id IS NULL;"
```

### D1メトリクス

D1 DashboardのMetricsでクエリ数、rows read、rows written、クエリ時間、DBサイズを週1回確認する。急増した場合は対象時間帯のFunctionsログと直近リリースを照合する。

## 5. インシデント対応

1. 発生時刻、影響画面、対象月、操作内容を記録する。
2. デプロイ、設定変更、マイグレーションを停止する。
3. FunctionsのエラーとD1メトリクスを確認する。
4. 読取り障害か書込み障害か、単一利用者か全体かを切り分ける。
5. データ破損の疑いがある場合は対象機能の利用を止め、現在のD1ブックマークを記録する。
6. 復旧後、データ整合性SQLと主要操作のスモークテストを行う。
7. 原因、影響、復旧時刻、再発防止策を記録する。

目標値は暫定でRPO 1分以内、RTO 4時間以内とする。契約プラン、Time Travel保持期間、通知体制を確認したうえで正式決定する。

## 6. D1 Time Travelによる復旧

D1のTime Travelは自動的に有効だが、復旧可能期間は契約プランに依存する。復元は本番DBをその場で上書きし、実行中のクエリも中断するため、必ず責任者の承認を得る。

### 事前確認

```bash
npx wrangler d1 info web-attendance-restored-db
npx wrangler d1 time-travel info web-attendance-restored-db
npx wrangler d1 time-travel info web-attendance-restored-db --timestamp="2026-08-04T12:00:00+09:00"
```

1. `d1 info` のストレージバージョンと対象DBを確認する。
2. 現在のブックマークをインシデント記録へ保存する。これは復元取消しに必要となる。
3. 障害発生直前のtimestampから復元先ブックマークを取得する。
4. 影響時間帯に正常な更新がないか監査ログで確認する。
5. 利用者へメンテナンス開始を通知する。

### 復元

以下はプレースホルダーを実値に置き換え、対象と承認を再確認してから手動実行する。

```bash
npx wrangler d1 time-travel restore web-attendance-restored-db --bookmark=RESTORE_BOOKMARK
```

復元後は、スタッフ数、対象月シフト数、固定日数、孤児シフト、当番番号重複、直近監査ログを確認する。誤った時点へ復元した場合は、事前に保存した現在ブックマークへ復元して取り消す。

## 7. リリースと復元訓練

- リリース前: CI成功、previewの主要操作、Rate Limitingスモークテストを確認する。
- リリース直後: Functionsエラー、D1書込み、ログイン、シフト保存を確認する。
- 四半期ごと: previewまたは検証用DBで復元訓練を行い、所要時間と不足手順を記録する。
- スキーマ変更前: 現在ブックマーク、適用SQL、ロールバック判断基準を記録する。

監査ログとアプリ内シフトスナップショットは、正式な保持期間と削除承認者が決まるまで自動削除しない。Time Travel期間を超える長期保管が必要な場合は、D1のR2エクスポート等を別途設計する。

## 8. 公式資料

- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare D1 Metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Cloudflare Pages Functions logging](https://developers.cloudflare.com/pages/functions/debugging-and-logging/)
- [Cloudflare Workers metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
