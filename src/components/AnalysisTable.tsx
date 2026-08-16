import type { ReactNode } from 'react';

export interface AnalysisGroup {
  label: string;
  rows: { subLabel?: string; values: ReactNode[] }[];
}

// レイアウトExcelの「分析情報」シート（B〜I列）を模した表: B列=項目グループ、C列=内訳、D〜I列=枠1〜6
export default function AnalysisTable({
  entryNumbers,
  groups,
}: {
  entryNumbers: number[];
  groups: AnalysisGroup[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#1995AD] text-white">
            <th className="border border-white/20 px-2 py-2 text-left" colSpan={2}>
              項目
            </th>
            {entryNumbers.map((n) => (
              <th key={n} className="border border-white/20 px-1 py-2 text-center w-12">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const singleUngrouped = group.rows.length === 1 && !group.rows[0].subLabel;
            return group.rows.map((row, i) => (
              <tr key={`${group.label}-${i}`} className="border-t border-gray-200">
                {singleUngrouped ? (
                  <td colSpan={2} className="border border-gray-200 px-2 py-1.5 text-xs font-bold text-[#1995AD] bg-[#F1F1F2]">
                    {group.label}
                  </td>
                ) : (
                  <>
                    {i === 0 && (
                      <td
                        rowSpan={group.rows.length}
                        className="border border-gray-200 px-2 py-1.5 text-xs font-bold text-[#1995AD] bg-[#F1F1F2] align-middle whitespace-pre-line"
                      >
                        {group.label}
                      </td>
                    )}
                    <td className="border border-gray-200 px-2 py-1.5 text-xs text-gray-500 whitespace-pre-line">
                      {row.subLabel}
                    </td>
                  </>
                )}
                {row.values.map((v, j) => (
                  <td key={j} className="border border-gray-200 px-1 py-1.5 text-center">
                    {v}
                  </td>
                ))}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
