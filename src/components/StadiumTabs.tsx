'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MENU_ITEMS } from '@/lib/menu';

export default function StadiumTabs({ stadiumNumber }: { stadiumNumber: number }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {MENU_ITEMS.map((menu) => {
        const href = `/stadium/${stadiumNumber}/${menu.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={menu.slug}
            href={href}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              active
                ? 'bg-[#1995AD] text-white'
                : 'bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#BCBABE]/40'
            }`}
          >
            {menu.shortLabel}
          </Link>
        );
      })}
    </div>
  );
}
