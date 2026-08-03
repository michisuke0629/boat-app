'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RaceNumberTabs({
  stadiumNumber,
  raceNumbers,
}: {
  stadiumNumber: number;
  raceNumbers: number[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {raceNumbers.map((n) => {
        const href = `/today/${stadiumNumber}/${n}`;
        const active = pathname === href;
        return (
          <Link
            key={n}
            href={href}
            className={`w-10 h-9 flex items-center justify-center rounded text-sm font-medium transition-colors ${
              active
                ? 'bg-[#1995AD] text-white'
                : 'bg-[#A1D6ED]/50 text-[#1995AD] hover:bg-[#BCBABE]/40'
            }`}
          >
            {n}R
          </Link>
        );
      })}
    </div>
  );
}
