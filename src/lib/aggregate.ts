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

export async function getRacerNames(racerNumbers: number[]): Promise<Map<number, string>> {
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

// 分析情報ページ用: レーサーの全国横断の出走履歴（進入コース・着順・決まり手・ST/展示タイムとその順位）を返す
interface CourseHistoryEntry {
  date: string;
  course: number | null;
  place: number | null;
  technique: number | null;
  startTiming: number | null;
  startRank: number | null;
  exhibitionRank: number | null;
}

function monthsAgoISO(months: number): string {
  const nowJSTMs = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(nowJSTMs);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

// 「前期」= 11/1〜翌4/30。現時点で直近に完了している前期の期間を返す。
function getPreviousZenkiRange(): { start: string; end: string } {
  const nowJSTMs = Date.now() + 9 * 60 * 60 * 1000;
  const now = new Date(nowJSTMs);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1-12

  if (m >= 5 && m <= 10) {
    // 後期中（5〜10月）: 直近の前期は 前年11/1〜当年4/30
    return { start: `${y - 1}-11-01`, end: `${y}-04-30` };
  } else if (m >= 11) {
    // 前期中（11〜12月）: 進行中の前期はまだ完了していないため、直近の完了済み前期は前年11/1〜当年4/30
    return { start: `${y - 1}-11-01`, end: `${y}-04-30` };
  } else {
    // 前期中（1〜4月）: 進行中の前期はまだ完了していないため、直近の完了済み前期は前々年11/1〜前年4/30
    return { start: `${y - 2}-11-01`, end: `${y - 1}-04-30` };
  }
}

async function getRacerCourseHistory(
  racerNumbers: number[],
  sinceDate: string
): Promise<Map<number, CourseHistoryEntry[]>> {
  const result = new Map<number, CourseHistoryEntry[]>();
  if (racerNumbers.length === 0) return result;

  // races をstadium×dateの組み合わせで別途取得すると、行数上限（PostgRESTのdefault max rows）に
  // 引っかかって大半のレースが欠落する（stadiumNumbers×datesの組み合わせが実質全レース分に膨らむため）。
  // races側の複合FKでrace_entriesにネスト取得することで、必要な行数（entriesと同数）だけに絞る。
  const { data: entries, error: entryError } = await supabase
    .from('race_entries')
    .select(
      'date, stadium_number, race_number, racer_number, course_number, place_number, start_timing, start_rank, exhibition_rank, races(technique_number)'
    )
    .in('racer_number', racerNumbers)
    .gte('date', sinceDate)
    .order('date', { ascending: false })
    .limit(5000);
  if (entryError) throw new Error(`race_entries取得失敗: ${entryError.message}`);
  if (!entries || entries.length === 0) return result;

  interface EntryWithTechnique {
    date: string;
    racer_number: number;
    course_number: number | null;
    place_number: number | null;
    start_timing: number | null;
    start_rank: number | null;
    exhibition_rank: number | null;
    races: { technique_number: number | null } | null;
  }

  for (const e of entries as unknown as EntryWithTechnique[]) {
    const list = result.get(e.racer_number) ?? [];
    list.push({
      date: e.date,
      course: e.course_number,
      place: e.place_number,
      technique: e.races?.technique_number ?? null,
      startTiming: e.start_timing,
      startRank: e.start_rank,
      exhibitionRank: e.exhibition_rank,
    });
    result.set(e.racer_number, list);
  }

  return result;
}

// 今節（進行中シリーズ）の1枠以外での最速レースタイムを返す
async function getCurrentSeriesBestRaceTime(
  stadiumNumber: number,
  racerNumbers: number[]
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  for (const rn of racerNumbers) result.set(rn, null);
  if (racerNumbers.length === 0) return result;

  const series = await getActiveSeries(stadiumNumber);
  if (!series) return result;

  const { data, error } = await supabase
    .from('race_entries')
    .select('racer_number, race_time')
    .eq('stadium_number', stadiumNumber)
    .in('racer_number', racerNumbers)
    .gte('date', series.start_date)
    .neq('course_number', 1)
    .not('race_time', 'is', null);
  if (error) throw new Error(`race_entries取得失敗(持ちタイム): ${error.message}`);

  for (const row of data ?? []) {
    const cur = result.get(row.racer_number) ?? null;
    if (row.race_time !== null && (cur === null || row.race_time < cur)) {
      result.set(row.racer_number, row.race_time);
    }
  }
  return result;
}

// 期間内の平均値を計算（endがnullなら上限なし＝今日まで）
function averageInPeriod(
  entries: CourseHistoryEntry[],
  start: string,
  end: string | null,
  field: 'startTiming' | 'startRank'
): number | null {
  const filtered = entries.filter((x) => x.date >= start && (end === null || x.date <= end) && x[field] !== null);
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((s, x) => s + (x[field] as number), 0);
  return sum / filtered.length;
}

export interface ScoreItem {
  entryNumber: number;
  value: number | null;
}

// 6艇の値を比較し、1位2pt・2位1ptを付与する（小数点2桁で比較。1位が同値の場合は両方1位扱いで2位なし）
// ページ側（ポイント詳細テーブルのセル色分け）からも同じ判定ロジックを再利用するためexport
export function scoreTop2(items: ScoreItem[], higherIsBetter: boolean): Map<number, number> {
  const scores = new Map<number, number>();
  for (const it of items) scores.set(it.entryNumber, 0);

  const valid = items
    .filter((it): it is ScoreItem & { value: number } => it.value !== null)
    .map((it) => ({ entryNumber: it.entryNumber, v: Math.round(it.value * 100) / 100 }));
  if (valid.length === 0) return scores;

  valid.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));
  const bestValue = valid[0].v;
  const firstGroup = valid.filter((v) => v.v === bestValue);

  if (firstGroup.length >= 2) {
    for (const v of firstGroup) scores.set(v.entryNumber, 2);
    return scores; // 1位が複数いる場合、2位は不在
  }

  scores.set(firstGroup[0].entryNumber, 2);
  const rest = valid.slice(1);
  if (rest.length > 0) {
    const secondValue = rest[0].v;
    for (const v of rest.filter((r) => r.v === secondValue)) scores.set(v.entryNumber, 1);
  }
  return scores;
}

