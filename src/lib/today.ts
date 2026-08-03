// 本日開催のレース情報取得（BoatraceOpenAPIをその日の分だけまとめて取得）
import { fetchDay, todayJST, type ApiRace } from './kyotei-api';

export interface TodayStadiumRaces {
  stadiumNumber: number;
  title: string | null;
  dayNumber: number | null;
  raceNumbers: number[];
}

// 本日開催中の全競艇場・レース番号一覧（本日のレース画面用）
export async function getTodayRaces(): Promise<TodayStadiumRaces[]> {
  const races = await fetchDay(todayJST());

  const byStadium = new Map<number, ApiRace[]>();
  for (const race of races) {
    const list = byStadium.get(race.stadium_number) ?? [];
    list.push(race);
    byStadium.set(race.stadium_number, list);
  }

  const result: TodayStadiumRaces[] = Array.from(byStadium.entries()).map(([stadiumNumber, list]) => {
    list.sort((a, b) => a.race_number - b.race_number);
    return {
      stadiumNumber,
      title: list[0].title,
      dayNumber: list[0].day_number,
      raceNumbers: list.map((r) => r.race_number),
    };
  });
  result.sort((a, b) => a.stadiumNumber - b.stadiumNumber);

  return result;
}

// 指定した競艇場の本日のレース一覧（レース情報画面のレース切替タブ用）
export async function getTodayStadiumRaces(stadiumNumber: number): Promise<ApiRace[]> {
  const races = await fetchDay(todayJST());
  return races
    .filter((r) => r.stadium_number === stadiumNumber)
    .sort((a, b) => a.race_number - b.race_number);
}
