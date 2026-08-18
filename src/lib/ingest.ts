// BoatraceOpenAPIの1日分データをDBへupsertする共通ロジック
// cron route (src/app/api/cron/sync-day) と scripts/backfill.ts の両方から呼ばれる
import { supabaseAdmin } from './supabase';
import type { ApiRace } from './kyotei-api';
import { fetchRaceResult } from './scrape';

export interface IngestResult {
  date: string;
  raceCount: number;
  seriesOpened: number;
}

// レース内の値を比較して順位を返す（1が最良=値が最小、null/未計測は順位なし）
function computeRankMap(valuesByKey: Record<string, number | null>): Record<string, number | null> {
  const ranked = Object.entries(valuesByKey).filter((e): e is [string, number] => e[1] !== null);
  ranked.sort((a, b) => a[1] - b[1]);
  const result: Record<string, number | null> = {};
  for (const key of Object.keys(valuesByKey)) result[key] = null;
  ranked.forEach(([key], i) => {
    result[key] = i + 1;
  });
  return result;
}

export async function ingestDay(races: ApiRace[], date: string): Promise<IngestResult> {
  if (races.length === 0) {
    return { date, raceCount: 0, seriesOpened: 0 };
  }

  // 選手マスタをupsert（重複はracer_numberで自然にまとまる）
  const racerMap = new Map<number, { racer_number: number; name: string; rank_number: number | null; branch_number: number | null }>();
  for (const race of races) {
    for (const r of Object.values(race.racers)) {
      if (r.number == null) continue; // 中止レース等で選手情報が空のエントリーはスキップ
      racerMap.set(r.number, {
        racer_number: r.number,
        name: r.name,
        rank_number: r.rank_number,
        branch_number: r.branch_number,
      });
    }
  }
  if (racerMap.size > 0) {
    const { error } = await supabaseAdmin
      .from('racers')
      .upsert(
        Array.from(racerMap.values()).map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'racer_number' }
      );
    if (error) throw new Error(`racers upsert失敗: ${error.message}`);
  }

  // シリーズ（節）検出: day_number === 1 のスタジアムは新シリーズ開始とみなす
  let seriesOpened = 0;
  const stadiumsStartingToday = new Map<number, string | null>(); // stadium_number -> title
  for (const race of races) {
    if (race.day_number === 1) {
      stadiumsStartingToday.set(race.stadium_number, race.title);
    }
  }

  for (const [stadiumNumber, title] of stadiumsStartingToday) {
    // 同一開始日のシリーズが既にあればスキップ（同日中に複数回ingestされるケース）
    const { data: existing } = await supabaseAdmin
      .from('series')
      .select('id')
      .eq('stadium_number', stadiumNumber)
      .eq('start_date', date)
      .maybeSingle();
    if (existing) continue;

    // 直前の進行中シリーズを前日付けで終了させる
    await supabaseAdmin
      .from('series')
      .update({ end_date: addDays(date, -1) })
      .eq('stadium_number', stadiumNumber)
      .is('end_date', null);

    const { error: seriesError } = await supabaseAdmin
      .from('series')
      .insert({ stadium_number: stadiumNumber, start_date: date, title });
    if (seriesError) throw new Error(`series作成失敗: ${seriesError.message}`);
    seriesOpened++;
  }

  // 各スタジアムの「現在進行中のシリーズ」を引いてraces行に紐付ける
  const stadiumNumbers = Array.from(new Set(races.map((r) => r.stadium_number)));
  const seriesIdByStadium = new Map<number, number | null>();
  for (const stadiumNumber of stadiumNumbers) {
    const { data } = await supabaseAdmin
      .from('series')
      .select('id')
      .eq('stadium_number', stadiumNumber)
      .lte('start_date', date)
      .or(`end_date.is.null,end_date.gte.${date}`)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    seriesIdByStadium.set(stadiumNumber, data?.id ?? null);
  }

  // races をupsert
  const raceRows = races.map((race) => ({
    date: race.date,
    stadium_number: race.stadium_number,
    race_number: race.race_number,
    day_number: race.day_number,
    title: race.title,
    subtitle: race.subtitle,
    grade_number: race.grade_number,
    technique_number: race.result?.technique_number ?? null,
    series_id: seriesIdByStadium.get(race.stadium_number) ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error: raceError } = await supabaseAdmin
    .from('races')
    .upsert(raceRows, { onConflict: 'date,stadium_number,race_number' });
  if (raceError) throw new Error(`races upsert失敗: ${raceError.message}`);

  // race_entries をupsert（programsの出走 + previewの展示タイム + resultの着順/ST/進入コースをマージ）
  const entryRows: {
    date: string;
    stadium_number: number;
    race_number: number;
    entry_number: number;
    racer_number: number;
    course_number: number | null;
    start_timing: number | null;
    start_rank: number | null;
    place_number: number | null;
    exhibition_time: number | null;
    exhibition_rank: number | null;
    updated_at: string;
  }[] = [];

  for (const race of races) {
    // レース内（同じ6艇）でのスタート順位・展示タイム順位を算出するため、先に全艇分の値を集める
    const startTimingByKey: Record<string, number | null> = {};
    const exhibitionTimeByKey: Record<string, number | null> = {};
    for (const [entryKey, programRacer] of Object.entries(race.racers)) {
      if (programRacer.number == null) continue;
      startTimingByKey[entryKey] = race.result?.racers[entryKey]?.start_timing ?? null;
      exhibitionTimeByKey[entryKey] = race.preview?.racers[entryKey]?.exhibition_time ?? null;
    }
    const startRankByKey = computeRankMap(startTimingByKey);
    const exhibitionRankByKey = computeRankMap(exhibitionTimeByKey);

    for (const [entryKey, programRacer] of Object.entries(race.racers)) {
      if (programRacer.number == null) continue; // 中止レース等で選手情報が空のエントリーはスキップ
      const entryNumber = Number(entryKey);
      const previewRacer = race.preview?.racers[entryKey];
      const resultRacer = race.result?.racers[entryKey];

      entryRows.push({
        date: race.date,
        stadium_number: race.stadium_number,
        race_number: race.race_number,
        entry_number: entryNumber,
        racer_number: programRacer.number,
        course_number: resultRacer?.course_number ?? previewRacer?.course_number ?? null,
        start_timing: resultRacer?.start_timing ?? null,
        start_rank: startRankByKey[entryKey] ?? null,
        place_number: resultRacer?.place_number ?? null,
        exhibition_time: previewRacer?.exhibition_time ?? null,
        exhibition_rank: exhibitionRankByKey[entryKey] ?? null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (entryRows.length > 0) {
    const { error: entryError } = await supabaseAdmin
      .from('race_entries')
      .upsert(entryRows, { onConflict: 'date,stadium_number,race_number,entry_number' });
    if (entryError) throw new Error(`race_entries upsert失敗: ${entryError.message}`);
  }

  return { date, raceCount: races.length, seriesOpened };
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface BackfillRaceTimesResult {
  attempted: number;
  errorCount: number;
  remainingBefore: number; // このバッチの処理を始める前に残っていた未取得件数（レース単位）
}

// レースタイムはBoatraceOpenAPIに含まれないため、boatrace.jpのレース結果ページを別途スクレイピングして補完する。
// 1日分をまとめて処理すると件数が多い日（100レース超）にVercelのmaxDuration(60秒)を超えてしまうため、
// 着順確定済み(place_number有)なのにrace_time未取得のレースを日付降順（直近優先）でlimit件だけ拾って処理する。
// レースタイム機能導入前の過去分も含めて未取得件数が数万件あるため、直近のデータから先に埋めていく。
// sync-race-timesジョブから高頻度で呼び出し、複数回に分けて取りこぼしを解消する想定。
export async function backfillRaceTimes(limit: number): Promise<BackfillRaceTimesResult> {
  const { count: remainingBefore } = await supabaseAdmin
    .from('race_entries')
    .select('date, stadium_number, race_number', { count: 'exact', head: true })
    .not('place_number', 'is', null)
    .is('race_time', null);

  // 1レース最大6エントリーなので、limit件のレースを賄うのに十分な行数を余裕を持って取得する
  const { data, error: fetchError } = await supabaseAdmin
    .from('race_entries')
    .select('date, stadium_number, race_number')
    .not('place_number', 'is', null)
    .is('race_time', null)
    .order('date', { ascending: false })
    .limit(limit * 6);
  if (fetchError) throw new Error(`race_entries取得失敗: ${fetchError.message}`);

  const raceMap = new Map<string, { date: string; stadium_number: number; race_number: number }>();
  for (const row of data ?? []) {
    const key = `${row.date}_${row.stadium_number}_${row.race_number}`;
    if (!raceMap.has(key)) raceMap.set(key, row);
  }
  const targets = Array.from(raceMap.values()).slice(0, limit);

  const CONCURRENCY = 6;
  const queue = [...targets];
  let errorCount = 0;

  async function worker() {
    while (queue.length > 0) {
      const race = queue.shift();
      if (!race) break;
      try {
        const hd = race.date.replace(/-/g, '');
        const results = await fetchRaceResult(race.stadium_number, race.race_number, hd);
        if (results.length === 0) continue;
        const { error } = await supabaseAdmin.from('race_entries').upsert(
          results.map((r) => ({
            date: race.date,
            stadium_number: race.stadium_number,
            race_number: race.race_number,
            entry_number: r.entryNumber,
            racer_number: r.racerNumber,
            race_time: r.raceTime,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'date,stadium_number,race_number,entry_number' }
        );
        if (error) throw new Error(error.message);
      } catch {
        // ページ構造変化・未確定・タイムアウト等で失敗しても他のレースの処理は継続する
        errorCount++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { attempted: targets.length, errorCount, remainingBefore: remainingBefore ?? 0 };
}
