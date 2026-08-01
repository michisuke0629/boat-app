// 初回バックフィル用スクリプト（ローカルから一度だけ手動実行する）
// 2026-01-01（BoatraceOpenAPI対応開始日）〜前日までの日次データをraces/race_entries/racersに投入する
// 実行: npx tsx scripts/backfill.ts [開始日 YYYY-MM-DD] [終了日 YYYY-MM-DD]
import { fetchDay } from '../src/lib/kyotei-api';
import { ingestDay } from '../src/lib/ingest';

const API_START_DATE = '2026-01-01';

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const startArg = process.argv[2] ?? API_START_DATE;
  const yesterday = addDays(new Date().toISOString().slice(0, 10), -1);
  const endArg = process.argv[3] ?? yesterday;

  console.log(`バックフィル範囲: ${startArg} 〜 ${endArg}`);

  let date = startArg;
  let successCount = 0;
  let errorCount = 0;

  while (date <= endArg) {
    try {
      const races = await fetchDay(new Date(`${date}T00:00:00Z`));
      const result = await ingestDay(races, date);
      console.log(`${date}: ${result.raceCount}レース取込 (シリーズ新規${result.seriesOpened}件)`);
      successCount++;
    } catch (err) {
      console.error(`${date}: 失敗 - ${err instanceof Error ? err.message : err}`);
      errorCount++;
    }
    date = addDays(date, 1);
    await sleep(150); // GitHub Pagesへの過度なリクエストを避ける
  }

  console.log(`完了: 成功${successCount}日 / 失敗${errorCount}日`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
