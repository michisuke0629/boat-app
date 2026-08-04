import { fetchDay, todayJST } from '@/lib/kyotei-api';
import { getRaceCardStats, type RaceEntryInput } from '@/lib/aggregate';

function pct(v: number | null): string {
  return v === null ? '-' : `${(v * 100).toFixed(1)}%`;
}

function dec(v: number | null, decimals = 2): string {
  return v === null ? '-' : v.toFixed(decimals);
}

export default async function TodayRacePage({
  params,
}: {
  params: Promise<{ stadiumNumber: string; raceNumber: string }>;
}) {
  const { stadiumNumber, raceNumber } = await params;
  const stadiumNum = Number(stadiumNumber);
  const raceNum = Number(raceNumber);

  const races = await fetchDay(todayJST());
  const race = races.find((r) => r.stadium_number === stadiumNum && r.race_number === raceNum);

  if (!race) {
    return <p className="text-gray-400 py-6 text-center">本日このレースの開催情報がありません</p>;
  }

  const entries: RaceEntryInput[] = Object.entries(race.racers)
    .filter(([, r]) => r.number != null)
    .map(([entryKey, r]) => ({
      entryNumber: Number(entryKey),
      racerNumber: r.number,
    }))
    .sort((a, b) => a.entryNumber - b.entryNumber);

  const rows = await getRaceCardStats(stadiumNum, entries);

  const kyoteibiyoriUrl = `https://kyoteibiyori.com/race_shusso.php?place_no=${stadiumNum}&race_no=${raceNum}&hiduke=${race.date.replace(/-/g, '')}&slider=1`;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="space-y-1">
          {race.subtitle && <p className="text-sm text-gray-500">{race.subtitle}</p>}
          <p className="text-xs text-gray-400">
            1着数・1着率・まくり/差し内訳・出走数・2着数は全競艇場の直近10開催、スタートタイム・持ちタイムは今開催での最速値
          </p>
        </div>
        <a
          href={kyoteibiyoriUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3 py-1.5 rounded text-sm font-medium bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#1995AD] hover:text-white transition-colors"
        >
          コース別全艇成績1着率一覧表（外部） ↗
        </a>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#1995AD] text-white">
              <th className="px-3 py-2 text-center">枠</th>
              <th className="px-3 py-2 text-left">レーサー</th>
              <th className="px-3 py-2 text-center">
                1着数
                <br />
                1着率
              </th>
              <th className="px-3 py-2 text-center">
                まくり率
                <br />
                差し率
                <br />
                まくり差し率
              </th>
              <th className="px-3 py-2 text-center">
                出走数
                <br />
                1着数
                <br />
                2着数
              </th>
              <th className="px-3 py-2 text-center">スタートタイム</th>
              <th className="px-3 py-2 text-center">持ちタイム</th>
              <th className="px-3 py-2 text-center">
                得点率
                <br />
                得点
                <br />
                減点
              </th>
              <th className="px-3 py-2 text-center">前検タイム</th>
              <th className="px-3 py-2 text-center">
                モーターNo.
                <br />
                モーター2連対率
              </th>
              <th className="px-3 py-2 text-center">
                ボートNo.
                <br />
                ボート2連対率
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.entryNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
                <td className="px-3 py-2 text-center font-bold">{r.entryNumber}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-center">
                  {r.top1Count10 ?? '-'}
                  <br />
                  <span className="font-bold text-[#1995AD]">{pct(r.top1Rate10)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {pct(r.makuriRate10)}
                  <br />
                  {pct(r.sashiRate10)}
                  <br />
                  {pct(r.makuriSashiRate10)}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.entries10 ?? '-'}
                  <br />
                  {r.top1Count10 ?? '-'}
                  <br />
                  {r.top2Count10 ?? '-'}
                </td>
                <td className="px-3 py-2 text-center">{dec(r.bestStartTiming)}</td>
                <td className="px-3 py-2 text-center">{dec(r.bestExhibitionTime)}</td>
                <td className="px-3 py-2 text-center">
                  <span className="font-bold text-[#1995AD]">{r.pointRate ?? '-'}</span>
                  <br />
                  {r.points ?? '-'}
                  <br />
                  {r.deduction ?? '-'}
                </td>
                <td className="px-3 py-2 text-center">{r.precheckTime ?? '-'}</td>
                <td className="px-3 py-2 text-center">
                  {r.motorNumber ?? '-'}
                  <br />
                  {r.motorTop2Rate ?? '-'}%
                </td>
                <td className="px-3 py-2 text-center">
                  {r.boatNumber ?? '-'}
                  <br />
                  {r.boatTop2Rate ?? '-'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
