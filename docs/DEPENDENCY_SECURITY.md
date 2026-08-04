# 依存関係セキュリティ監査

最終確認日: 2026-08-04

## 運用方針

- CIで本番依存のcritical脆弱性を拒否する。
- `npm audit fix --force` は使用しない。メジャー変更や意図しないダウングレードは個別に検証する。
- high以下もリリース時に確認し、安全な上流修正版が出た時点で更新する。
- 例外は利用経路と影響を確認し、この文書へ理由と再確認条件を記録する。

## 現在の監査結果

通常の `npm audit fix` と直接依存の更新後:

- 全依存: 10件（critical 0件）
- 本番依存: 4件（high 2件、moderate 2件、critical 0件）

### React Router

`react-router@7.18.2` にRSC ModeのCSRF警告が残る。本アプリは`BrowserRouter`を使う静的SPAであり、RSC、Framework ModeのAction、サーバー側ルート実行を使用していないため、該当経路は現状存在しない。

監査ツールが提案する自動修正は旧版への変更で、別の既知問題を再導入する可能性があるため適用しない。React Router 8系への移行は破壊的変更として別途検証する。

再確認条件:

- RSCまたはサーバー側Actionを導入するとき
- React Routerに互換性のある修正版が公開されたとき
- ルーティング構成を変更するとき

### ExcelJS配下のuuid

`exceljs@4.4.0` が`uuid@8.3.2`を含むため警告される。アドバイザリの対象はバッファを渡すv3/v5/v6だが、ExcelJS内の利用箇所は条件付き書式ID生成の`uuid.v4()`であり、対象APIを使用していない。

監査ツールの提案はExcelJS 3.4.0へのダウングレードであるため適用しない。ExcelJSの互換修正版または代替ライブラリが利用可能になった時点で再評価する。

## 確認コマンド

```bash
npm audit
npm audit --omit=dev
npm audit --omit=dev --audit-level=critical
```
