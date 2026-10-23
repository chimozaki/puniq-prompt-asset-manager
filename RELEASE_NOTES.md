# PuniQ Prompt Asset Manager v1.5.1

Released: 2026-10-24

## セキュリティ・表示

- Viteを8.3.5へ更新し、開発用依存関係の既知の脆弱性に対応
- 最終監査で検出したzodのコレクション検証時のメモリ枯渇問題にも対応
- 文字・余白・項目間隔の指定を整理し、画面幅切り替え時のReact警告を解消
- 保存データの形式は変更せず、既存のローカルデータを継続利用

## データ消失・上書き防止

- 保存を直列化し、古い版からの更新を拒否。画像は固有IDで保存して既存画像を上書きしない
- ファイル同期後の置き換え、保存前履歴、破損時の自動上書き停止、履歴からの復元を追加
- 他の送信元・認証情報のないAPI要求を拒否し、保存フォルダの静的配信と画像の物理削除APIを無効化
- ブラウザ保存の失敗をファイル保存から分離。保存状態を表示し、未保存内容・入力途中の内容を書き出せる復旧用ZIPを追加
- 完全削除・初期化後も復旧用画像と保護履歴を保持。従来の画像ファイルを読み込める互換性を維持
- 手順と制約：[DATA_SAFETY.md](DATA_SAFETY.md)

---

# PuniQ Prompt Asset Manager v1.5.0

Released: 2026-09-10

## データ保護

- 削除した資産をゴミ箱へ移動し、個別復元・完全削除・ゴミ箱を空にする操作に対応
- 完全削除時に確認画面を表示し、サムネイル画像も確認後に削除
- CSV / ZIPのインポート前に件数、画像数、重複候補を表示
- インポート方法を「重複を除いて追加」「すべて追加」「現在の一覧を置き換える」から選択可能
- インポート直前の一覧とゴミ箱を1世代退避し、元の状態へ復元可能

## 管理・操作

- 複数選択、一括削除、一括ZIPエクスポートに対応
- 選択項目へのタグ一括追加・削除、お気に入り一括ON / OFFに対応
- 登録フォームを折りたたみ、ギャラリーを広く表示可能。左上のピンクの開閉ボタンは位置を維持
- 滑らかな開閉アニメーション、キーボードフォーカス表示、動きを減らす設定に対応
- デスクトップでは実際の表示位置とウィンドウの高さから入力枠を調整し、下端に余白を確保
- モバイルでは上下方向の開閉アイコンを使用
- サムネイルへマウスを重ねると、最大幅640px・高さ上限70vhの画像プレビューを表示
- プロンプトに含めない「備考」を追加。保存・再編集・新規として保存・検索・一覧表示・CSV/ZIP入出力に対応

## Windows起動

- 標準ポートを5173から4177へ変更し、BATとVite設定を統一
- 黒いサーバー画面のタイトルを `Prompt Asset Manager - Local Server` に変更
- npmによるタイトル上書きを避けるため、BATはViteをNodeから直接起動

## タグ入力

- タグ本体のクリックをコピーに統一
- タグ右側の `×` と入力欄のBackspaceで削除できるよう、説明と実際の操作を一致

## 互換性

- v1.4.0以前のブラウザ保存配列とローカルJSONを自動的に読み込みます。
- 保存データをv2形式へ拡張し、ゴミ箱とインポート前バックアップを追加しました。
- 備考列のない旧CSVも読み込めます。
- 既存の `data` フォルダは継続利用できます。旧 `http://localhost:5173/` のブラウザ内だけにデータがある場合は、[READMEの移行手順](README.md#以前のブラウザからデータを移す)を実施してください。
- ホバー画像には保存済みの縮小画像を使用します。元画像の解像度を復元する変更ではありません。

## English

- Added trash, restore, confirmed permanent deletion, import preview, duplicate handling, and rollback to the pre-import state.
- Added multi-select and bulk deletion, ZIP export, tag editing, and favorite updates.
- Added independent notes with editing, search, card display, and CSV/ZIP round-trip support. Notes are excluded from prompt copy actions; older CSVs remain supported.
- Redesigned the collapsible editor with a pink toggle that stays in place, smooth transitions, keyboard focus styling, and reduced-motion support.
- Desktop editor height follows the available viewport; mobile uses vertical chevrons. Hover previews use existing stored images, capped at 640px wide.
- Changed the default local port to **4177** and the server window title to **Prompt Asset Manager - Local Server**.
- Existing local data files are reused. Browser-only data at the old port 5173 requires the migration procedure in the README.
