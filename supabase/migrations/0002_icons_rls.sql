-- icons 버킷 편집 권한: 열람/다운로드는 공개, 저장/삭제/수정은 허용 이메일만.
-- 실권한은 아래 Storage RLS + can_edit_generated() 로 서버측 강제됨.
-- (프론트 버튼 잠금은 UI 편의일 뿐, 우회해도 이 정책이 차단)

-- ── 허용 편집자 명단 ────────────────────────────────────────────
create table if not exists public.editors (
  email     text primary key,
  can_edit  boolean not null default false
);

alter table public.editors enable row level security;
-- anon/authenticated 직접 접근 차단(SECURITY DEFINER 함수로만 참조)
revoke all on public.editors from anon, authenticated;

insert into public.editors (email, can_edit)
values ('gunug850@gmail.com', true)
on conflict (email) do update set can_edit = excluded.can_edit;

-- ── 권한 판정 함수 (로그인 JWT 이메일이 명단에 can_edit=true 인가) ──
create or replace function public.can_edit_generated()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists(
    select 1 from public.editors
    where email = auth.jwt()->>'email' and can_edit
  );
$$;

-- ── Storage RLS (bucket: icons) ─────────────────────────────────
-- 경로별 4종: svg/generated/, svg/grid/, grid/, state/
-- 읽기는 공개, 쓰기/삭제/수정은 can_edit_generated() 통과 필요.

-- svg/generated/
drop policy if exists "generated read"   on storage.objects;
drop policy if exists "generated insert" on storage.objects;
drop policy if exists "generated delete" on storage.objects;
create policy "generated read"   on storage.objects for select to public
  using (bucket_id = 'icons' and name like 'svg/generated/%');
create policy "generated insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'icons' and name like 'svg/generated/%' and can_edit_generated());
create policy "generated delete" on storage.objects for delete to authenticated
  using (bucket_id = 'icons' and name like 'svg/generated/%' and can_edit_generated());

-- svg/grid/
drop policy if exists "grid svg read"   on storage.objects;
drop policy if exists "grid svg insert" on storage.objects;
drop policy if exists "grid svg update" on storage.objects;
drop policy if exists "grid svg delete" on storage.objects;
create policy "grid svg read"   on storage.objects for select to public
  using (bucket_id = 'icons' and name like 'svg/grid/%');
create policy "grid svg insert" on storage.objects for insert to public
  with check (bucket_id = 'icons' and name like 'svg/grid/%' and can_edit_generated());
create policy "grid svg update" on storage.objects for update to public
  using (bucket_id = 'icons' and name like 'svg/grid/%' and can_edit_generated())
  with check (bucket_id = 'icons' and name like 'svg/grid/%' and can_edit_generated());
create policy "grid svg delete" on storage.objects for delete to public
  using (bucket_id = 'icons' and name like 'svg/grid/%' and can_edit_generated());

-- grid/ (json)
drop policy if exists "grid json read"   on storage.objects;
drop policy if exists "grid json insert" on storage.objects;
drop policy if exists "grid json update" on storage.objects;
drop policy if exists "grid json delete" on storage.objects;
create policy "grid json read"   on storage.objects for select to public
  using (bucket_id = 'icons' and name like 'grid/%');
create policy "grid json insert" on storage.objects for insert to public
  with check (bucket_id = 'icons' and name like 'grid/%' and can_edit_generated());
create policy "grid json update" on storage.objects for update to public
  using (bucket_id = 'icons' and name like 'grid/%' and can_edit_generated())
  with check (bucket_id = 'icons' and name like 'grid/%' and can_edit_generated());
create policy "grid json delete" on storage.objects for delete to public
  using (bucket_id = 'icons' and name like 'grid/%' and can_edit_generated());

-- state/ (작업 상태 json)
drop policy if exists "icon state read"   on storage.objects;
drop policy if exists "icon state insert" on storage.objects;
drop policy if exists "icon state update" on storage.objects;
drop policy if exists "icon state delete" on storage.objects;
create policy "icon state read"   on storage.objects for select to public
  using (bucket_id = 'icons' and name like 'state/%');
create policy "icon state insert" on storage.objects for insert to public
  with check (bucket_id = 'icons' and name like 'state/%' and can_edit_generated());
create policy "icon state update" on storage.objects for update to public
  using (bucket_id = 'icons' and name like 'state/%' and can_edit_generated())
  with check (bucket_id = 'icons' and name like 'state/%' and can_edit_generated());
create policy "icon state delete" on storage.objects for delete to public
  using (bucket_id = 'icons' and name like 'state/%' and can_edit_generated());
