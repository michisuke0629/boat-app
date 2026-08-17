import type { ReactNode } from 'react';
import Link from 'next/link';
import { fetchDay, todayJST } from '@/lib/kyotei-api';
import { getRaceCardAnalysis, scoreTop2, type RaceEntryInput, type RaceCardAnalysisRow } from '@/lib/aggregate';
import { stadiumName } from '@/lib/stadiums';
import AnalysisTable, { type AnalysisGroup } from '@/components/AnalysisTable';
import CourseRateTable from '@/components/CourseRateTable';

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

// レースタイム（秒）を "1'52\"1" 形式に整形
function raceTime(v: number | null): string {
  if (v === null) return '-';
  const min = Math.floor(v / 60);
  const rem = v - min * 60;
  const sec = Math.floor(rem);
  const deci = Math.round((rem - sec) * 10);
  return `${min}'${String(sec).padStart(2, '0')}"${deci}`;
}

const PERIOD_LABELS = ['前期', '直近6ヶ月', '直近3ヶ月', '直近1ヶ月'];

// ポイント詳細テーブルの1セル: 出走6艇中の順位（scoreTop2と同じ判定）に応じて背景色を付ける
function detailCells(
  rows: RaceCardAnalysisRow[],
  getValue: (r: RaceCardAnalysisRow) => number | null,
  higherIsBetter: boolean,
  format: (v: number | null) => string
): ReactNode[] {
  const tiers = scoreTop2(
    rows.map((r) => ({ entryNumber: r.entryNumber, value: getValue(r) })),
    higherIsBetter
  );
  return rows.map((r) => {
    const tier = tiers.get(r.entryNumber) ?? 0;
    const bg = tier === 2 ? 'bg-red-100' : tier === 1 ? 'bg-yellow-100' : '';
    return (
      <span key={r.entryNumber} className={`block -mx-1 -my-1.5 px-1 py-1.5 ${bg}`}>
        {format(getValue(r))}
      </span>
    );
  });
}

// 期間ごとの行（平均ST系のポイント詳細用）: periodIndices=[0=前期,1=直近6ヶ月,2=直近3ヶ月,3=直近1ヶ月]の中から表示する期間を指定
function periodDetailRows(
  rows: RaceCardAnalysisRow[],
  periodIndices: number[],
  getValues: (r: RaceCardAnalysisRow) => (number | null)[],
  format: (v: number | null) => string
) {
  return periodIndices.map((p) => ({
    subLabel: PERIOD_LABELS[p],
    values: detailCells(rows, (r) => getValues(r)[p], false, format),
  }));
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

  const kyoteibiyoriUrl = `https://kyoteibiyori.com/race_shusso.php?place_no=${stadiumNum}&race_no=${raceNum}&hiduke=${race.date.replace(/-/g, '')}&slider=1`;

  const groups: AnalysisGroup[] = [
    { label: 'レーサー名', rows: [{ values: rows.map((r) => r.name) }] },
    { label: '持ちタイム', rows: [{ values: rows.map((r) => raceTime(r.motiTime)) }] },
    {
      label: '前検タイム',
      rows: [{ values: rows.map((r) => dec(r.precheckTime)) }],
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
    { label: '平均ST ポイント', rows: [{ values: rows.map((r) => String(r.startPoint.avgStartPoint)) }] },
    { label: '平均ST順位 ポイント', rows: [{ values: rows.map((r) => String(r.startPoint.avgStartRankPoint)) }] },
    { label: '全枠順平均ST ポイント', rows: [{ values: rows.map((r) => String(r.startPoint.allCourseAvgStartPoint)) }] },
    {
      label: '全枠順平均ST順位 ポイント',
      rows: [{ values: rows.map((r) => String(r.startPoint.allCourseAvgStartRankPoint)) }],
    },
    { label: '展示タイム\n勝率ポイント', rows: [{ values: rows.map((r) => String(r.exhibitionTop1Point)) }] },
  ];

  // ＜ポイント詳細＞: 上記5つのポイント項目の算出根拠（生値、期間別）
  const decFormat = (v: number | null) => (v === null ? '-' : v.toFixed(2));
  const rateFormat = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
  const countFormat = (v: number | null) => (v === null ? '-' : String(v));

  const pointDetailGroups: AnalysisGroup[] = [
    {
      label: '平均\nスタート\nタイム',
      rows: periodDetailRows(rows, [0, 1, 2, 3], (r) => r.pointDetail.courseAvgST, decFormat),
    },
    {
      label: '平均\nスタート\n順位',
      rows: periodDetailRows(rows, [0, 1, 2, 3], (r) => r.pointDetail.courseAvgSTRank, decFormat),
    },
    {
      label: '全枠順\n平均スタート\nタイム',
      rows: periodDetailRows(rows, [0, 2, 3], (r) => r.pointDetail.allAvgST, decFormat),
    },
    {
      label: '全枠順\n平均スタート\n順位',
      rows: periodDetailRows(rows, [2, 3], (r) => r.pointDetail.allAvgSTRank, decFormat),
    },
    {
      label: '展示タイム\n勝率',
      rows: [
        { subLabel: '1位回数', values: detailCells(rows, (r) => r.pointDetail.exhibitionCount, true, countFormat) },
        { subLabel: '1着率', values: detailCells(rows, (r) => r.pointDetail.exhibitionTop1Rate, true, rateFormat) },
        { subLabel: '2連対率', values: detailCells(rows, (r) => r.pointDetail.exhibitionTop2Rate, true, rateFormat) },
        { subLabel: '3連対率', values: detailCells(rows, (r) => r.pointDetail.exhibitionTop3Rate, true, rateFormat) },
      ],
    },
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

      <div className="space-y-2">
        <h3 className="text-base font-bold text-[#1995AD]">＜ポイント詳細＞</h3>
        <p className="text-xs text-gray-500">
          上記5項目のポイント算出根拠。出走6艇中で最も良い値を赤、2番目を黄で表示（1位が同値の場合は両方赤で2位なし）
        </p>
        <AnalysisTable entryNumbers={entryNumbers} groups={pointDetailGroups} />
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold text-[#1995AD]">レーサーコース別着率</h3>
        <p className="text-xs text-gray-500">直近6カ月・今日の進入コースでの成績</p>
        <CourseRateTable rows={rows} />
      </div>
    </div>
  );
}
