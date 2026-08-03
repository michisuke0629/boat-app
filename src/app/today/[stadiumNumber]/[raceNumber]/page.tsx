import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTodayStadiumRaces } from '@/lib/today';
import { stadiumName } from '@/lib/stadiums';
import {
  getTop1RateByTechnique,
  getPlaceCounts,
  getStartTimingByCourse,
  getExhibitionTimeByCourse,
  getCurrentSeriesPointRank,
  getCurrentSeriesPrecheck,
  type Top1RateRow,
  type PlaceCountRow,
  type CourseAverageRow,
  type SeriesPointRankRow,
  type SeriesPrecheckRow,
} from '@/lib/aggregate';

const RACE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function TodayRaceInfoPage({
  params,
}: {
  params: Promise<{ stadiumNumber: string; raceNumber: string }>;
}) {
  const { stadiumNumber: stadiumNumberStr, raceNumber: raceNumberStr } = await params;
  const stadiumNumber = Number(stadiumNumberStr);
  const raceNumber = Number(raceNumberStr);

  const stadiumRaces = await getTodayStadiumRaces(stadiumNumber);
  const race = stadiumRaces.find((r) => r.race_number === raceNumber);
  if (!race) notFound();

  const availableRaceNumbers = new Set(stadiumRaces.map((r) => r.race_number));

  const [top1RateResult, placeCountResult, startTimingResult, exhibitionTimeResult, seriesRank, seriesPrecheck] =
    await Promise.all([
      getTop1RateByTechnique(stadiumNumber, 10),
      getPlaceCounts(stadiumNumber, 5),
      getStartTimingByCourse(stadiumNumber, 10),
      getExhibitionTimeByCourse(stadiumNumber, 10),
      getCurrentSeriesPointRank(stadiumNumber),
      getCurrentSeriesPrecheck(stadiumNumber),
    ]);

  const top1RateMap = new Map<number, Top1RateRow>(top1RateResult.rows.map((r) => [r.racerNumber, r]));
  const placeCountMap = new Map<number, PlaceCountRow>(placeCountResult.rows.map((r) => [r.racerNumber, r]));
  const startTimingMap = new Map<number, CourseAverageRow>(startTimingResult.rows.map((r) => [r.racerNumber, r]));
  const exhibitionTimeMap = new Map<number, CourseAverageRow>(exhibitionTimeResult.rows.map((r) => [r.racerNumber, r]));
  const seriesRankMap = new Map<number, SeriesPointRankRow>(seriesRank.rows.map((r) => [r.racerNumber, r]));
  const seriesPrecheckMap = new Map<number, SeriesPrecheckRow>(seriesPrecheck.rows.map((r) => [r.racerNumber, r]));

  const lanes = Object.values(race.racers)
    .filter((r) => r.number != null)
    .sort((a, b) => a.entry_number - b.entry_number)
    .map((racer) => {
      const previewRacer = race.preview?.racers[String(racer.entry_number)];
      // 進入コースはpreview（直前情報）が出ていればその値、なければ枠番をそのまま採用
      const course = previewRacer?.course_number ?? racer.entry_number;

      return {
        entryNumber: racer.entry_number,
        name: racer.name,
        top1Rate: top1RateMap.get(racer.number),
        placeCount: placeCountMap.get(racer.number),
        startTiming: startTimingMap.get(racer.number)?.courses[course] ?? null,
        exhibitionTime: exhibitionTimeMap.get(racer.number)?.courses[course] ?? null,
        seriesRank: seriesRankMap.get(racer.number),
        precheck: seriesPrecheckMap.get(racer.number),
      };
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/today" className="text-sm text-gray-500 hover:text-[#1995AD] hover:underline">
          ← 本日のレース
        </Link>
        <h1 className="text-2xl font-bold text-[#1995AD]">{stadiumName(stadiumNumber)}</h1>
      </div>

      <div>
        <p className="text-lg font-bold">{race.title ?? '-'}</p>
        <p className="text-sm text-gray-500">
          {race.day_number != null ? `${race.day_number}日目` : ''}
          {race.subtitle ? `　${race.subtitle}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RACE_NUMBERS.map((n) => {
          const active = n === raceNumber;
          const available = availableRaceNumbers.has(n);
          if (!available) {
            return (
              <span key={n} className="px-3 py-1.5 rounded text-sm font-medium text-gray-300">
                {n}R
              </span>
            );
          }
          return (
            <Link
              key={n}
              href={`/today/${stadiumNumber}/${n}`}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#1995AD] text-white'
                  : 'bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#BCBABE]/40'
              }`}
            >
              {n}R
            </Link>
          );
        })}
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
            {lanes.map((lane, i) => (
              <tr key={lane.entryNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
                <td className="px-3 py-1.5 text-center font-bold">{lane.entryNumber}</td>
                <td className="px-3 py-1.5 font-medium">{lane.name}</td>
                <td className="px-3 py-1.5 text-center">
                  {lane.top1Rate ? (
                    <>
                      {lane.top1Rate.top1Count}
                      <br />
                      {pct(lane.top1Rate.top1Rate)}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.top1Rate ? (
                    <>
                      {pct(lane.top1Rate.makuriRate)}
                      <br />
                      {pct(lane.top1Rate.sashiRate)}
                      <br />
                      {pct(lane.top1Rate.makuriSashiRate)}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.placeCount ? (
                    <>
                      {lane.placeCount.entries}
                      <br />
                      {lane.placeCount.top1Count}
                      <br />
                      {lane.placeCount.top2Count}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.startTiming ? lane.startTiming.average.toFixed(2) : '-'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.exhibitionTime ? lane.exhibitionTime.average.toFixed(2) : '-'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.seriesRank ? (
                    <>
                      {lane.seriesRank.pointRate ?? '-'}
                      <br />
                      {lane.seriesRank.points ?? '-'}
                      <br />
                      {lane.seriesRank.deduction ?? '-'}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">{lane.precheck?.precheckTime ?? '-'}</td>
                <td className="px-3 py-1.5 text-center">
                  {lane.precheck ? (
                    <>
                      {lane.precheck.motorNumber ?? '-'}
                      <br />
                      {lane.precheck.motorTop2Rate != null ? `${lane.precheck.motorTop2Rate}%` : '-'}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {lane.precheck ? (
                    <>
                      {lane.precheck.boatNumber ?? '-'}
                      <br />
                      {lane.precheck.boatTop2Rate != null ? `${lane.precheck.boatTop2Rate}%` : '-'}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
