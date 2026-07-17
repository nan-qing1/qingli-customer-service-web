-- PostgreSQL schema for the production version.
-- The current packaged demo uses data/customers.json so it can run without installing a database.

create table if not exists customers (
  id text primary key,
  name text not null default '未命名客户',
  company text not null default '未知',
  contact text,
  industry text not null default '未知',
  need_type text not null default '前台咨询',
  focus text,
  interest text,
  repeated text,
  depth text,
  stage text not null default '新线索',
  risk text not null default '低',
  suggestion text,
  note text,
  high_value boolean not null default false,
  source text,
  session_id text,
  contact_card jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_items (
  id text primary key,
  title text not null,
  category text not null,
  source text,
  visibility text,
  raw text,
  clean text,
  status text not null default '待审核',
  version text not null default 'v0.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
