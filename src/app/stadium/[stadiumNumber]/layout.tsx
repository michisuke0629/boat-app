import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STADIUMS } from '@/lib/stadiums';
import StadiumTabs from '@/components/StadiumTabs';

export default async function StadiumLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const num = Number(stadiumNumber);
  const stadium = STADIUMS.find((s) => s.number === num);
  if (!stadium) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-[#1995AD] hover:underline">
            ← 競艇場選択
          </Link>
          <h1 className="text-2xl font-bold text-[#1995AD]">{stadium.name}</h1>
        </div>
      </div>
      <StadiumTabs stadiumNumber={num} />
      {children}
    </div>
  );
}
