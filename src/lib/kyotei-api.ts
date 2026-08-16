// BoatraceOpenAPI (boatraceopenapi/api, v1) クライアント
// https://github.com/boatraceopenapi/api  対応期間: 2026-01-01以降、JST基準、日次JSON

const BASE_URL = 'https://boatraceopenapi.github.io/api/v1';

export interface ApiRacer {
  entry_number: number;
  name: string;
  number: number;
  rank_number: number | null;
  branch_number: number | null;
}

export interface ApiPreviewRacer {
  entry_number: number;
  course_number: number | null;
  start_timing: number | null;
  exhibition_time: number | null;
}

export interface ApiResultRacer {
  entry_number: number;
  course_number: number | null;
  start_timing: number | null;
  place_number: number | null;
  number: number;
  name: string;
}

export interface ApiRace {
  date: string;
  stadium_number: number;
  race_number: number;
  closed_at: string | null;
  grade_number: number | null;
  title: string | null;
  subtitle: string | null;
  day_number: number | null;
  racers: Record<string, ApiRacer>;
  preview?: {
    racers: Record<string, ApiPreviewRacer>;
  };
  result?: {
    technique_number: number | null;
    racers: Record<string, ApiResultRacer>;
  };
}

interface ApiResponse {
  programs: {
    stadiums: Record<
      string,
      {
        races: Record<string, ApiRace>;
      }
    >;
  };
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// 指定日（JSTの日付、Dateオブジェクトで渡す）の全レースをフラットな配列で返す
export async function fetchDay(date: Date): Promise<ApiRace[]> {
  const yyyymmdd = formatDate(date);
  const year = yyyymmdd.slice(0, 4);
  const url = `${BASE_URL}/${year}/${yyyymmdd}.json`;

  const res = await fetch(url);
  if (res.status === 404) {
    // その日は開催なし、またはデータ未生成
    return [];
  }
  if (!res.ok) {
    throw new Error(`BoatraceOpenAPI取得に失敗しました: ${res.status} ${res.statusText} (${url})`);
  }

  const json: ApiResponse = await res.json();
  const races: ApiRace[] = [];
  for (const stadium of Object.values(json.programs.stadiums ?? {})) {
    for (const race of Object.values(stadium.races ?? {})) {
      races.push(race);
    }
  }
  return races;
}

// JST基準の "今日" をUTC日付として返す
export function todayJST(): Date {
  const nowJSTMs = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(nowJSTMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// closed_at ("2026-08-15 15:17:00") から "HH:mm" を取り出す
export function formatClosedTime(closedAt: string | null): string {
  if (!closedAt) return '-';
  const match = closedAt.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '-';
}