// 本日のレース情報: 出走6艇の分析情報をまとめて返す
export interface RaceEntryInput {
  entryNumber: number;
  racerNumber: number;
  course: number; // 今日のこのレースでの進入コース（previewがあればそれ、無ければentry_numberで代用）
}

export interface CourseRateStats {
  entries: number;
  top1Count: number;
  top2Count: number;
  top3Count: number;
  top1Rate: number | null;
  top2Rate: number | null;
  top3Rate: number | null;
}

// 1枠は差され/捲られ/捲られ差、2〜6枠は差し/捲り/捲り差（同じフィールドを行の意味だけ変えて使い回す）
export interface TechniqueRateStats {
  rate1: number | null;
  rate2: number | null;
  rate3: number | null;
}

export interface TechniqueCounts {
  nige: number | null; // 1枠のみ
  sashi: number | null; // 2〜6枠のみ
  makuri: number | null;
  makuriSa: number | null;
}

export interface AllCourseTechniqueCounts {
  sashi: number;
  makuri: number;
  makuriSa: number;
}

// 平均ST系4項目（前期・直近6/3/1カ月の4期間で1位2pt・2位1ptを集計、各0〜8点）
export interface StartPointStats {
  avgStartPoint: number; // 平均STポイント（この枠での平均ST）
  avgStartRankPoint: number; // 平均ST順位ポイント（この枠での平均ST順位）
  allCourseAvgStartPoint: number; // 全枠順平均STポイント（全枠での平均ST）
  allCourseAvgStartRankPoint: number; // 全枠順平均ST順位ポイント（全枠での平均ST順位）
}

