import type { ReactNode } from 'react';

export default function AnalysisSection({
  title,
  entryNumbers,
  lines,
}: {
  title: string;
  entryNumbers: number[];
  lines: { label: string; values: ReactNode[] }[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-[#1995AD] text-white px-3 py-1.5 font-bold text-sm">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#F1F1F2]">
              <th className="px-2 py-1.5 text-left w-20"></th>
              {entryNumbers.map((n) => (
                <th key={n} className="px-1 py-1.5 text-center w-12">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.label} className="border-t">
                <td className="px-2 py-1.5 text-gray-500 text-xs">{line.label}</td>
                {line.values.map((v, i) => (
                  <td key={i} className="px-1 py-1.5 text-center">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
