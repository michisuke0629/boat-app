import Link from 'next/link';
import { fetchDay, formatClosedTime, todayJST } from '@/lib/kyotei-api';
import { laneColorStyle } from '@/lib/laneColors';

export default async function TodayStadiumPage({
  params,
}: {
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const num = Number(stadiumNumber);

  const races = await fetchDay(todayJST());
  const stadiumRaces = races
    .filter((r) => r.stadium_number === num)
    .sort((a, b) => a.race_number - b.race_number);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {stadiumRaces.map((race) => (
          <a
            key={race.race_number}
            href={`#race-${race.race_number}`}
            className="w-10 h-9 flex items-center justify-center rounded text-sm font-medium bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#1995AD] hover:text-white transition-colors"
          >
            {race.race_number}R
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {stadiumRaces.map((race) => {
          const racers = Object.entries(race.racers)
            .filter(([, r]) => r.number != null)
            .map(([entryKey, r]) => ({ entryNumber: Number(entryKey), name: r.name }))
            .sort((a, b) => a.entryNumber - b.entryNumber);

          return (
            <div
              key={race.race_number}
              id={`race-${race.race_number}`}
              className="bg-white rounded-lg shadow-md p-4 space-y-3 scroll-mt-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-[#1995AD]">{race.race_number}R</h2>
                <span className="text-sm text-gray-500">締切 {formatClosedTime(race.closed_at)}</span>
                <Link
                  href={`/today/${num}/${race.race_number}`}
                  className="px-3 py-1.5 rounded text-sm font-medium bg-[#1995AD] text-white hover:bg-[#147A91] transition-colors"
                >
                  分析情報を見る →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {racers.map((r) => (
                        <th
                          key={r.entryNumber}
                          className="border border-gray-200 px-1 py-1.5 text-center font-bold w-12"
                          style={laneColorStyle(r.entryNumber)}
                        >
                          {r.entryNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {racers.map((r) => (
                        <td key={r.entryNumber} className="border border-gray-200 px-1 py-1.5 text-center whitespace-nowrap">
                          {r.name}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {stadiumRaces.length === 0 && (
          <p className="text-gray-400 py-6 text-center">本日このレース場の開催情報がありません</p>
        )}
      </div>
    </div>
  );
}
