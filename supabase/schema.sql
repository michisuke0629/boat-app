-- 競艇データ分析アプリ DBスキーマ
-- 読取は公開（anon SELECT許可）、書込はservice roleキー経由のcronのみ（RLSをバイパス）

-- 選手マスタ（programsデータから都度upsert）
create table if not exists racers (
  racer_number integer primary key,
  name text not null,
  rank_number integer,
  branch_number integer,
  updated_at timestamptz not null default now()
);

-- シリーズ（節）。day_numberが1に戻ったことを検知して自動生成し、直前のシリーズにend_dateを確定する。
create table if not exists series (
  id bigserial primary key,
  stadium_number integer not null,
  start_date date not null,
  end_date date,
  title text,
  unique (stadium_number, start_date)
);

create index if not exists idx_series_stadium_active on series (stadium_number, end_date);

-- レース（1レース1行、決まり手はレース単位の値）
create table if not exists races (
  date date not null,
  stadium_number integer not null,
  race_number integer not null,
  day_number integer,
  title text,
  subtitle text,
  grade_number integer,
  technique_number integer,
  series_id bigint references series (id),
  updated_at timestamptz not null default now(),
  primary key (date, stadium_number, race_number)
);

create index if not exists idx_races_stadium_date on races (stadium_number, date);
create index if not exists idx_races_series on races (series_id);

-- 出走エントリー（programsの出走情報 + previewの展示タイム + resultの着順/ST/進入コースをマージ）
create table if not exists race_entries (
  date date not null,
  stadium_number integer not null,
  race_number integer not null,
  entry_number integer not null, -- 枠番（固定）
  racer_number integer not null,
  course_number integer,          -- 進入コース（実際に走ったコース、resultの値を優先）
  start_timing numeric,           -- 実績スタートタイミング（resultの値）
  start_rank integer,             -- レース内のスタートタイミング順位（1が最速、ingest時にAPIデータから算出）
  place_number integer,           -- 着順
  exhibition_time numeric,        -- 展示タイム（previewの値）
  exhibition_rank integer,        -- レース内の展示タイム順位（1が最速、ingest時にAPIデータから算出）
  race_time numeric,              -- レースタイム（boatrace.jpのレース結果ページをスクレイピングして取得、秒）
  updated_at timestamptz not null default now(),
  primary key (date, stadium_number, race_number, entry_number),
  foreign key (date, stadium_number, race_number) references races (date, stadium_number, race_number) on delete cascade
);

-- 既存DBへの追従用（新規作成時は上のcreate tableで既に列が存在するためno-op）
alter table race_entries add column if not exists start_rank integer;
alter table race_entries add column if not exists exhibition_rank integer;
alter table race_entries add column if not exists race_time numeric;

create index if not exists idx_entries_racer on race_entries (racer_number, stadium_number, date);
create index if not exists idx_entries_stadium_course on race_entries (stadium_number, course_number, racer_number);

-- 節間得点率一覧（boatrace.jp /race/pointrank のスクレイピング結果、シリーズごとに最新のみ保持）
create table if not exists series_point_ranks (
  series_id bigint not null references series (id) on delete cascade,
  racer_number integer not null,
  rank_position integer,
  points numeric,
  deduction numeric,
  point_rate numeric,
  scraped_at timestamptz not null default now(),
  primary key (series_id, racer_number)
);

-- 前検タイム・モーター/ボート成績（boatrace.jp /race/rankingmotor のスクレイピング結果）
create table if not exists series_precheck (
  series_id bigint not null references series (id) on delete cascade,
  racer_number integer not null,
  rank_position integer,
  motor_number integer,
  motor_top2_rate numeric,
  boat_number integer,
  boat_top2_rate numeric,
  precheck_time numeric,
  scraped_at timestamptz not null default now(),
  primary key (series_id, racer_number)
);

-- RLS: 読取公開、書込はservice roleキー経由のみ（RLSをバイパスするため書込ポリシーは不要）
alter table racers enable row level security;
alter table races enable row level security;
alter table race_entries enable row level security;
alter table series enable row level security;
alter table series_point_ranks enable row level security;
alter table series_precheck enable row level security;

create policy "public read racers" on racers for select using (true);
create policy "public read races" on races for select using (true);
create policy "public read race_entries" on race_entries for select using (true);
create policy "public read series" on series for select using (true);
create policy "public read series_point_ranks" on series_point_ranks for select using (true);
create policy "public read series_precheck" on series_precheck for select using (true);
