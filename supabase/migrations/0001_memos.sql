-- memo 유틸: 공개 메모 보드
-- 쓰기/삭제는 Edge Function(service_role)만 수행. anon 은 읽기 전용(민감 컬럼 제외).

create table if not exists public.memos (
  id          uuid primary key default gen_random_uuid(),
  content     text        not null check (char_length(content) between 1 and 2000),
  pw_salt     text        not null,
  pw_hash     text        not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists memos_created_at_idx on public.memos (created_at desc);
create index if not exists memos_ip_hash_created_idx on public.memos (ip_hash, created_at desc);

alter table public.memos enable row level security;

-- supabase 기본 grant 제거 후, 공개 컬럼만 SELECT 허용 (pw_salt/pw_hash/ip_hash 노출 차단)
revoke all on public.memos from anon, authenticated;
grant select (id, content, created_at) on public.memos to anon, authenticated;

drop policy if exists "memos_public_read" on public.memos;
create policy "memos_public_read"
  on public.memos for select
  to anon, authenticated
  using (true);

-- insert/update/delete 정책 없음 → service_role(Edge Function) 만 가능
