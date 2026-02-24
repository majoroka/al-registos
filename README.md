# AL Registo

Frontend em React + Vite + TypeScript para registo de visitantes de Alojamento Local, com Supabase (Auth + Postgres).

## Estado atual

Projeto em fase inicial com:

- autenticação por email/password e GitHub OAuth;
- gestão de apartamentos;
- gestão de registos/estadias;
- proteção de rotas no frontend.

## Arranque rápido

1. Instalar dependências:

```bash
npm install
```

1. Configurar variáveis:

```bash
cp .env.example .env.local
```

1. Preencher `.env.local`:

```env
VITE_SUPABASE_URL=coloca-aqui-a-url
VITE_SUPABASE_ANON_KEY=coloca-aqui-a-chave-anon
```

1. Iniciar app:

```bash
npm run dev
```

> Usa apenas a `anon key` do Supabase no frontend.

## Scripts

- `npm run dev` inicia ambiente local.
- `npm run build` gera build de produção.
- `npm run preview` pré-visualiza build.
- `npm run typecheck` valida TypeScript.
- `npm run supabase:push` aplica migrações Supabase.

## Estrutura principal

- `src/lib/supabase.ts` cliente Supabase.
- `src/context/AuthContext.tsx` sessão e logout.
- `src/components/ProtectedRoute.tsx` proteção de rotas.
- `src/routes/` rotas da aplicação (`login`, `auth/callback`, `apartments`, `stays`).
- `src/data/` camada de acesso a dados.
- `supabase/migrations/` migrações SQL versionadas.

## Documentação

- Arquitetura: `docs/architecture.md`
- Roadmap: `docs/roadmap.md`
- Setup Supabase: `docs/supabase-setup.md`
- Checklist RLS: `docs/supabase-rls-checklist.md`
- Migrações: `supabase/migrations/`

## Deploy em GitHub Pages

O `vite.config.ts` usa `base: "/al-registo/"`. Se o nome do repositório for outro, atualiza esse valor.
