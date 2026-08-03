import Link from 'next/link';
import { fetchDay, todayJST, type ApiRace } from '@/lib/kyotei-api';
import { stadiumName } from '@/lib/stadiums';

// 開催中のレースは日中に随時更新されるため、ビルド時の静的化を避けて毎回サーバーで取得する
export const dynamic = 'force-dynamic';

function formatDateJST(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

interface StadiumToday {
  stadiumNumber: number;
  title: string;
  dayNumber: number | null;
  raceNumbers: number[];
}

function groupByStadium(races: ApiRace[]): StadiumToday[] {
  const byStadium = new Map<number, ApiRace[]>();
  for (const race of races) {
    const list = byStadium.get(race.stadium_number) ?? [];
    list.push(race);
    byStadium.set(race.stadium_number, list);
  }

  return Array.from(byStadium.entries())
    .map(([stadiumNumber, list]) => {
      list.sort((a, b) => a.race_number - b.race_number);
      const rep = list[0];
      return {
        stadiumNumber,
        title: rep.title ?? rep.subtitle ?? '-',
        dayNumber: rep.day_number,
        raceNumbers: list.map((r) => r.race_number),
      };
    })
    .sort((a, b) => a.stadiumNumber - b.stadiumNumber);
}

export default async function Home() {
  const date = todayJST();
  const races = await fetchDay(date);
  const stadiums = groupByStadium(races);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#1995AD]">本日のレース</h1>
          <p className="text-sm text-gray-500">{formatDateJST(date)}</p>
        </div>
        <Link
          href="/stadiums"
          className="px-4 py-2 rounded-lg bg-[#1995AD] text-white font-medium hover:bg-[#147A91] transition-colors"
        >
          競艇場別データ分析 →
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#1995AD] text-white">
              <th className="px-3 py-2 text-left">競艇場</th>
              <th className="px-3 py-2 text-left">レース名</th>
              <th className="px-3 py-2 text-left">開催日</th>
              <th className="px-3 py-2 text-left">レース</th>
            </tr>
          </thead>
          <tbody>
            {stadiums.map((s, i) => (
              <tr key={s.stadiumNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
                <td className="px-3 py-2 font-medium">{stadiumName(s.stadiumNumber)}</td>
                <td className="px-3 py-2">{s.title}</td>
                <td className="px-3 py-2">{s.dayNumber ? `${s.dayNumber}日目` : '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {s.raceNumbers.map((n) => (
                      <Link
                        key={n}
                        href={`/today/${s.stadiumNumber}/${n}`}
                        className="w-7 h-7 flex items-center justify-center rounded bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#1995AD] hover:text-white text-xs font-medium transition-colors"
                      >
                        {n}
                      </Link>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {stadiums.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                  本日開催のレースはありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
