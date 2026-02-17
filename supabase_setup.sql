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
