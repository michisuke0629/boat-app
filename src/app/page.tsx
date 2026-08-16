import Link from 'next/link';
import { fetchDay, todayJST, type ApiRace } from '@/lib/kyotei-api';
import { STADIUMS } from '@/lib/stadiums';

// 開催中のレースは日中に随時更新されるため、ビルド時の静的化を避けて毎回サーバーで取得する
export const dynamic = 'force-dynamic';

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

export default async function Home() {
  const date = todayJST();
  const races = await fetchDay(date);
  const dayNumbers = dayNumberByStadium(races);

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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {STADIUMS.map((stadium) => {
          const dayNumber = dayNumbers.get(stadium.number) ?? null;
          const hasRace = dayNumber !== null;
          const content = (
            <>
              <div className="font-bold text-lg">{stadium.name}</div>
              <div className={hasRace ? 'text-[#1995AD] font-medium' : 'text-gray-400'}>
                {hasRace ? `${dayNumber}日目` : 'ー'}
              </div>
            </>
          );

          return hasRace ? (
            <Link
              key={stadium.number}
              href={`/today/${stadium.number}`}
              className="bg-white rounded-lg shadow-md px-3 py-3 text-center hover:shadow-lg hover:bg-[#A1D6ED]/20 transition-all"
            >
              {content}
            </Link>
          ) : (
            <div
              key={stadium.number}
              className="bg-white/60 rounded-lg shadow-sm px-3 py-3 text-center text-gray-400"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
