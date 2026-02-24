# Ligacao Supabase (Projeto + Local)

## 1) Criar projeto Supabase

1. Vai a `https://supabase.com/dashboard`.
2. Cria um novo projeto.
3. Guarda o `Project URL` e a `anon public key`:
   - Dashboard -> Project Settings -> API

## 2) Configurar variaveis locais

1. Na raiz do projeto, cria `.env.local` a partir do exemplo:

```bash
cp .env.example .env.local
```

2. Preenche:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

3. Arranca a app:

```bash
npm install
npm run dev
```

## 3) Ligar repositório ao projeto Supabase (CLI)

1. Instala CLI (se ainda nao tens):

```bash
npm i -D supabase
```

2. Autentica:

```bash
npx supabase login
```

3. Liga ao projeto remoto:

```bash
npx supabase link --project-ref <PROJECT_REF>
```

`PROJECT_REF` e a parte antes de `.supabase.co` no URL do projeto.

## 4) Aplicar migracoes de seguranca

As migracoes ja estao no repo:

- `supabase/migrations/20260224151000_initial_schema.sql`
- `supabase/migrations/20260224152000_security_rls.sql`
- `supabase/migrations/20260224153000_owner_not_null.sql`
- `supabase/migrations/20260224191500_add_checkin_checkout.sql`
- `supabase/migrations/20260224194000_sync_nights_from_dates.sql`

Aplica:

```bash
npx supabase db push
```

## 5) URL Configuration para OAuth GitHub

Em `Authentication -> URL Configuration` do Supabase:

- `Site URL`: `http://127.0.0.1:5173/al-registo/`
- `Redirect URLs`:
  - `http://127.0.0.1:5173/al-registo/auth/callback`
  - `http://localhost:5173/al-registo/auth/callback`
  - (opcional) `http://127.0.0.1:5173/al-registo/`
  - (opcional) `http://localhost:5173/al-registo/`

## 6) Backfill de owner_id (se houver dados antigos)

Antes da migracao `20260224153000_owner_not_null.sql`, garante que nao ha `owner_id` nulo:

```sql
update public.apartments
set owner_id = '<OWNER_UUID>'
where owner_id is null;

update public.stays
set owner_id = '<OWNER_UUID>'
where owner_id is null;
```

Depois volta a correr:

```bash
npx supabase db push
```
