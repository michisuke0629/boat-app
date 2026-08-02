import { getCurrentSeriesPrecheck } from '@/lib/aggregate';

export default async function PrecheckTimePage({
  params,
}: {
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const { rows, series } = await getCurrentSeriesPrecheck(Number(stadiumNumber));

  if (!series) {
    return <p className="text-gray-400 py-6 text-center">現在開催中のシリーズがありません</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{series.title ?? '今シリーズ'}（{series.start_date}〜）</p>

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#1995AD] text-white">
              <th className="px-3 py-2 text-center">順位</th>
              <th className="px-3 py-2 text-left">レーサー</th>
              <th className="px-3 py-2 text-right">前検タイム</th>
              <th className="px-3 py-2 text-right">モーター</th>
              <th className="px-3 py-2 text-right">モーター2連対率</th>
              <th className="px-3 py-2 text-right">ボート</th>
              <th className="px-3 py-2 text-right">ボート2連対率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.racerNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#F1F1F2]/60' : ''}`}>
                <td className="px-3 py-1.5 text-center font-bold">{r.rank ?? '-'}</td>
                <td className="px-3 py-1.5 font-medium">{r.name}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#1995AD]">{r.precheckTime ?? '-'}</td>
                <td className="px-3 py-1.5 text-right">{r.motorNumber ?? '-'}</td>
                <td className="px-3 py-1.5 text-right">{r.motorTop2Rate ?? '-'}%</td>
                <td className="px-3 py-1.5 text-right">{r.boatNumber ?? '-'}</td>
                <td className="px-3 py-1.5 text-right">{r.boatTop2Rate ?? '-'}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  データがまだありません（次回cron実行後に反映されます）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
