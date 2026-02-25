# Supabase RLS Checklist (Pre-Producao)

Objetivo: garantir isolamento de dados por utilizador e bloquear acessos indevidos antes de colocar a app em producao.

## Estado no repositorio (fev/2026)

- As migracoes `20260224152000_security_rls.sql` e `20260224153000_owner_not_null.sql` ja aplicam a base de ownership + RLS.
- Este checklist continua util para auditoria manual em novos ambientes e validacao final pre-producao.

## 1) Modelo de ownership

- [ ] Garantir coluna `owner_id uuid not null` em `apartments` e `stays`.
- [ ] `owner_id` deve referenciar `auth.users(id)`.
- [ ] `owner_id` em `stays` deve ser consistente com o `owner_id` do apartamento associado.

SQL de referencia:

```sql
alter table public.apartments
  add column if not exists owner_id uuid references auth.users(id);

alter table public.stays
  add column if not exists owner_id uuid references auth.users(id);

alter table public.apartments
  alter column owner_id set default auth.uid();

alter table public.stays
  alter column owner_id set default auth.uid();

-- Backfill: substituir pelo UUID real do utilizador dono desses registos.
-- Em migracoes/admin, auth.uid() normalmente e null.
update public.apartments
set owner_id = '<OWNER_UUID>'
where owner_id is null;

update public.stays
set owner_id = '<OWNER_UUID>'
where owner_id is null;

alter table public.apartments alter column owner_id set not null;
alter table public.stays alter column owner_id set not null;
```

## 2) Ativar RLS em todas as tabelas expostas

- [ ] `alter table ... enable row level security`.
- [ ] Confirmar que nao existem tabelas sem RLS no schema `public`.

SQL de referencia:

```sql
alter table public.apartments enable row level security;
alter table public.stays enable row level security;
```

## 3) Politicas de leitura/escrita por dono

- [ ] `select` apenas para registos do proprio utilizador.
- [ ] `insert` apenas com `owner_id = auth.uid()`.
- [ ] `update/delete` apenas para registos do proprio utilizador.

SQL de referencia:

```sql
create policy "apartments_select_own"
on public.apartments
for select
to authenticated
using (owner_id = auth.uid());

create policy "apartments_insert_own"
on public.apartments
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "apartments_update_own"
on public.apartments
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "apartments_delete_own"
on public.apartments
for delete
to authenticated
using (owner_id = auth.uid());
```

```sql
create policy "stays_select_own"
on public.stays
for select
to authenticated
using (owner_id = auth.uid());

create policy "stays_insert_own"
on public.stays
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.apartments a
    where a.id = apartment_id
      and a.owner_id = auth.uid()
  )
);

create policy "stays_update_own"
on public.stays
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.apartments a
    where a.id = apartment_id
      and a.owner_id = auth.uid()
  )
);

create policy "stays_delete_own"
on public.stays
for delete
to authenticated
using (owner_id = auth.uid());
```

## 4) Endurecer privilegios e superficie publica

- [ ] Revogar grants amplos no `public` para `anon` se nao forem necessarios.
- [ ] Confirmar que a app usa apenas `authenticated`.
- [ ] Verificar que nenhuma operacao critica depende de `service_role` no frontend.

Exemplo:

```sql
revoke all on table public.apartments from anon;
revoke all on table public.stays from anon;
```

## 5) Integridade e performance

- [ ] `stays.apartment_id` com FK para `apartments.id`.
- [ ] Indexes para filtros: `stays(owner_id, year, apartment_id)` e `apartments(owner_id, name)`.
- [ ] Constraints de negocio basicas: `people_count > 0`, `nights_count > 0`, `year` em intervalo aceitavel.

Exemplo:

```sql
create index if not exists idx_stays_owner_year_apartment
on public.stays(owner_id, year, apartment_id);

create index if not exists idx_apartments_owner_name
on public.apartments(owner_id, name);
```

## 6) Testes minimos de seguranca (obrigatorio)

- [ ] Utilizador A nao consegue ler/escrever dados do utilizador B.
- [ ] `insert` com `owner_id` de outro utilizador falha.
- [ ] `update/delete` cruzado entre utilizadores falha.
- [ ] Sessao anonima nao consegue aceder endpoints protegidos.

Sugestao: executar estes testes no SQL editor com `authenticated` tokens de 2 contas diferentes.

## 7) Operacional

- [ ] Versionar migracoes SQL (evitar alteracoes manuais sem historico).
- [ ] Ativar logs e alertas para erros de policy.
- [ ] Rever politicas em cada alteracao de schema.
