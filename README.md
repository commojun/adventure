# アドベンチャーゲーム

Googleスプレッドシートで管理可能なビジュアルノベル風アドベンチャーゲーム

## 特徴

- **データドリブン設計**: Googleスプレッドシートで台本を管理
- **ビジュアルノベル風UI**: キャラクター立ち絵とテキストボックス
- **文字送り演出**: テキストが1文字ずつ表示される（クリック・スペースバーでスキップ可能）
- **豊富な演出**: スライド、振動、フェード、背景転換など
- **選択肢システム**: ストーリー分岐に対応
- **進行度表示**: シナリオの進行度をリアルタイムで表示
- **レスポンシブデザイン**: 4K・フルHDなど様々な解像度に対応（VW単位）
- **簡単インポート**: Golangスクリプトで自動変換

## プロジェクト構成

```
adventure/
├── index.html              # メインゲーム画面
├── css/
│   └── style.css          # スタイルシート
├── js/
│   └── game.js            # ゲームエンジン
├── data/
│   ├── title.json         # タイトル設定
│   ├── characters.json    # キャラクターマスタ
│   └── scenario.json      # シナリオデータ
├── assets/
│   └── images/
│       ├── characters/    # キャラクター画像
│       └── backgrounds/   # 背景画像
└── tools/
    ├── import.go          # インポートスクリプト
    ├── go.mod
    └── .envrc.example     # direnv設定サンプル
```

## クイックスタート

### 1. ゲームの起動

ローカルサーバーを起動してゲームを実行：

```bash
# Pythonを使用する場合
python3 -m http.server 8000

# Node.jsを使用する場合
npx http-server
```

ブラウザで `http://localhost:8000` を開く

### 2. Googleスプレッドシートの準備

スプレッドシートを作成し、以下の4つのシートを用意：

#### シート1: `title` (タイトル設定)

| title | background |
|-------|------------|
| アドベンチャーゲーム | assets/images/backgrounds/title.jpg |

**カラム説明:**
- `title`: ゲームのタイトル（タイトル画面に表示）
- `background`: タイトル画面の背景画像のパス

**注意:** このシートはオプションです。存在しない場合はデフォルトのタイトルが使用されます。

#### シート2: `characters` (キャラクターマスタ)

| id | name | image_path |
|----|------|------------|
| char001 | 太郎 | assets/images/characters/taro.png |
| char002 | 花子 | assets/images/characters/hanako.png |
| char003 | 次郎 | assets/images/characters/jiro.png |

**カラム説明:**
- `id`: キャラクターの一意なID
- `name`: キャラクター名（画面に表示）
- `image_path`: 立ち絵画像のパス

#### シート3: `scenarios` (シナリオ)

| scene_id | type | character_id | text | position | effect | background | next_scene |
|----------|------|--------------|------|----------|--------|------------|------------|
|  | dialogue | char001 | こんにちは！ | center | slide | assets/images/backgrounds/classroom.jpg |  |
|  | dialogue | char002 | 元気？ | left | shake | - |  |
|  | hide_character | - | | center | slide | - |  |
| question1 | choice | - | | - | - | - |  |

**カラム説明:**
- `scene_id`: シーンの一意なID（**通常は空欄でOK**）
  - 選択肢を表示するシーン（`type: choice`）には必須
  - 選択肢の分岐先になるシーンにも設定が必要
  - 順次進行するシーンでは空欄のまま
- `type`: シーンタイプ
  - `dialogue`：台詞表示
  - `choice`：選択肢表示
  - `hide_character`：キャラクター非表示
- `character_id`: 話すキャラクターのID（ナレーションや`hide_character`の場合は`-`）
- `text`: 表示するテキスト（`hide_character`の場合は空欄）
- `position`: キャラクター位置（left/center/right）
  - `hide_character`の場合、非表示にするキャラクターの位置を指定
- `effect`: 演出効果（詳細は後述）
- `background`: 背景画像のパス（変更しない場合は`-`）
- `next_scene`: 次のシーンID（**通常は空欄でOK**）
  - 空欄の場合、次の行のシーンへ自動的に進む
  - 特定のシーンへジャンプしたい場合のみ指定

**シーンタイプ別の使い方:**

**dialogue（台詞）:**
- キャラクターの台詞やナレーションを表示
- `character_id`にキャラクターIDを指定（ナレーションは`-`）
- `text`に表示するテキストを入力

**choice（選択肢）:**
- プレイヤーに選択肢を表示
- `choices`シートで選択肢の内容を定義

**hide_character（キャラクター非表示）:**
- キャラクターを画面から退場させる
- `position`に非表示にするキャラクターの位置（left/center/right）を指定
- `effect`に退場エフェクト（slide/fade）を指定
- クリック不要で自動的に次のシーンへ進む

**演出効果 (effect):**
- `slide`: スライド（登場時はスライドイン、退場時はスライドアウト）
- `shake`: 振動
- `fade`: フェード（登場・退場両方で使用可）
- `-`: 演出なし（即座に表示）

#### シート4: `choices` (選択肢)

| scene_id | choice_text | next_scene |
|----------|-------------|------------|
| question1 | 助ける | help |
| question1 | 見守る | watch |

**カラム説明:**
- `scene_id`: 選択肢を表示するシーンID（scenariosシートのtypeが`choice`のシーンの`scene_id`）
- `choice_text`: 選択肢のテキスト
- `next_scene`: 選択後に進むシーンID（scenariosシートで該当する`scene_id`を持つシーンへジャンプ）