// ポイント算出の元になった生値（ポイント詳細テーブル表示用）。期間の並びは [前期, 直近6ヶ月, 直近3ヶ月, 直近1ヶ月]
export interface PointDetail {
  courseAvgST: (number | null)[];
  courseAvgSTRank: (number | null)[];
  allAvgST: (number | null)[];
  allAvgSTRank: (number | null)[];
  exhibitionCount: number;
  exhibitionTop1Rate: number | null;
  exhibitionTop2Rate: number | null;
  exhibitionTop3Rate: number | null;
}

export interface RaceCardAnalysisRow {
  entryNumber: number;
  racerNumber: number;
  name: string;
  course: number;
  motorNumber: number | null;
  motorTop2Rate: number | null;
  boatNumber: number | null;
  boatTop2Rate: number | null;
  frameRate: CourseRateStats;
  techniqueRate: TechniqueRateStats;
  techniqueCounts: TechniqueCounts;
  allCourseTechniqueCounts: AllCourseTechniqueCounts;
  motiTime: number | null; // 持ちタイム（今節・1枠以外での最速レースタイム、秒）
  startPoint: StartPointStats;
  exhibitionTop1Point: number; // 展示タイム勝率ポイント（0〜8点）
  pointDetail: PointDetail;
}

export async function getRaceCardAnalysis(
  stadiumNumber: number,
  entries: RaceEntryInput[]
): Promise<RaceCardAnalysisRow[]> {
  if (entries.length === 0) return [];
  const racerNumbers = entries.map((e) => e.racerNumber);

  const sixMonthsAgo = monthsAgoISO(6);
  const oneYearAgo = monthsAgoISO(12);
  const zenki = getPreviousZenkiRange();
  // 平均ST系ポイントの「前期」期間まで含めて履歴を取得できるよう、取得開始日は前期開始日と直近1年の早い方に合わせる
  const historySinceDate = zenki.start < oneYearAgo ? zenki.start : oneYearAgo;

  const [history, precheck, names, motiTimeMap] = await Promise.all([
    getRacerCourseHistory(racerNumbers, historySinceDate),
    getCurrentSeriesPrecheck(stadiumNumber),
    getRacerNames(racerNumbers),
    getCurrentSeriesBestRaceTime(stadiumNumber, racerNumbers),
  ]);
  const precheckMap = new Map(precheck.rows.map((r) => [r.racerNumber, r]));

  // 平均ST系4項目: 前期・直近6/3カ月・直近1カ月の4期間で、出走6艇を比較して1位2pt・2位1ptを集計
  const periods: { start: string; end: string | null }[] = [
    zenki,
    { start: sixMonthsAgo, end: null },
    { start: monthsAgoISO(3), end: null },
    { start: monthsAgoISO(1), end: null },
  ];

  const periodAverages = entries.map((e) => {
    const h = history.get(e.racerNumber) ?? [];
    const courseHist = h.filter((x) => x.course === e.course);
    return {
      entryNumber: e.entryNumber,
      courseAvgST: periods.map((p) => averageInPeriod(courseHist, p.start, p.end, 'startTiming')),
      courseAvgSTRank: periods.map((p) => averageInPeriod(courseHist, p.start, p.end, 'startRank')),
      allAvgST: periods.map((p) => averageInPeriod(h, p.start, p.end, 'startTiming')),
      allAvgSTRank: periods.map((p) => averageInPeriod(h, p.start, p.end, 'startRank')),
    };
  });

  function sumPointsAcrossPeriods(
    periodIndices: number[],
    getValue: (idx: number, periodIdx: number) => number | null
  ): Map<number, number> {
    const total = new Map<number, number>();
    for (const r of periodAverages) total.set(r.entryNumber, 0);
    for (const periodIdx of periodIndices) {
      const items = periodAverages.map((r, idx) => ({ entryNumber: r.entryNumber, value: getValue(idx, periodIdx) }));
      const scores = scoreTop2(items, false); // ST・ST順位は小さいほど良い
      for (const [entryNumber, pt] of scores) total.set(entryNumber, (total.get(entryNumber) ?? 0) + pt);
    }
    return total;
  }

  // periods配列のインデックス: 0=前期, 1=直近6ヶ月, 2=直近3ヶ月, 3=直近1ヶ月
  const avgStartPoints = sumPointsAcrossPeriods([0, 1, 2, 3], (idx, p) => periodAverages[idx].courseAvgST[p]);
  const avgStartRankPoints = sumPointsAcrossPeriods([0, 1, 2, 3], (idx, p) => periodAverages[idx].courseAvgSTRank[p]);
  // 全枠順平均STポイントは前期・直近3ヶ月・直近1ヶ月の3期間（直近6ヶ月は含めない）
  const allCourseAvgStartPoints = sumPointsAcrossPeriods([0, 2, 3], (idx, p) => periodAverages[idx].allAvgST[p]);
  // 全枠順平均ST順位ポイントは直近3ヶ月・直近1ヶ月の2期間のみ
  const allCourseAvgStartRankPoints = sumPointsAcrossPeriods([2, 3], (idx, p) => periodAverages[idx].allAvgSTRank[p]);

  // 展示タイム一位勝率ポイント: 直近1年で展示タイムが出走6艇中1位だったレースに絞り、
  // 1位回数・1着率・2連対率・3連対率の4項目で出走6艇を比較して1位2pt・2位1ptを集計
  const exhibitionTop1Stats = entries.map((e) => {
    const h = history.get(e.racerNumber) ?? [];
    const top1Races = h.filter((x) => x.date >= oneYearAgo && x.exhibitionRank === 1);
    const count = top1Races.length;
    return {
      entryNumber: e.entryNumber,
      count,
      top1Rate: count > 0 ? top1Races.filter((x) => x.place === 1).length / count : null,
      top2Rate: count > 0 ? top1Races.filter((x) => x.place !== null && x.place <= 2).length / count : null,
      top3Rate: count > 0 ? top1Races.filter((x) => x.place !== null && x.place <= 3).length / count : null,
    };
  });

  function scoreExhibitionMetric(getValue: (x: (typeof exhibitionTop1Stats)[number]) => number | null): Map<number, number> {
    return scoreTop2(
      exhibitionTop1Stats.map((x) => ({ entryNumber: x.entryNumber, value: getValue(x) })),
      true // 回数・各種連対率は大きいほど良い
    );
  }
  const exhibitionCountScores = scoreExhibitionMetric((x) => x.count);
  const exhibitionTop1Scores = scoreExhibitionMetric((x) => x.top1Rate);
  const exhibitionTop2Scores = scoreExhibitionMetric((x) => x.top2Rate);
  const exhibitionTop3Scores = scoreExhibitionMetric((x) => x.top3Rate);

  return entries.map((e, idx) => {
    const h = history.get(e.racerNumber) ?? [];
    const pk = precheckMap.get(e.racerNumber);

    const courseSixMonth = h.filter((x) => x.course === e.course && x.date >= sixMonthsAgo);
    const courseOneYear = h.filter((x) => x.course === e.course && x.date >= oneYearAgo);
    const allSixMonth = h.filter((x) => x.date >= sixMonthsAgo);
    const frameEntries = courseSixMonth.length;
    const frameTop1Count = courseSixMonth.filter((x) => x.place === 1).length;
    const frameTop2Count = courseSixMonth.filter((x) => x.place === 2).length;
    const frameTop3Count = courseSixMonth.filter((x) => x.place === 3).length;

    const frameRate: CourseRateStats = {
      entries: frameEntries,
      top1Count: frameTop1Count,
      top2Count: frameTop2Count,
      top3Count: frameTop3Count,
      top1Rate: frameEntries > 0 ? frameTop1Count / frameEntries : null,
      top2Rate: frameEntries > 0 ? frameTop2Count / frameEntries : null,
      top3Rate: frameEntries > 0 ? frameTop3Count / frameEntries : null,
    };

    let techniqueRate: TechniqueRateStats;
    if (frameEntries === 0) {
      techniqueRate = { rate1: null, rate2: null, rate3: null };
    } else if (e.course === 1) {
      techniqueRate = {
        rate1: courseSixMonth.filter((x) => x.technique === 2).length / frameEntries,
        rate2: courseSixMonth.filter((x) => x.technique === 3).length / frameEntries,
        rate3: courseSixMonth.filter((x) => x.technique === 4).length / frameEntries,
      };
    } else {
      const wins = courseSixMonth.filter((x) => x.place === 1);
      techniqueRate = {
        rate1: wins.filter((x) => x.technique === 2).length / frameEntries,
        rate2: wins.filter((x) => x.technique === 3).length / frameEntries,
        rate3: wins.filter((x) => x.technique === 4).length / frameEntries,
      };
    }

    const winsOneYear = courseOneYear.filter((x) => x.place === 1);
    const techniqueCounts: TechniqueCounts =
      e.course === 1
        ? {
            nige: winsOneYear.filter((x) => x.technique === 1).length,
            sashi: null,
            makuri: null,
            makuriSa: null,
          }
        : {
            nige: null,
            sashi: winsOneYear.filter((x) => x.technique === 2).length,
            makuri: winsOneYear.filter((x) => x.technique === 3).length,
            makuriSa: winsOneYear.filter((x) => x.technique === 4).length,
          };

    const allWinsSixMonth = allSixMonth.filter((x) => x.place === 1);
    const allCourseTechniqueCounts: AllCourseTechniqueCounts = {
      sashi: allWinsSixMonth.filter((x) => x.technique === 2).length,
      makuri: allWinsSixMonth.filter((x) => x.technique === 3).length,
      makuriSa: allWinsSixMonth.filter((x) => x.technique === 4).length,
    };

    return {
      entryNumber: e.entryNumber,
      racerNumber: e.racerNumber,
      name: names.get(e.racerNumber) ?? `登録番号${e.racerNumber}`,
      course: e.course,
      motorNumber: pk?.motorNumber ?? null,
      motorTop2Rate: pk?.motorTop2Rate ?? null,
      boatNumber: pk?.boatNumber ?? null,
      boatTop2Rate: pk?.boatTop2Rate ?? null,
      frameRate,
      techniqueRate,
      techniqueCounts,
      allCourseTechniqueCounts,
      motiTime: motiTimeMap.get(e.racerNumber) ?? null,
      startPoint: {
        avgStartPoint: avgStartPoints.get(e.entryNumber) ?? 0,
        avgStartRankPoint: avgStartRankPoints.get(e.entryNumber) ?? 0,
        allCourseAvgStartPoint: allCourseAvgStartPoints.get(e.entryNumber) ?? 0,
        allCourseAvgStartRankPoint: allCourseAvgStartRankPoints.get(e.entryNumber) ?? 0,
      },
      exhibitionTop1Point:
        (exhibitionCountScores.get(e.entryNumber) ?? 0) +
        (exhibitionTop1Scores.get(e.entryNumber) ?? 0) +
        (exhibitionTop2Scores.get(e.entryNumber) ?? 0) +
        (exhibitionTop3Scores.get(e.entryNumber) ?? 0),
      pointDetail: {
        courseAvgST: periodAverages[idx].courseAvgST,
        courseAvgSTRank: periodAverages[idx].courseAvgSTRank,
        allAvgST: periodAverages[idx].allAvgST,
        allAvgSTRank: periodAverages[idx].allAvgSTRank,
        exhibitionCount: exhibitionTop1Stats[idx].count,
        exhibitionTop1Rate: exhibitionTop1Stats[idx].top1Rate,
        exhibitionTop2Rate: exhibitionTop1Stats[idx].top2Rate,
        exhibitionTop3Rate: exhibitionTop1Stats[idx].top3Rate,
      },
    };
  });
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
