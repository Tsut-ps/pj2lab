もしかして：[UtaFormatix](https://sdercolin.github.io/utaformatix3/) でlab使える形式とかに変換かましたほうがよいかも  
（VoiSona形式とかはタイミング情報をテキスト出力することができます）

一応実験的ですが、サイトは残しています。

# pj2lab-vite

<img width="1731" height="990" alt="image" src="https://github.com/user-attachments/assets/668a7ee3-d92f-4f63-a47e-12565e594a8d" />

Synthesizer V の `.svp` と VOCALOID の `.vpr` を、音声処理で使いやすい `.lab` テキストへ変換する Web ツールです。  
ブラウザだけで動作し、ファイルを外部サーバーへアップロードせずに利用できます。

## できること

- Synthesizer V の `.svp` を `.lab` へ変換
- VOCALOID の `.vpr` を `.lab` へ変換
- 明示 `phonemes` / `phoneme` があるノートは、その内容を優先してそのまま使用
- 明示音素がないノートは、`lyrics` から日本語音素を推定
- 長音記号 (`ー`, `-`) の母音展開
- 変換警告の表示
- 変換結果のプレビューと `.lab` ダウンロード

## 対応状況

### 入力形式

- Synthesizer V: `.svp`
- VOCALOID: `.vpr`

### 変換ルール

- `phonemes` / `phoneme` がある場合
  - 原文をそのまま使います
  - 空白で分割するだけで、変換テーブルで置き換えません
- 明示音素がない場合
  - `lyrics` から日本語音素を推定します
- `rap` ノートは変換対象から除外します

## 音素長の扱い

### Synthesizer V (`.svp`)

- ノート全体の長さはテンポに基づいて秒へ変換します
- `note.attributes.dur` があれば、その比率でノート内の音素長を配分します
- `dur` の要素が足りない場合や無効値は `100% (= 1.0)` 扱いです

### VOCALOID (`.vpr`)

- ノート全体の長さは `pos` / `duration` から変換します
- 現在は `.vpr` 内に SVP の `dur` に相当する「音素ごとの長さ配列」は使っていません
- そのため、1 ノート内の複数音素は現状では均等割りです
- 特殊な音素記号が使われている場合はそのままです
	- これを避けたい場合、VoiSona などで変換して lab ファイルを書き出すことを推奨します

## 使い方

### 1. 入力形式を選ぶ

- `Synthesizer V`
- `VOCALOID`

入力形式を切り替えると、選択済みファイルと変換結果はリセットされます。

### 2. ファイルを選ぶ

- `.svp` または `.vpr` をドラッグ&ドロップ
- またはクリックして選択

### 3. 変換設定を選ぶ

- 変換モード
  - `音素を推定する`
    - 明示 phoneme があれば優先
    - なければ `lyrics` から推定
  - `lyrics をそのまま出力`
    - ノートごとの歌詞をそのまま出力する確認用モード
- 追加オプション
  - `長音記号を前の母音で展開`
- 音素の出力単位
  - `音素ごとに分割`
  - `ノート単位で結合`

### 4. 変換して確認する

- `変換する` を押して結果を生成
- `lab プレビュー` と `警告` を確認
- 問題なければ `ダウンロード` を押す

## 出力ファイル名

出力名は次の形式で生成されます。

```text
{元ファイル名}_{mode}_{output}.lab
```

例:

- `song_inferred_split.lab`
- `song_inferred_combined.lab`
- `song_raw_lyrics_split.lab`

## クイックスタート

### 必要環境

- Node.js 24 以上を推奨
- npm

### インストール

```bash
npm install
```

### 開発サーバー

```bash
npm run dev
```

### 本番ビルド

```bash
npm run build
```

### ビルド結果の確認

```bash
npm run preview
```

## プロジェクト構成

```text
src/
  App.tsx                         # UI 本体
  converter.ts                    # 変換の入口（SVP / VPR -> LAB）
  converterTiming.ts              # テンポ処理
  converterPhonemes.ts            # 歌詞からの音素推定
  converter/
    converterProject.ts           # .svp / .vpr の読み込みと共通形式化
    converterSegments.ts          # LAB セグメント生成
    converterUnits.ts             # phoneme 優先 / lyrics 推定の分岐
```

## 制限事項

- `.svp` は JSON として読み込みます
- `.vpr` は現在、`Project/sequence.json` を含む形式を前提にしています
- `.vpr` は今のところ「無圧縮 ZIP」のみ対応です
- `.vpr` では音素ごとの長さ情報は直接扱っていないため、複数音素は均等割りになります
- 想定外のデータ構造ではエラーになることがあります

## トラブルシューティング

### 変換ボタンが押せない

- 入力形式とファイル拡張子が合っているか確認してください
- ファイルを選択したあと、設定変更で結果が古くなっていないか確認してください

### VOCALOID の変換でエラーになる

- `.vpr` が無圧縮 ZIP 形式か確認してください
- `Project/sequence.json` を含む通常の VPR か確認してください

### 警告が多い

- `lyrics` に特殊記号が含まれていないか確認してください
- 必要に応じて `lyrics をそのまま出力` で差分確認してください

## ライセンス

MIT License
