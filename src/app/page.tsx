import Link from 'next/link';
import { STADIUMS } from '@/lib/stadiums';
import { MENU_ITEMS } from '@/lib/menu';

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#967E76]">競艇場を選択</h1>

      <div className="bg-white rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#967E76] text-white">
              <th className="px-3 py-2 text-left sticky left-0 bg-[#967E76] z-10">競艇場</th>
              {MENU_ITEMS.map((menu) => (
                <th key={menu.slug} className="px-3 py-2 text-center" title={menu.label}>
                  {menu.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STADIUMS.map((stadium, i) => (
              <tr key={stadium.number} className={`border-t ${i % 2 === 1 ? 'bg-[#FAF6F0]/60' : ''}`}>
                <td className="px-3 py-2 font-medium sticky left-0 bg-inherit">{stadium.name}</td>
                {MENU_ITEMS.map((menu) => (
                  <td key={menu.slug} className="px-3 py-2 text-center">
                    <Link
                      href={`/stadium/${stadium.number}/${menu.slug}`}
                      className="text-[#967E76] hover:text-[#7a6b65] hover:underline"
                    >
                      表示
                    </Link>
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
