# AL Registo

Frontend em React + Vite + TypeScript para registo de visitantes de Alojamento Local, usando Supabase (Postgres + Auth).

## Estrutura principal

- `src/lib/supabase.ts` inicializa o cliente Supabase com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `src/context/AuthContext.tsx` mantém sessão e logout.
- `src/components/ProtectedRoute.tsx` protege rotas.
- `src/routes/` contém `login`, `apartments`, `stays`.
- `src/data/` contém CRUD simples para Supabase.

## Configuração de ambiente

Cria um ficheiro `.env.local` na raiz do projeto (ou usa `.env.example`):

```
VITE_SUPABASE_URL=coloca-aqui-a-url
VITE_SUPABASE_ANON_KEY=coloca-aqui-a-chave-anon
```

> Usa apenas a **anon key** do Supabase. Não uses service role key.

## Scripts

Instalar dependências:

```
npm install
```

Correr localmente:

```
npm run dev
```

Gerar build:

```
npm run build
```

Pré-visualizar build:

```
npm run preview
```

## GitHub Pages

O `vite.config.ts` está configurado com `base: "/al-registo/"`. Se o repositório tiver outro nome, altera esse valor e o `basename` do `BrowserRouter` já usa `import.meta.env.BASE_URL`.

## Segurança (Supabase)

Checklist de pré-produção para RLS/políticas:

- `docs/supabase-rls-checklist.md`

Guia de ligação e aplicação de migrações:

- `docs/supabase-setup.md`

Migrações SQL versionadas:

- `supabase/migrations/20260224152000_security_rls.sql`
- `supabase/migrations/20260224153000_owner_not_null.sql`
