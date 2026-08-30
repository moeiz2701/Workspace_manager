-- 0003_categories.sql
-- Spec: IMPLEMENTATION.md §3.3

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,     -- stable slug used by JSON import, e.g. 'ml-pipeline'
  name        text not null,
  description text,
  color       text not null default 'slate',
  icon        text,                     -- lucide icon name
  position    numeric not null default 1000,
  created_at  timestamptz not null default now(),
  constraint categories_key_format check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_color_valid check (color in (
    'violet','blue','cyan','teal','emerald','lime',
    'amber','orange','rose','pink','fuchsia','slate'
  ))
);

create index if not exists categories_position_idx on categories(position);
