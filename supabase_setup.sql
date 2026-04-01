-- ======================================
-- Reel Scene Analyzer: Supabase テーブル設計
-- ======================================

-- 1. 分析セッション（動画ごと）
create table if not exists analysis_sessions (
  id uuid default gen_random_uuid() primary key,
  video_file_name text not null,
  video_file_size bigint,
  video_duration real,
  total_scenes int not null default 0,
  analysis_status text not null default 'idle',
  overall_analysis jsonb,
  created_at timestamptz default now()
);

-- 2. 個別シーン（セッションに紐づく）
create table if not exists scenes (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references analysis_sessions(id) on delete cascade not null,
  scene_number int not null,
  timestamp_sec real not null,
  timestamp_formatted text not null,
  thumbnail_url text,
  analysis_status text not null default 'pending',
  description text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- インデックス
create index if not exists idx_scenes_session_id on scenes(session_id);
create index if not exists idx_scenes_scene_number on scenes(session_id, scene_number);

-- 3. Storage バケット（サムネイル画像用）
-- Supabase ダッシュボード > Storage で "scene-thumbnails" バケットを作成してください
-- Public access を有効にするか、以下のポリシーを設定:

-- Storage ポリシー（全ユーザーにアップロード/読み取り許可）
-- ダッシュボードの Storage > Policies で設定するか、以下のSQLを実行:

-- insert into storage.buckets (id, name, public) values ('scene-thumbnails', 'scene-thumbnails', true);

-- RLS ポリシー（認証なしで使う場合）
alter table analysis_sessions enable row level security;
alter table scenes enable row level security;

create policy "Allow all access to analysis_sessions" on analysis_sessions
  for all using (true) with check (true);

create policy "Allow all access to scenes" on scenes
  for all using (true) with check (true);

-- ======================================
-- マイグレーション: 動画全体分析カラム追加
-- （既存テーブルに対して実行する場合）
-- ======================================
-- alter table analysis_sessions add column if not exists overall_analysis jsonb;

-- ======================================
-- マイグレーション: 動画タイトル（表示用）カラム追加
-- （既存テーブルに対して実行する場合）
-- ======================================
-- alter table analysis_sessions add column if not exists video_title text;

-- ======================================
-- 4. 台本（生成結果の保存）
-- ======================================
create table if not exists generated_scripts (
  id uuid default gen_random_uuid() primary key,
  theme text not null,
  tone text not null,
  pattern_id text not null,
  scenes jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. 台本 ↔ 参照セッション（中間テーブル）
create table if not exists script_references (
  id uuid default gen_random_uuid() primary key,
  script_id uuid references generated_scripts(id) on delete cascade not null,
  session_id uuid references analysis_sessions(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(script_id, session_id)
);

-- インデックス
create index if not exists idx_generated_scripts_created_at on generated_scripts(created_at desc);
create index if not exists idx_script_references_script_id on script_references(script_id);
create index if not exists idx_script_references_session_id on script_references(session_id);

-- RLS ポリシー
alter table generated_scripts enable row level security;
alter table script_references enable row level security;

create policy "Allow all access to generated_scripts" on generated_scripts
  for all using (true) with check (true);

create policy "Allow all access to script_references" on script_references
  for all using (true) with check (true);

-- ======================================
-- 6. ナレッジ管理（運用ノウハウ・ガイドライン）
-- ======================================
create table if not exists knowledge_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null default 'general',
  content text not null,
  source_type text not null,
  source_file_name text,
  created_at timestamptz default now()
);

create index if not exists idx_knowledge_items_created_at on knowledge_items(created_at desc);
create index if not exists idx_knowledge_items_category on knowledge_items(category);

alter table knowledge_items enable row level security;

create policy "Allow all access to knowledge_items" on knowledge_items
  for all using (true) with check (true);
