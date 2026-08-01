import type { CourseAverageRow } from '@/lib/aggregate';

export default function CourseAverageTable({
  rows,
  decimals = 2,
}: {
  rows: CourseAverageRow[];
  decimals?: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="bg-[#967E76] text-white">
            <th className="px-3 py-2 text-left">レーサー</th>
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <th key={c} className="px-3 py-2 text-center">
                {c}コース
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.racerNumber} className={`border-t ${i % 2 === 1 ? 'bg-[#FAF6F0]/60' : ''}`}>
              <td className="px-3 py-1.5 font-medium">{r.name}</td>
              {[1, 2, 3, 4, 5, 6].map((c) => {
                const v = r.courses[c];
                return (
                  <td key={c} className="px-3 py-1.5 text-center">
                    {v ? (
                      <span>
                        {v.average.toFixed(decimals)}
                        <span className="text-gray-400 text-xs">（{v.samples}）</span>
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                データがまだありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
