import Link from 'next/link';
import { getTodayRaces } from '@/lib/today';
import { stadiumName } from '@/lib/stadiums';

// 日付に依存するため、ビルド時の静的化を避けリクエストごとに最新の本日データを取得する
export const dynamic = 'force-dynamic';

const RACE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

export default async function TodayPage() {
  const stadiumRaces = await getTodayRaces();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1995AD]">本日のレース</h1>

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#1995AD] text-white">
              <th className="px-3 py-2 text-left sticky left-0 bg-[#1995AD] z-10">競艇場</th>
              <th className="px-3 py-2 text-left">レース名</th>
              <th className="px-3 py-2 text-center">開催日</th>
              {RACE_NUMBERS.map((n) => (
                <th key={n} className="px-3 py-2 text-center">
                  {n}R
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stadiumRaces.map((s, i) => (
              <tr key={s.stadiumNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
                <td className="px-3 py-2 font-medium sticky left-0 bg-inherit">{stadiumName(s.stadiumNumber)}</td>
                <td className="px-3 py-2">{s.title ?? '-'}</td>
                <td className="px-3 py-2 text-center">{s.dayNumber != null ? `${s.dayNumber}日目` : '-'}</td>
                {RACE_NUMBERS.map((n) => (
                  <td key={n} className="px-3 py-2 text-center">
                    {s.raceNumbers.includes(n) ? (
                      <Link
                        href={`/today/${s.stadiumNumber}/${n}`}
                        className="text-[#1995AD] hover:text-[#147A91] hover:underline"
                      >
                        {n}
                      </Link>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {stadiumRaces.length === 0 && (
              <tr>
                <td colSpan={3 + RACE_NUMBERS.length} className="px-3 py-6 text-center text-gray-400">
                  本日開催しているレースがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
