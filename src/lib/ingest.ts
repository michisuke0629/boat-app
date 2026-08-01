// BoatraceOpenAPIの1日分データをDBへupsertする共通ロジック
// cron route (src/app/api/cron/sync-day) と scripts/backfill.ts の両方から呼ばれる
import { supabaseAdmin } from './supabase';
import type { ApiRace } from './kyotei-api';

export interface IngestResult {
  date: string;
  raceCount: number;
  seriesOpened: number;
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
    place_number: number | null;
    exhibition_time: number | null;
    updated_at: string;
  }[] = [];

  for (const race of races) {
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
        place_number: resultRacer?.place_number ?? null,
        exhibition_time: previewRacer?.exhibition_time ?? null,
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