**使用例:**

scenarios シート:
| scene_id | type | character_id | text | position | effect | background | next_scene |
|----------|------|--------------|------|----------|--------|------------|------------|
|  | dialogue | char001 | どうする？ | center | - | - |  |
| question1 | choice | - | | - | - | - |  |
| help | dialogue | char001 | 助けるよ！ | center | - | - | end |
| watch | dialogue | char001 | 見守ろう | center | - | - | end |
| end | dialogue | - | おわり | - | - | - |  |

choices シート:
| scene_id | choice_text | next_scene |
|----------|-------------|------------|
| question1 | 助ける | help |
| question1 | 見守る | watch |

### 3. Google Sheets API の設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Sheets API を有効化
3. サービスアカウントを作成し、JSONキーをダウンロード
4. ダウンロードしたJSONファイルを `tools/credentials.json` として保存
5. スプレッドシートをサービスアカウントのメールアドレスと共有

### 4. インポートスクリプトの実行

#### direnvを使う場合（推奨）

```bash
cd tools

# 環境変数を設定
cp .envrc.example .envrc
# .envrcファイルを編集してSPREADSHEET_IDを設定

# direnvを許可
direnv allow

# 依存関係のインストール
go mod download

# インポート実行（環境変数は自動的に読み込まれる）
go run import.go
```

#### direnvを使わない場合

```bash
cd tools

# 環境変数を設定
cp .envrc.example .envrc
# .envrcファイルを編集してSPREADSHEET_IDを設定

# 依存関係のインストール
go mod download

# インポート実行
export $(grep -v '^#' .envrc | xargs) && go run import.go
```

成功すると `data/characters.json`、`data/scenario.json`、`data/title.json` が生成されます。

## 画像の準備

### キャラクター画像
- パス: `assets/images/characters/`
- 推奨サイズ: 400px × 600px（縦長）
- 形式: PNG（背景透過推奨）

### 背景画像
- パス: `assets/images/backgrounds/`
- 推奨サイズ: 1920px × 1080px
- 形式: JPG または PNG

## タイトル設定のカスタマイズ

タイトル画面のタイトルテキストと背景画像は `data/title.json` で設定できます。

### JSONで直接編集する場合

`data/title.json` を編集：

```json
{
  "title": "あなたのゲームタイトル",
  "background": "assets/images/backgrounds/title.jpg"
}
```

### Googleスプレッドシートで管理する場合

`title` シートを作成し、インポートスクリプトを実行すると自動的に `title.json` が生成されます。

| title | background |
|-------|------------|
| あなたのゲームタイトル | assets/images/backgrounds/title.jpg |

**注意:** 背景画像はグラデーションと重ねて表示されます。画像が見えやすいよう、明るめの画像を推奨します。

## 台本の書き方のコツ

### 基本的な流れ
1. ナレーション（`character_id: -`）でシーンを説明
2. キャラクターを登場させる（`type: dialogue`, `effect: slide`）
3. 会話を進める
4. キャラクターを退場させる（`type: hide_character`, `effect: slide`）
5. 必要に応じて選択肢を配置（`type: choice`）
6. 選択肢後のシーンを `scene_id` で管理

### 演出の使い方

**キャラクター登場:**
```
type: dialogue
effect: slide (または fade)
```

**キャラクター退場:**
```
type: hide_character
position: center  (退場させる位置)
effect: slide (または fade)
```

**驚きや衝撃:**
```
type: dialogue
effect: shake
```

**背景をゆっくり変更:**
```
background: new_bg.jpg  (自動的にフェード)
```

### 選択肢の分岐
```
scene005 (type: choice) → choices シートで選択肢を定義
  → 選択1 → scene006
  → 選択2 → scene010
```

## テキスト表示速度のカスタマイズ

文字送りの速度は `js/game.js` の `GameEngine` クラスで調整できます。

```javascript
// js/game.js の 11行目付近
this.textSpeed = 50; // 1文字あたりの表示速度（ミリ秒）
```

**推奨値:**
- `30` - 速い（テンポ重視）
- `50` - 標準（デフォルト）
- `80` - ゆっくり（読みやすさ重視）

## 操作方法

- **クリック** または **スペースバー**: タイピング中は全文を即座に表示（スキップ）、完了後は次のシーンへ進む
- タイピング中に「▼」は非表示、完了後に表示されます
- スペースバーの長押しは無視されます（連続送りを防止）
- **Rキー**: シナリオデータを再読み込み（デバッグ機能）

## 拡張性

### 新しい演出の追加
`js/game.js` の `EffectManager` クラスにメソッドを追加することで、新しい演出を実装できます。

### BGM/効果音の追加
将来的に対応予定。`scenario.json` に `bgm` や `se` フィールドを追加することで実装可能。

## トラブルシューティング

### ゲームが起動しない
- ブラウザのコンソールでエラーを確認
- `data/characters.json` と `data/scenario.json` が存在するか確認
- ローカルサーバーが起動しているか確認

### インポートが失敗する
- `SPREADSHEET_ID` が正しく設定されているか確認
- `credentials.json` が正しい場所にあるか確認
- スプレッドシートがサービスアカウントと共有されているか確認
- シート名が `characters`, `scenarios`, `choices` になっているか確認

### 画像が表示されない
- 画像ファイルのパスが正しいか確認
- 画像ファイルが実際に存在するか確認
- ブラウザの開発者ツールで404エラーをチェック

## ライセンス

MIT License
