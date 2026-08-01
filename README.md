# 競艇データ分析

24競艇場 × 6指標のマトリクスから、レーサー別の成績データを閲覧できるアプリ。

- 決まり手別1着率・1着2着数・コース別ST・コース別持ちタイム: [BoatraceOpenAPI](https://github.com/boatraceopenapi/api)（2026-01-01以降の日次データ）を蓄積して集計
- 今シリーズの得点率順位・前検タイム: boatrace.jp公式サイトを直接スクレイピング

## セットアップ

### 1. Supabaseプロジェクト作成

1. [Supabase](https://supabase.com)で新規プロジェクトを作成
2. SQL Editorで `supabase/schema.sql` を実行してテーブルを作成
3. Project Settings > API Keys から以下を取得:
   - **Project URL**（API URL）
   - **Publishable key**（旧: `anon` key。RLS配下の公開読取用）
   - **Secret keys**（旧: `service_role` key。RLSをバイパスする。**絶対にクライアントに露出させない**）

   ※ 2026年末に旧anon/service_roleキーは廃止予定。新旧どちらの形式でもコードはそのまま動く。
   ※ Project URLは末尾に`/rest/v1/`等を付けず、`https://xxxx.supabase.co`の形のまま使う（supabase-jsが内部でパスを付与する）。

### 2. 環境変数設定

`.env.local.example` を `.env.local` にコピーして値を埋める。

```bash
cp .env.local.example .env.local
```

### 3. 開発サーバー起動

```bash
npm install
npm run dev
```

### 4. 初回バックフィル（過去データの一括取込）

`.env.local` に値を入れた状態で一度だけ実行する。2026-01-01〜前日までの日次データをDBに投入する（数分〜十数分かかる想定）。

```bash
npx tsx scripts/backfill.ts
```

日付範囲を指定する場合:

```bash
npx tsx scripts/backfill.ts 2026-01-01 2026-06-30
```

### 5. Vercelへデプロイ

1. GitHubリポジトリ作成・push
2. Vercelでプロジェクトをimportし、環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET`）を設定してデプロイ

### 6. GitHub Actionsによる定期取込の設定

リポジトリの Settings > Secrets and variables > Actions で以下を設定:

- `APP_URL`: デプロイ後のVercel URL（例: `https://xxx.vercel.app`）
- `CRON_SECRET`: Vercelの環境変数と同じ値

`.github/workflows/cron.yml` が1日数回、`sync-day`（レース結果取込）と`sync-series-stats`（得点率・前検タイム取込）を自動実行する。

## データに関する制約

- BoatraceOpenAPIは2026-01-01以降のデータしか提供していないため、サービス開始直後は「直近10場」等の指標が指定場数に届かない競艇場がある（画面上に注記表示）。
- 得点率・前検タイムはスクレイピングのため過去分は遡れず、稼働開始後に開催されたシリーズから蓄積される。
- boatrace.jpのページ構造が変わるとスクレイピングが失敗する可能性がある（`sync-series-stats`は1スタジアムの失敗が他に波及しないようtry/catchしている）。

## 技術構成

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (Postgres)。デザインは `sumo-app` を踏襲。
