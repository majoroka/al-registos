# Ligacao Supabase (Projeto + Local)

## 1) Criar projeto Supabase

1. Vai a `https://supabase.com/dashboard`.
1. Cria um novo projeto.
1. Guarda o `Project URL` e a `anon public key`:
   - `Project Settings -> API`

## 2) Configurar variáveis locais

1. Na raiz do projeto, cria `.env.local`:

```bash
cp .env.example .env.local
```

1. Preenche:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

1. Arranca a app:

```bash
npm install
npm run dev
```

> No frontend, usa apenas a `anon key`.

## 3) Ligar CLI ao projeto remoto

1. Login na CLI:

```bash
npx supabase login
```

1. Liga ao projeto remoto:

```bash
npx supabase link --project-ref <PROJECT_REF>
```

`PROJECT_REF` é a parte antes de `.supabase.co` no URL do projeto.

## 4) Aplicar migrações

Migrações atualmente versionadas no repositório:

- `supabase/migrations/20260224151000_initial_schema.sql`
- `supabase/migrations/20260224152000_security_rls.sql`
- `supabase/migrations/20260224153000_owner_not_null.sql`
- `supabase/migrations/20260224191500_add_checkin_checkout.sql`
- `supabase/migrations/20260224194000_sync_nights_from_dates.sql`
- `supabase/migrations/20260224203000_import_clientes_al.sql`

Aplicar:

```bash
npx supabase db push
```

## 5) OAuth GitHub (opcional)

### Supabase

Em `Authentication -> URL Configuration`:

- `Site URL`: `http://127.0.0.1:5173/al-registo/`
- `Redirect URLs`:
  - `http://127.0.0.1:5173/al-registo/auth/callback`
  - `http://localhost:5173/al-registo/auth/callback`

Em `Authentication -> Providers -> GitHub`:

- Ativar provider.
- Preencher `Client ID` e `Client Secret` da OAuth App do GitHub.
- Guardar.

### GitHub

Em `Settings -> Developer settings -> OAuth Apps`:

- Criar uma OAuth App.
- Callback URL = valor mostrado no modal GitHub provider do Supabase (`.../auth/v1/callback`).

## 6) Importação inicial de histórico

A migration `20260224203000_import_clientes_al.sql` importa 43 registos válidos do histórico com estas regras:

- mapeamento por coluna `Apartamento` (`T1`/`T2`);
- normalização de `Roupa` (`Sem Roupa + divã` -> `Sem Roupa`);
- campos em falta mantidos vazios/`NULL` quando aplicável;
- validação para abortar se o número esperado de registos ou mapeamento de apartamentos falhar.

## 7) Backfill de `owner_id` (apenas em bases com dados antigos)

Se existirem linhas antigas com `owner_id is null` antes de aplicar `owner_not_null`:

```sql
update public.apartments
set owner_id = '<OWNER_UUID>'
where owner_id is null;

update public.stays
set owner_id = '<OWNER_UUID>'
where owner_id is null;
```

Depois, volta a correr:

```bash
npx supabase db push
```
