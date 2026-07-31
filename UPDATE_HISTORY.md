# Web-Attendance 更新履歴

Web-Attendanceの主な機能追加と変更内容を、バージョンごとに掲載しています。

[GitHubリポジトリ](https://github.com/naganuma-tsutomu/Web-Attendance) / [リリース一覧](https://github.com/naganuma-tsutomu/Web-Attendance/releases)

## v2.7.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.7.0)

- **自動配置を1人1日1シフトに統一**: 時間帯やクラスが異なる場合でも、同じスタッフが同じ日に複数のシフトへ自動配置されないようになりました。配置可能なスタッフが不足する枠は「未割当」として生成されます
- **当番番号の重複・欠番を解消**: 手動番号と自動番号が重なる場合、同じクラス内の残りのスタッフへ未使用番号が自動的に再配分され、常に `1～人数` の一意な連番で表示されるようになりました
- **当番番号表示の統一**: 日ビュー、モバイル編集画面、Excel出力で共通の番号計算を使用し、スタッフ表示順を基準とした同じ番号が表示されるようになりました
- **当番番号リセットの修正**: 手動設定した番号を自動番号へ戻した変更が正しく保存されるようになりました
- **月単位の一括ロック操作を追加**: その月にシフトがある日をまとめてロックする「全ロック」と、その月のロックをまとめて解除する「全解除」を追加しました
- **シフト消去時のロック選択を追加**: 通常はロック済みシフトを保持し、確認画面のチェックボックスからロック済みシフトも含めて削除できるようになりました。含めて削除した場合はロックも同時に解除されます

## v2.6.1

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.6.1)

- 自動生成後に、生成枠数・未割当・スタッフ別の目標時間差分・クラス別充足率を確認できるレポートを追加しました
- 直近の生成レポートを再表示するボタンと、自動表示設定を追加しました

## v2.5.1

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.5.1)

- 月表示カレンダーでロック操作時にセルが一瞬再描画される問題を修正しました
- ナビゲーションボタンやドラッグハンドルのアクセシビリティを改善しました

## v2.5.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.5.0)

- 同じ日・同じクラスで、保存済み当番番号が重複することを防止しました
- 当番番号をリセットした際の競合解消処理を改善しました

## v2.4.2

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.4.2)

- Excel出力をクラス順、当番番号順で並べるようにしました
- クラスと勤務時間パターンの変更が、他の画面へ即時反映されるようにしました

## v2.4.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.4.0)

- 当番番号機能、1番のローテーション対象区分、クラス間の自動スワップを追加しました
- クラス管理画面を刷新し、ヘルプクラスの自動割り当てを修正しました
- PWAと更新通知に対応しました
- 設定保存後の反映と各設定画面の表示を改善しました

## v2.3.2

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.3.2)

- 営業時間の30分単位設定と、土曜日専用ローテーションパターンに対応しました
- スタッフ用設定画面にダークモード切り替えを追加しました
- iOSを含むスマートフォン向けの入力・表示を改善しました

## v2.3.1

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.3.1)

- スタッフ向けシフト確認画面の日付ナビゲーションを改善しました
- 管理者による希望休の保存と「提出済み」の切り替えを分離しました
- モバイル画面とExcel出力の表示を修正しました

## v2.3.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.3.0)

- 固定休日の表示、日付ピッカー、表示設定の保存方法を改善しました
- スタッフのログインセッションをHttpOnly Cookie方式に変更しました
- 早番・遅番のローテーション設定を追加しました
- 休憩時間の自動計算と実労働時間表示を追加しました

## v2.2.1

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.2.1)

- ボタン、週ビュー、日ビューの操作性を改善しました
- アクセスキー再発行時の警告を追加しました
- 各設定画面のデザインとモバイル表示を統一しました
- ユーザーマニュアル内のページ内ナビゲーションを追加しました

## v2.1.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.1.0)

- スタッフのアクセスキーを6桁へ変更しました
- Excel出力とExcel出力設定を改善しました
- 月間カレンダーなどのモバイル表示を改善しました
- PDF出力を一時停止しました

## v2.0.0

[GitHubリリース](https://github.com/naganuma-tsutomu/Web-Attendance/releases/tag/v2.0.0)

- スタッフ用ポータルと希望休申請機能を追加しました
- 営業時間・休館日設定、シフト確定、スタッフ向けタイムラインを追加しました
- 役職名を「スタッフ区分」に統一しました
