// 6指標の集計ロジック（サーバーコンポーネントから呼び出す）
// データ量がスタジアム単位で高々数千行程度のため、DB側のGROUP BYではなくJS側で集計する。
import { supabase } from './supabase';

interface SeriesRow {
  id: number;
  start_date: string;
  end_date: string | null;
  title: string | null;
}

interface RaceRow {
  date: string;
  race_number: number;
  technique_number: number | null;
}

interface EntryRow {
  date: string;
  race_number: number;
  racer_number: number;
  course_number: number | null;
  start_timing: number | null;
  place_number: number | null;
  exhibition_time: number | null;
}

async function getLastSeries(stadiumNumber: number, limit: number): Promise<SeriesRow[]> {
  const { data, error } = await supabase
    .from('series')
    .select('id, start_date, end_date, title')
    .eq('stadium_number', stadiumNumber)
    .order('start_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`series取得失敗: ${error.message}`);
  return data ?? [];
}

async function getRacesAndEntries(
  stadiumNumber: number,
  seriesIds: number[]
): Promise<{ races: RaceRow[]; entries: EntryRow[] }> {
  if (seriesIds.length === 0) return { races: [], entries: [] };

  const { data: races, error: raceError } = await supabase
    .from('races')
    .select('date, race_number, technique_number')
    .eq('stadium_number', stadiumNumber)
    .in('series_id', seriesIds);
  if (raceError) throw new Error(`races取得失敗: ${raceError.message}`);

  const dates = Array.from(new Set((races ?? []).map((r) => r.date)));
  if (dates.length === 0) return { races: races ?? [], entries: [] };

  const { data: entries, error: entryError } = await supabase
    .from('race_entries')
    .select('date, race_number, racer_number, course_number, start_timing, place_number, exhibition_time')
    .eq('stadium_number', stadiumNumber)
    .in('date', dates);
  if (entryError) throw new Error(`race_entries取得失敗: ${entryError.message}`);

  return { races: races ?? [], entries: entries ?? [] };
}

async function getRacerNames(racerNumbers: number[]): Promise<Map<number, string>> {
  if (racerNumbers.length === 0) return new Map();
  const { data, error } = await supabase
    .from('racers')
    .select('racer_number, name')
    .in('racer_number', Array.from(new Set(racerNumbers)));
  if (error) throw new Error(`racers取得失敗: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.racer_number, r.name]));
}

// 要件1: 直近N場のレーサー別1着率（まくり/差し/まくり差し内訳）
export interface Top1RateRow {
  racerNumber: number;
  name: string;
  entries: number;
  top1Count: number;
  top1Rate: number;
  makuriRate: number;
  sashiRate: number;
  makuriSashiRate: number;
}

export async function getTop1RateByTechnique(stadiumNumber: number, seriesLimit = 10) {
  const series = await getLastSeries(stadiumNumber, seriesLimit);
  const seriesIds = series.map((s) => s.id);
  const { races, entries } = await getRacesAndEntries(stadiumNumber, seriesIds);

  const techMap = new Map<string, number | null>();
  for (const r of races) techMap.set(`${r.date}_${r.race_number}`, r.technique_number);

  interface Acc {
    entries: number;
    top1: number;
    makuri: number;
    sashi: number;
    makuriSashi: number;
  }
  const acc = new Map<number, Acc>();
  for (const e of entries) {
    const a = acc.get(e.racer_number) ?? { entries: 0, top1: 0, makuri: 0, sashi: 0, makuriSashi: 0 };
    a.entries++;
    if (e.place_number === 1) {
      a.top1++;
      const technique = techMap.get(`${e.date}_${e.race_number}`);
      if (technique === 3) a.makuri++;
      else if (technique === 2) a.sashi++;
      else if (technique === 4) a.makuriSashi++;
    }
    acc.set(e.racer_number, a);
  }

  const names = await getRacerNames(Array.from(acc.keys()));
  const rows: Top1RateRow[] = Array.from(acc.entries()).map(([racerNumber, a]) => ({
    racerNumber,
    name: names.get(racerNumber) ?? `登録番号${racerNumber}`,
    entries: a.entries,
    top1Count: a.top1,
    top1Rate: a.entries > 0 ? a.top1 / a.entries : 0,
    makuriRate: a.entries > 0 ? a.makuri / a.entries : 0,
    sashiRate: a.entries > 0 ? a.sashi / a.entries : 0,
    makuriSashiRate: a.entries > 0 ? a.makuriSashi / a.entries : 0,
  }));
  rows.sort((a, b) => b.top1Rate - a.top1Rate);

  return { rows, seriesUsed: series.length, seriesRequested: seriesLimit };
}

// 要件2: 直近N場のレーサー別1着・2着数
export interface PlaceCountRow {
  racerNumber: number;
  name: string;
  entries: number;
  top1Count: number;
  top2Count: number;
}

export async function getPlaceCounts(stadiumNumber: number, seriesLimit = 5) {
  const series = await getLastSeries(stadiumNumber, seriesLimit);
  const seriesIds = series.map((s) => s.id);
  const { entries } = await getRacesAndEntries(stadiumNumber, seriesIds);

  const acc = new Map<number, { entries: number; top1: number; top2: number }>();
  for (const e of entries) {
    const a = acc.get(e.racer_number) ?? { entries: 0, top1: 0, top2: 0 };
    a.entries++;
    if (e.place_number === 1) a.top1++;
    if (e.place_number === 2) a.top2++;
    acc.set(e.racer_number, a);
  }

  const names = await getRacerNames(Array.from(acc.keys()));
  const rows: PlaceCountRow[] = Array.from(acc.entries()).map(([racerNumber, a]) => ({
    racerNumber,
    name: names.get(racerNumber) ?? `登録番号${racerNumber}`,
    entries: a.entries,
    top1Count: a.top1,
    top2Count: a.top2,
  }));
  rows.sort((a, b) => b.top1Count - a.top1Count || b.top2Count - a.top2Count);

  return { rows, seriesUsed: series.length, seriesRequested: seriesLimit };
}

// 要件3・4共通: コース別の平均値（ST or 展示タイム）
export interface CourseAverageRow {
  racerNumber: number;
  name: string;
  courses: Record<number, { average: number; samples: number } | null>; // 1〜6
}

async function getCourseAverage(
  stadiumNumber: number,
  seriesLimit: number,
  field: 'start_timing' | 'exhibition_time'
) {
  const series = await getLastSeries(stadiumNumber, seriesLimit);
  const seriesIds = series.map((s) => s.id);
  const { entries } = await getRacesAndEntries(stadiumNumber, seriesIds);

  const acc = new Map<number, Map<number, { sum: number; count: number }>>();
  for (const e of entries) {
    const value = e[field];
    if (value === null || e.course_number === null) continue;
    if (!acc.has(e.racer_number)) acc.set(e.racer_number, new Map());
    const courseMap = acc.get(e.racer_number)!;
    const cur = courseMap.get(e.course_number) ?? { sum: 0, count: 0 };
    cur.sum += value;
    cur.count += 1;
    courseMap.set(e.course_number, cur);
  }

  const names = await getRacerNames(Array.from(acc.keys()));
  const rows: CourseAverageRow[] = Array.from(acc.entries()).map(([racerNumber, courseMap]) => {
    const courses: CourseAverageRow['courses'] = {};
    for (let c = 1; c <= 6; c++) {
      const v = courseMap.get(c);
      courses[c] = v ? { average: v.sum / v.count, samples: v.count } : null;
    }
    return { racerNumber, name: names.get(racerNumber) ?? `登録番号${racerNumber}`, courses };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return { rows, seriesUsed: series.length, seriesRequested: seriesLimit };
}

// 要件3: 直近N場のレーサー別コース別スタートタイミング
export function getStartTimingByCourse(stadiumNumber: number, seriesLimit = 10) {
  return getCourseAverage(stadiumNumber, seriesLimit, 'start_timing');
}

// 要件4: 直近N場のレーサー別コース別持ちタイム（展示タイム）
export function getExhibitionTimeByCourse(stadiumNumber: number, seriesLimit = 10) {
  return getCourseAverage(stadiumNumber, seriesLimit, 'exhibition_time');
}

async function getActiveSeries(stadiumNumber: number): Promise<SeriesRow | null> {
  const { data, error } = await supabase
    .from('series')
    .select('id, start_date, end_date, title')
    .eq('stadium_number', stadiumNumber)
    .is('end_date', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`series取得失敗: ${error.message}`);
  return data;
}

// 要件5: 今シリーズのレーサー別得点率順位
export interface SeriesPointRankRow {
  racerNumber: number;
  name: string;
  rank: number | null;
  pointRate: number | null;
  points: number | null;
  deduction: number | null;
}

export async function getCurrentSeriesPointRank(stadiumNumber: number) {
  const series = await getActiveSeries(stadiumNumber);
  if (!series) return { rows: [] as SeriesPointRankRow[], series: null };

  const { data, error } = await supabase
    .from('series_point_ranks')
    .select('racer_number, rank_position, points, deduction, point_rate')
    .eq('series_id', series.id)
    .order('rank_position', { ascending: true });
  if (error) throw new Error(`series_point_ranks取得失敗: ${error.message}`);

  const names = await getRacerNames((data ?? []).map((d) => d.racer_number));
  const rows: SeriesPointRankRow[] = (data ?? []).map((d) => ({
    racerNumber: d.racer_number,
    name: names.get(d.racer_number) ?? `登録番号${d.racer_number}`,
    rank: d.rank_position,
    pointRate: d.point_rate,
    points: d.points,
    deduction: d.deduction,
  }));

  return { rows, series };
}

// 要件6: 今シリーズのレーサー別前検タイム
export interface SeriesPrecheckRow {
  racerNumber: number;
  name: string;
  rank: number | null;
  precheckTime: number | null;
  motorNumber: number | null;
  motorTop2Rate: number | null;
  boatNumber: number | null;
  boatTop2Rate: number | null;
}

export async function getCurrentSeriesPrecheck(stadiumNumber: number) {
  const series = await getActiveSeries(stadiumNumber);
  if (!series) return { rows: [] as SeriesPrecheckRow[], series: null };

  const { data, error } = await supabase
    .from('series_precheck')
    .select('racer_number, rank_position, precheck_time, motor_number, motor_top2_rate, boat_number, boat_top2_rate')
    .eq('series_id', series.id)
    .order('rank_position', { ascending: true });
  if (error) throw new Error(`series_precheck取得失敗: ${error.message}`);

  const names = await getRacerNames((data ?? []).map((d) => d.racer_number));
  const rows: SeriesPrecheckRow[] = (data ?? []).map((d) => ({
    racerNumber: d.racer_number,
    name: names.get(d.racer_number) ?? `登録番号${d.racer_number}`,
    rank: d.rank_position,
    precheckTime: d.precheck_time,
    motorNumber: d.motor_number,
    motorTop2Rate: d.motor_top2_rate,
    boatNumber: d.boat_number,
    boatTop2Rate: d.boat_top2_rate,
  }));

  return { rows, series };
}
