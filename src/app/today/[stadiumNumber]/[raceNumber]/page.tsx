import Link from 'next/link';
import { fetchDay, todayJST } from '@/lib/kyotei-api';
import { getRaceCardAnalysis, type RaceEntryInput } from '@/lib/aggregate';
import { stadiumName } from '@/lib/stadiums';
import AnalysisTable, { type AnalysisGroup } from '@/components/AnalysisTable';

function pct(v: number | null): string {
  return v === null ? '-' : `${(v * 100).toFixed(1)}%`;
}

function pctRaw(v: number | null): string {
  return v === null ? '-' : `${v}%`;
}

function dec(v: number | null, decimals = 2): string {
  return v === null ? '-' : v.toFixed(decimals);
}

function num(v: number | null): string {
  return v === null ? '-' : String(v);
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
    .map(([entryKey, r]) => {
      const entryNumber = Number(entryKey);
      const previewCourse = race.preview?.racers[entryKey]?.course_number ?? null;
      return {
        entryNumber,
        racerNumber: r.number,
        course: previewCourse ?? entryNumber,
      };
    })
    .sort((a, b) => a.entryNumber - b.entryNumber);

  const rows = await getRaceCardAnalysis(stadiumNum, entries);
  const entryNumbers = rows.map((r) => r.entryNumber);

  const exhibitionTimeByEntry = new Map<number, number | null>();
  for (const [entryKey, p] of Object.entries(race.preview?.racers ?? {})) {
    exhibitionTimeByEntry.set(Number(entryKey), p.exhibition_time);
  }

  const kyoteibiyoriUrl = `https://kyoteibiyori.com/race_shusso.php?place_no=${stadiumNum}&race_no=${raceNum}&hiduke=${race.date.replace(/-/g, '')}&slider=1`;

  const groups: AnalysisGroup[] = [
    { label: 'レーサー名', rows: [{ values: rows.map((r) => r.name) }] },
    { label: '持ちタイム', rows: [{ values: rows.map(() => '-') }] },
    {
      label: '前検タイム',
      rows: [{ values: rows.map((r) => dec(exhibitionTimeByEntry.get(r.entryNumber) ?? null)) }],
    },
    {
      label: 'モーター',
      rows: [
        { subLabel: 'No', values: rows.map((r) => num(r.motorNumber)) },
        { subLabel: '2連率', values: rows.map((r) => pctRaw(r.motorTop2Rate)) },
      ],
    },
    {
      label: 'ボート',
      rows: [
        { subLabel: 'No', values: rows.map((r) => num(r.boatNumber)) },
        { subLabel: '2連率', values: rows.map((r) => pctRaw(r.boatTop2Rate)) },
      ],
    },
    {
      label: '枠別\n着率',
      rows: [
        { subLabel: '1着率', values: rows.map((r) => pct(r.frameRate.top1Rate)) },
        { subLabel: '2着率', values: rows.map((r) => pct(r.frameRate.top2Rate)) },
        { subLabel: '3着率', values: rows.map((r) => pct(r.frameRate.top3Rate)) },
      ],
    },
    {
      label: 'コース別\n決まり手率',
      rows: [
        { subLabel: '差され/差し', values: rows.map((r) => pct(r.techniqueRate.rate1)) },
        { subLabel: '捲られ/捲り', values: rows.map((r) => pct(r.techniqueRate.rate2)) },
        { subLabel: '捲られ差\n/捲り差', values: rows.map((r) => pct(r.techniqueRate.rate3)) },
      ],
    },
    {
      label: '決まり手数',
      rows: [
        { subLabel: '逃げ', values: rows.map((r) => num(r.techniqueCounts.nige)) },
        { subLabel: '差し', values: rows.map((r) => num(r.techniqueCounts.sashi)) },
        { subLabel: '捲り', values: rows.map((r) => num(r.techniqueCounts.makuri)) },
        { subLabel: '捲差', values: rows.map((r) => num(r.techniqueCounts.makuriSa)) },
      ],
    },
    {
      label: '全枠\n決まり手数',
      rows: [
        { subLabel: '差し', values: rows.map((r) => String(r.allCourseTechniqueCounts.sashi)) },
        { subLabel: '捲り', values: rows.map((r) => String(r.allCourseTechniqueCounts.makuri)) },
        { subLabel: '捲差', values: rows.map((r) => String(r.allCourseTechniqueCounts.makuriSa)) },
      ],
    },
    { label: '平均ST ポイント', rows: [{ values: rows.map(() => '-') }] },
    { label: '平均ST順位 ポイント', rows: [{ values: rows.map(() => '-') }] },
    { label: '全枠順平均ST ポイント', rows: [{ values: rows.map(() => '-') }] },
    { label: '全枠順平均ST順位 ポイント', rows: [{ values: rows.map(() => '-') }] },
    { label: '展示タイム一位\n勝率ポイント', rows: [{ values: rows.map(() => '-') }] },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#1995AD]">
            {stadiumName(stadiumNum)} {raceNum}R
          </h2>
          {race.subtitle && <p className="text-sm text-gray-500">{race.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/today/${stadiumNum}#race-${raceNum}`}
            className="text-sm text-gray-500 hover:text-[#1995AD] hover:underline"
          >
            ← レース一覧に戻る
          </Link>
          <a
            href={kyoteibiyoriUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 rounded text-sm font-medium bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#1995AD] hover:text-white transition-colors"
          >
            競艇日和（枠順情報） ↗
          </a>
        </div>
      </div>

      <AnalysisTable entryNumbers={entryNumbers} groups={groups} />

      <p className="text-xs text-gray-400 text-center">
        持ちタイム・平均ST系ポイント・展示タイム一位勝率ポイントは今後追加予定です
      </p>
    </div>
  );
}
