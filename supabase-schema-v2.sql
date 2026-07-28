-- ============================================================
-- 我的个人工作台 v2 - 数据库 Schema
-- 从单表 JSONB 拆分为独立关系表，支持 SQL 查询
-- ============================================================

-- 1. 用户扩展信息
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. 任务表
create table if not exists public.tasks (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  category    text not null default '其他',
  priority    text not null default '中',
  status      text not null default '待处理',
  notes       text default '',
  due_date    date,
  created_date date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_tasks_status on tasks(user_id, status);

-- 3. 每日习惯记录
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  category    text not null, -- learning, reading, exercise, work, life
  done        boolean not null default false,
  fields      jsonb default '{}'::jsonb, -- 各类别的自定义字段
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, date, category)
);
create index if not exists idx_habits_user on habits(user_id, date);

-- 4. 灵感收件箱
create table if not exists public.inbox_items (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  raw         text not null,
  summary     text not null,
  type        text not null default '随想',
  tags        text[] default '{}',
  has_todo    boolean not null default false,
  status      text not null default '待整理',
  question    text default '',
  todo_content text default '',
  todo_priority text default '中',
  todo_due_date date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_inbox_user on inbox_items(user_id);
create index if not exists idx_inbox_status on inbox_items(user_id, status);

-- 5. 对话历史
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_chat_user on chat_messages(user_id, created_at);

-- 6. 每日复盘
create table if not exists public.daily_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  done        text[] default '{}',
  undone      text[] default '{}',
  habits      text[] default '{}',
  gain        text default '',
  next_plan   text[] default '{}',
  ai_summary  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, date)
);
create index if not exists idx_review_user on daily_reviews(user_id);

-- 7. 每周复盘
create table if not exists public.weekly_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  goal        text default '',
  ai_summary  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, week_start)
);
create index if not exists idx_weekly_user on weekly_reviews(user_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.inbox_items enable row level security;
alter table public.chat_messages enable row level security;
alter table public.daily_reviews enable row level security;
alter table public.weekly_reviews enable row level security;

-- 策略：每个用户只能访问自己的数据
create policy "profiles own" on public.profiles for all using (auth.uid() = id);
create policy "tasks own" on public.tasks for all using (auth.uid() = user_id);
create policy "habits own" on public.habits for all using (auth.uid() = user_id);
create policy "inbox own" on public.inbox_items for all using (auth.uid() = user_id);
create policy "chat own" on public.chat_messages for all using (auth.uid() = user_id);
create policy "reviews own" on public.daily_reviews for all using (auth.uid() = user_id);
create policy "weekly own" on public.weekly_reviews for all using (auth.uid() = user_id);

-- ============================================================
-- 数据迁移：从旧表 workbench_state 迁移到新表
-- 注：旧表保留，迁移脚本在服务端运行
-- ============================================================
-- 保留旧表不动，server 启动时自动迁移