// Supabase クライアント設定
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ビルド時にSupabase URLが未設定でもエラーにならないようにする
function getClient(key: string | undefined): SupabaseClient {
  if (!supabaseUrl || !key) {
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  return createClient(supabaseUrl, key);
}

// 読取専用（anon key、ページ表示で使用）
export const supabase = getClient(supabaseAnonKey);

// 書込用（service role key、RLSをバイパス。cron routeとbackfillスクリプト専用、クライアントに露出させない）
export const supabaseAdmin = getClient(supabaseServiceRoleKey);
