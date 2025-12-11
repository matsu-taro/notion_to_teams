# Notion to Teams 週次通知システム

ChatGPTから登録されたNotionの記事を、毎週月曜日9:00にMicrosoft Teamsへ自動通知するCloudflare Workersアプリケーションです。

## 機能

- 毎週月曜日 9:00 JST (0:00 UTC) に自動実行
- 先週月曜日〜日曜日にNotionデータベースに登録された記事を取得
- 記事のタイトル、要約、タグ、リンクをTeamsに通知
- Cloudflare Workersによるサーバーレス実行

## 前提条件

- Node.js (v18以上推奨)
- Cloudflareアカウント
- Notion APIキー
- Teams Webhook URL

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Notion API統合の作成

1. [Notion Integrations](https://www.notion.so/my-integrations) にアクセス
2. 「New integration」をクリック
3. 統合名を入力し、「Submit」をクリック
4. 「Internal Integration Token」をコピー（これが `NOTION_API_KEY` になります）
5. Notionのデータベースページを開き、右上の「…」→「接続」→作成した統合を選択

### 3. Teams Webhook URLの取得

1. Teamsで通知を受け取りたいチャネルを開く
2. チャネル名の右にある「…」→「コネクタ」をクリック
3. 「Incoming Webhook」を検索して「構成」をクリック
4. 名前を入力して「作成」をクリック
5. 表示されたURLをコピー

### 4. 環境変数の設定

#### ローカル開発用

```bash
# .dev.vars.exampleをコピー
cp .dev.vars.example .dev.vars

#### 本番環境用（Cloudflare）

Wranglerコマンドで設定:

```bash
# シークレット変数（暗号化される）
wrangler secret put NOTION_API_KEY
wrangler secret put TEAMS_WEBHOOK_URL

# 通常の環境変数
wrangler secret put NOTION_DATABASE_ID
```

または、Cloudflare Dashboardから設定:
1. Workers & Pages → 作成したWorker → 設定 → 変数
2. 環境変数を追加

## 開発

### ローカルでテスト

```bash
# 開発サーバーを起動
npm run dev

# HTTPエンドポイントにアクセスして手動テスト
curl http://localhost:8787
```

### 本番環境へデプロイ

```bash
# Cloudflareにログイン（初回のみ）
npx wrangler login

# デプロイ
npm run deploy
```

デプロイ後、以下のURLで確認できます:
```
https://notion-to-teams-notifier.{your-subdomain}.workers.dev
```

## スケジュール設定

`wrangler.toml` でCronスケジュールを設定済みです:

```toml
[triggers]
crons = ["0 0 * * 1"]
```

- `0 0 * * 1` = 毎週月曜日 0:00 UTC (日本時間 9:00)

スケジュールを変更したい場合は、[Cron式](https://crontab.guru/)を参考に編集してください。

## テスト

### 手動でスケジュール実行をトリガー

```bash
# ログを確認
npm run tail

# 手動でCronをトリガー（Cloudflare Dashboard経由）
# Workers & Pages → Worker → トリガー → Cron Triggers → 「トリガー」ボタン
```

### HTTPエンドポイントでテスト

```bash
curl https://notion-to-teams-notifier.{your-subdomain}.workers.dev
```

## 通知の内容

Teamsには以下の情報が含まれるカードが送信されます:

- 通知期間（先週の月曜日〜日曜日）
- 登録された記事の件数
- 各記事の情報:
  - タイトル
  - タグ
  - 要約
  - リンク（クリックでNotionページを開く）

## トラブルシューティング

### 記事が取得できない

- Notion統合がデータベースに接続されているか確認
- `NOTION_API_KEY` が正しいか確認
- `NOTION_DATABASE_ID` が正しいか確認

### Teamsに通知が届かない

- `TEAMS_WEBHOOK_URL` が正しいか確認
- Webhook URLが有効期限切れになっていないか確認
- Teamsのチャネルで通知が許可されているか確認

### Cronが実行されない

- Cloudflare Dashboardでトリガーが有効になっているか確認
- Workerがデプロイされているか確認
- ログを確認: `npm run tail`

### タイムゾーンの調整

現在のスケジュールは月曜日 0:00 UTC = 日本時間 9:00 です。

変更したい場合は `wrangler.toml` の cron 式を編集:
- 日本時間 8:00 → `0 23 * * 0` (日曜日 23:00 UTC)
- 日本時間 10:00 → `0 1 * * 1` (月曜日 1:00 UTC)

## プロジェクト構成

```
notion-to-teams/
├── openapi.json          # ChatGPT用のNotion API定義
├── prompt.txt            # ChatGPT用のプロンプト
├── wrangler.toml         # Cloudflare Workers設定
├── package.json          # Node.js依存関係
├── tsconfig.json         # TypeScript設定
├── .dev.vars.example     # 環境変数サンプル
├── .dev.vars            # ローカル環境変数（gitignore済み）
├── .gitignore
├── README.md
└── src/
    └── index.ts          # メインWorkerコード
```

## ライセンス

MIT
