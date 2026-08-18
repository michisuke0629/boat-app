// レースタイム(boatrace.jpスクレイピング)の取りこぼしを解消するcron API
// sync-dayとは切り離し、少数件ずつ高頻度で呼び出すことでVercelのmaxDurationを超えないようにする
import { NextRequest, NextResponse } from 'next/server';
import { backfillRaceTimes } from '@/lib/ingest';

export const maxDuration = 60;

const BATCH_SIZE = 30;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const result = await backfillRaceTimes(BATCH_SIZE);
    return NextResponse.json({
      message: `レースタイムを${result.attempted}レース分取込みました`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'データ取込に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
