// 進行中シリーズの得点率・前検タイム取込 cron API
// GitHub Actions から Bearer トークン付きで POST される
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchPointRank, fetchPrecheck } from '@/lib/scrape';
import { todayJST } from '@/lib/kyotei-api';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const hd = todayJST().toISOString().slice(0, 10).replace(/-/g, '');

  const { data: activeSeries, error } = await supabaseAdmin
    .from('series')
    .select('id, stadium_number')
    .is('end_date', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 24スタジアム分を一斉に投げると輻輳してタイムアウトが増えるため、
  // 同時実行数を絞ったバッチ処理にする
  const CONCURRENCY = 6;
  const queue = [...(activeSeries ?? [])];
  const results: { stadiumNumber: number; seriesId: number; pointRankCount: number; precheckCount: number; error?: string }[] = [];

  async function worker() {
    while (queue.length > 0) {
      const series = queue.shift();
      if (!series) break;
      try {
        const [pointRank, precheck] = await Promise.all([
          fetchPointRank(series.stadium_number, hd),
          fetchPrecheck(series.stadium_number, hd),
        ]);

        if (pointRank.length > 0) {
          await supabaseAdmin.from('series_point_ranks').upsert(
            pointRank.map((e) => ({
              series_id: series.id,
              racer_number: e.racerNumber,
              rank_position: e.rank,
              points: e.points,
              deduction: e.deduction,
              point_rate: e.pointRate,
              scraped_at: new Date().toISOString(),
            })),
            { onConflict: 'series_id,racer_number' }
          );
        }

        if (precheck.length > 0) {
          await supabaseAdmin.from('series_precheck').upsert(
            precheck.map((e) => ({
              series_id: series.id,
              racer_number: e.racerNumber,
              rank_position: e.rank,
              motor_number: e.motorNumber,
              motor_top2_rate: e.motorTop2Rate,
              boat_number: e.boatNumber,
              boat_top2_rate: e.boatTop2Rate,
              precheck_time: e.precheckTime,
              scraped_at: new Date().toISOString(),
            })),
            { onConflict: 'series_id,racer_number' }
          );
        }

        results.push({
          stadiumNumber: series.stadium_number,
          seriesId: series.id,
          pointRankCount: pointRank.length,
          precheckCount: precheck.length,
        });
      } catch (err) {
        // ページ構造変化・非開催日・タイムアウト等で失敗しても他のスタジアムの処理は継続する
        results.push({
          stadiumNumber: series.stadium_number,
          seriesId: series.id,
          pointRankCount: 0,
          precheckCount: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return NextResponse.json({ hd, results });
}
