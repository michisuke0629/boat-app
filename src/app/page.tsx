import { Fragment } from 'react';
import Link from 'next/link';
import { fetchDay, todayJST, type ApiRace } from '@/lib/kyotei-api';
import { STADIUMS } from '@/lib/stadiums';

// 開催中のレースは日中に随時更新されるため、ビルド時の静的化を避けて毎回サーバーで取得する
export const dynamic = 'force-dynamic';

const STADIUMS_PER_ROW = 4;

function formatDateJST(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function dayNumberByStadium(races: ApiRace[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const race of races) {
    if (!map.has(race.stadium_number)) {
      map.set(race.stadium_number, race.day_number);
    }
  }
  return map;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function Home() {
  const date = todayJST();
  const races = await fetchDay(date);
  const dayNumbers = dayNumberByStadium(races);
  const rows = chunk(STADIUMS, STADIUMS_PER_ROW);

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

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rows.map((row, i) => (
              <Fragment key={i}>
                <tr className={i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}>
                  {row.map((stadium) => {
                    const hasRace = dayNumbers.get(stadium.number) != null;
                    return (
                      <td
                        key={stadium.number}
                        className="border border-gray-200 px-2 py-2 text-center font-bold"
                      >
                        {hasRace ? (
                          <Link href={`/today/${stadium.number}`} className="text-[#1995AD] hover:underline">
                            {stadium.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{stadium.name}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className={i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}>
                  {row.map((stadium) => {
                    const dayNumber = dayNumbers.get(stadium.number) ?? null;
                    const hasRace = dayNumber !== null;
                    return (
                      <td
                        key={stadium.number}
                        className={`border border-gray-200 px-2 py-1.5 text-center text-xs ${
                          hasRace ? 'text-[#1995AD] font-medium' : 'text-gray-400'
                        }`}
                      >
                        {hasRace ? `${dayNumber}日目` : 'ー'}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
