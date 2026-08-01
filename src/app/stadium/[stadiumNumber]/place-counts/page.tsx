import { getPlaceCounts } from '@/lib/aggregate';

export default async function PlaceCountsPage({
  params,
}: {
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const { rows, seriesUsed, seriesRequested } = await getPlaceCounts(Number(stadiumNumber), 5);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        直近{seriesRequested}場を対象（データが蓄積されている{seriesUsed}場分で集計）
      </p>
      {seriesUsed < seriesRequested && (
        <p className="text-sm text-amber-600">
          データ蓄積期間が短いため、指定した場数に達していません。
        </p>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#967E76] text-white">
              <th className="px-3 py-2 text-left">レーサー</th>
              <th className="px-3 py-2 text-right">出走数</th>
              <th className="px-3 py-2 text-right">1着数</th>
              <th className="px-3 py-2 text-right">2着数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.racerNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#FAF6F0]/60' : ''}`}>
                <td className="px-3 py-1.5 font-medium">{r.name}</td>
                <td className="px-3 py-1.5 text-right">{r.entries}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#967E76]">{r.top1Count}</td>
                <td className="px-3 py-1.5 text-right">{r.top2Count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                  データがまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
