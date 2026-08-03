import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchDay, todayJST } from '@/lib/kyotei-api';
import { stadiumName } from '@/lib/stadiums';
import RaceNumberTabs from '@/components/RaceNumberTabs';

export default async function TodayStadiumLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const num = Number(stadiumNumber);

  const races = await fetchDay(todayJST());
  const stadiumRaces = races
    .filter((r) => r.stadium_number === num)
    .sort((a, b) => a.race_number - b.race_number);
  if (stadiumRaces.length === 0) notFound();

  const rep = stadiumRaces[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/" className="text-sm text-gray-500 hover:text-[#1995AD] hover:underline">
          ← 本日のレース
        </Link>
        <h1 className="text-2xl font-bold text-[#1995AD]">{stadiumName(num)}</h1>
        <span className="text-sm text-gray-500">
          {rep.title ?? rep.subtitle}
          {rep.day_number ? `（${rep.day_number}日目）` : ''}
        </span>
      </div>
      <RaceNumberTabs stadiumNumber={num} raceNumbers={stadiumRaces.map((r) => r.race_number)} />
      {children}
    </div>
  );
}
