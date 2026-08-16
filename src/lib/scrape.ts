// boatrace.jp 公式サイトの直接スクレイピング（BoatraceOpenAPIに含まれないデータ用）
// robots.txtは全許可 (`Disallow:` のみ) を確認済み。ページ構造変化に備え、
// 想定したtd列が見つからない行は静かにスキップする。
import * as cheerio from 'cheerio';
import { jcdParam } from './stadiums';

export interface PointRankEntry {
  rank: number | null;
  racerNumber: number;
  pointRate: number | null;
  points: number | null;
  deduction: number | null;
}

export interface PrecheckEntry {
  rank: number | null;
  racerNumber: number;
  motorNumber: number | null;
  motorTop2Rate: number | null;
  boatNumber: number | null;
  boatTop2Rate: number | null;
  precheckTime: number | null;
}

export interface RaceResultEntry {
  entryNumber: number;
  racerNumber: number;
  raceTime: number | null; // 秒（例: 1'52"1 → 112.1）
}

function toNumber(text: string | undefined): number | null {
  if (!text) return null;
  const n = parseFloat(text.replace(/[%\s]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function racerNumberFromCell($: cheerio.CheerioAPI, td: ReturnType<cheerio.CheerioAPI>): number | null {
  const href = td.find('a').attr('href') ?? '';
  const match = href.match(/toban=(\d+)/);
  if (match) return Number(match[1]);
  const text = td.text().trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

// 節間得点率一覧 /owpc/pc/race/pointrank?jcd={jcd}&hd={hd}
export async function fetchPointRank(stadiumNumber: number, hd: string): Promise<PointRankEntry[]> {
  const url = `https://www.boatrace.jp/owpc/pc/race/pointrank?jcd=${jcdParam(stadiumNumber)}&hd=${hd}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`pointrank取得失敗: ${res.status} (${url})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const entries: PointRankEntry[] = [];
  $('.table1 table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 8) return; // 想定外の行構造はスキップ

    const rank = toNumber($(tds[0]).text());
    const racerNumber = racerNumberFromCell($, $(tds[1]));
    if (racerNumber === null) return;

    entries.push({
      rank,
      racerNumber,
      pointRate: toNumber($(tds[4]).text()),
      points: toNumber($(tds[6]).text()),
      deduction: toNumber($(tds[7]).text()),
    });
  });
  return entries;
}

// モーター/ボート成績・前検タイム /owpc/pc/race/rankingmotor?jcd={jcd}&hd={hd}
export async function fetchPrecheck(stadiumNumber: number, hd: string): Promise<PrecheckEntry[]> {
  const url = `https://www.boatrace.jp/owpc/pc/race/rankingmotor?jcd=${jcdParam(stadiumNumber)}&hd=${hd}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`rankingmotor取得失敗: ${res.status} (${url})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const entries: PrecheckEntry[] = [];
  $('.table1 table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 9) return; // 想定外の行構造はスキップ

    const rank = toNumber($(tds[0]).text());
    const racerNumber = racerNumberFromCell($, $(tds[1]));
    if (racerNumber === null) return;

    entries.push({
      rank,
      racerNumber,
      motorNumber: toNumber($(tds[4]).text()),
      motorTop2Rate: toNumber($(tds[5]).text()),
      boatNumber: toNumber($(tds[6]).text()),
      boatTop2Rate: toNumber($(tds[7]).text()),
      precheckTime: toNumber($(tds[8]).text()),
    });
  });
  return entries;
}

// レースタイム（例: 1'52"1）を秒に変換
function parseRaceTime(text: string): number | null {
  const m = text.trim().match(/^(\d+)'(\d+)"(\d)$/);
  if (!m) return null;
  const [, min, sec, deci] = m;
  return Number(min) * 60 + Number(sec) + Number(deci) / 10;
}

// レース結果 /owpc/pc/race/raceresult?rno={rno}&jcd={jcd}&hd={hd}
export async function fetchRaceResult(
  stadiumNumber: number,
  raceNumber: number,
  hd: string
): Promise<RaceResultEntry[]> {
  const url = `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${raceNumber}&jcd=${jcdParam(stadiumNumber)}&hd=${hd}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`raceresult取得失敗: ${res.status} (${url})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const entries: RaceResultEntry[] = [];
  $('table.is-w495 tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return; // 想定外の行構造（中止レース等）はスキップ

    const entryNumber = toNumber($(tds[1]).text());
    const racerNumber = toNumber($(tds[2]).find('span').first().text());
    if (entryNumber === null || racerNumber === null) return;

    entries.push({
      entryNumber,
      racerNumber,
      raceTime: parseRaceTime($(tds[3]).text()),
    });
  });
  return entries;
}
