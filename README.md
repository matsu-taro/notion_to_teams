# Notion to Teams 通知システム

ChatGPTから登録されたNotionの記事を、Microsoft Teamsへ自動通知するCloudflare Workersアプリケーションです。

## 機能

### 週次通知
- 毎週月曜日 9:00 JST に自動実行
- 先週月曜日〜日曜日に3つのNotionデータベース（開発/インフラ/その他）に登録された記事を取得
- すべての記事をTeamsに通知

### 日次ランダム通知
- 毎週月〜金曜日 8:00 JST に自動実行
- 指定したNotionデータベースから全記事を取得し、ランダムに3件を選択
- 選択された3件をTeamsに通知

### その他
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

**週次通知用:**
1. Teamsで通知を受け取りたいチャネルを開く
2. チャネル名の右にある「…」→「コネクタ」をクリック
3. 「Incoming Webhook」を検索して「構成」をクリック
4. 名前を入力して「作成」をクリック
5. 表示されたURLをコピー（これが `TEAMS_WEBHOOK_URL` になります）

**日次ランダム通知用:**
- 上記と同じ手順で、別のチャネル用のWebhook URLを取得（これが `TEAMS_WEBHOOK_URL_DAILY` になります）
- 同じチャネルを使う場合は、同じURLを使用できます

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
wrangler secret put TEAMS_WEBHOOK_URL_DAILY

# 通常の環境変数
wrangler secret put NOTION_DATABASE_ID_DEV
wrangler secret put NOTION_DATABASE_ID_INFRA
wrangler secret put NOTION_DATABASE_ID_OTHER
wrangler secret put NOTION_DATABASE_ID_DAILY
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
crons = ["0 0 * * 2", "0 23 * * 0-4"]
```

- `0 0 * * 2` = 毎週火曜日 0:00 UTC (日本時間 月曜日 9:00) - 週次通知
- `0 23 * * 0-4` = 毎週日〜木曜日 23:00 UTC (日本時間 月〜金曜日 8:00) - 日次ランダム通知

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

**週次通知のテスト:**
```bash
curl https://notion-to-teams-notifier.{your-subdomain}.workers.dev/test-weekly
```

**日次ランダム通知のテスト:**
```bash
curl https://notion-to-teams-notifier.{your-subdomain}.workers.dev/test-daily
```

## 通知の内容

### 週次通知
Teamsには以下の情報が含まれるカードが送信されます:

- 通知期間（先週の月曜日〜日曜日）
- 登録された記事の件数
- 各記事の情報:
  - データベース名（開発/インフラ/その他）
  - タイトル
  - リンク（クリックでNotionページを開く）

### 日次ランダム通知
Teamsには以下の情報が含まれるカードが送信されます:

- 今日の日付
- ランダムに選択された3件の記事情報:
  - タイトル
  - リンク（クリックでNotionページを開く）

## トラブルシューティング

### 記事が取得できない

**週次通知の場合:**
- Notion統合が3つのデータベースすべてに接続されているか確認
- `NOTION_API_KEY` が正しいか確認
- `NOTION_DATABASE_ID_DEV`、`NOTION_DATABASE_ID_INFRA`、`NOTION_DATABASE_ID_OTHER` が正しいか確認

**日次ランダム通知の場合:**
- Notion統合が日次通知用データベースに接続されているか確認
- `NOTION_API_KEY` が正しいか確認
- `NOTION_DATABASE_ID_DAILY` が正しいか確認

### Teamsに通知が届かない

**週次通知の場合:**
- `TEAMS_WEBHOOK_URL` が正しいか確認
- Webhook URLが有効期限切れになっていないか確認
- Teamsのチャネルで通知が許可されているか確認

**日次ランダム通知の場合:**
- `TEAMS_WEBHOOK_URL_DAILY` が正しいか確認
- Webhook URLが有効期限切れになっていないか確認
- Teamsのチャネルで通知が許可されているか確認

### Cronが実行されない

- Cloudflare Dashboardでトリガーが有効になっているか確認
- Workerがデプロイされているか確認
- ログを確認: `npm run tail`

### タイムゾーンの調整

現在のスケジュール:
- 週次通知: 火曜日 0:00 UTC = 日本時間 月曜日 9:00
- 日次通知: 日〜木曜日 23:00 UTC = 日本時間 月〜金曜日 8:00

変更したい場合は `wrangler.toml` の cron 式を編集:
- 週次を日本時間 8:00 に変更 → `0 23 * * 1` (月曜日 23:00 UTC)
- 週次を日本時間 10:00 に変更 → `0 1 * * 2` (火曜日 1:00 UTC)
- 日次を日本時間 9:00 に変更 → `0 0 * * 1-5` (月〜金曜日 0:00 UTC)

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
