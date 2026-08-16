// 日次データ取込 cron API
// GitHub Actions から Bearer トークン付きで POST される
import { NextRequest, NextResponse } from 'next/server';
import { fetchDay, todayJST } from '@/lib/kyotei-api';
import { ingestDay, ingestRaceTimes } from '@/lib/ingest';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get('date');
  const date = dateParam ?? todayJST().toISOString().slice(0, 10);

  try {
    const races = await fetchDay(new Date(`${date}T00:00:00Z`));
    const result = await ingestDay(races, date);
    const raceTimeResult = await ingestRaceTimes(races, date);
    return NextResponse.json({
      message: `${date}のデータを取り込みました`,
      ...result,
      raceTime: raceTimeResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'データ取込に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
