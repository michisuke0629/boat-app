import { getExhibitionTimeByCourse } from '@/lib/aggregate';
import CourseAverageTable from '@/components/CourseAverageTable';

export default async function ExhibitionTimePage({
  params,
}: {
  params: Promise<{ stadiumNumber: string }>;
}) {
  const { stadiumNumber } = await params;
  const { rows, seriesUsed, seriesRequested } = await getExhibitionTimeByCourse(Number(stadiumNumber), 10);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        直近{seriesRequested}場を対象（データが蓄積されている{seriesUsed}場分で集計）。カッコ内はサンプル数。
      </p>
      {seriesUsed < seriesRequested && (
        <p className="text-sm text-amber-600">
          データ蓄積期間が短いため、指定した場数に達していません。
        </p>
      )}
      <CourseAverageTable rows={rows} decimals={2} />
    </div>
  );
}
