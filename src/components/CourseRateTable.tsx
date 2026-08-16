import { laneColorStyle } from '@/lib/laneColors';
import type { RaceCardAnalysisRow } from '@/lib/aggregate';

function pct(v: number | null): string {
  return v === null ? '-' : `${(v * 100).toFixed(1)}%`;
}

// レイアウトExcelの「レーサーコース別着率」シートを模した表: レーサーごとに今日の進入コースでの直近6カ月成績を1行で表示
export default function CourseRateTable({ rows }: { rows: RaceCardAnalysisRow[] }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <table className="w-full text-sm border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-[#1995AD] text-white">
            <th className="border border-white/20 px-2 py-2 text-center w-10">枠</th>
            <th className="border border-white/20 px-2 py-2 text-left">レーサー</th>
            <th className="border border-white/20 px-2 py-2 text-center">コース</th>
            <th className="border border-white/20 px-2 py-2 text-right">出走数</th>
            <th className="border border-white/20 px-2 py-2 text-right">1着数</th>
            <th className="border border-white/20 px-2 py-2 text-right">2着数</th>
            <th className="border border-white/20 px-2 py-2 text-right">3着数</th>
            <th className="border border-white/20 px-2 py-2 text-right">1着率</th>
            <th className="border border-white/20 px-2 py-2 text-right">2着率</th>
            <th className="border border-white/20 px-2 py-2 text-right">3着率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.entryNumber} className={`border-t border-gray-200 ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
              <td className="border border-gray-200 px-2 py-1.5 text-center font-bold" style={laneColorStyle(r.entryNumber)}>
                {r.entryNumber}
              </td>
              <td className="border border-gray-200 px-2 py-1.5 font-medium">{r.name}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-500">
                {r.course}コース
                <span className="block text-[10px] leading-tight">(自艇)</span>
              </td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{r.frameRate.entries}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{r.frameRate.top1Count}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{r.frameRate.top2Count}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{r.frameRate.top3Count}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right font-bold text-[#1995AD]">{pct(r.frameRate.top1Rate)}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{pct(r.frameRate.top2Rate)}</td>
              <td className="border border-gray-200 px-2 py-1.5 text-right">{pct(r.frameRate.top3Rate)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                データがまだありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
