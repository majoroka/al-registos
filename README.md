# AL Registo

Frontend em React + Vite + TypeScript para registo de visitantes de Alojamento Local, com Supabase (Auth + Postgres).

## Estado atual

Projeto em fase inicial, já com funcionalidades nucleares operacionais:

- autenticação por email/password e GitHub OAuth;
- proteção de rotas no frontend;
- ecrã principal orientado a 2 apartamentos (cards de criação rápida);
- criação/edição de registos em modal;
- pesquisa global por todos os apartamentos;
- menu hamburger com item `Consultar` (filtros por apartamento, ano e mês);
- esquema e segurança Supabase aplicados por migrações;
- importação inicial de 43 registos históricos via migração SQL.

## Fluxo atual (`/apartments`)

- Cards:
  - `T1 - Tropical (8168/AL)`
  - `T2 - Caravela (4668/AL)`
- Ao clicar num card, abre diretamente o formulário de criação de registo.
- O formulário inclui `check-in` e `check-out` (datas), cálculo automático de noites, `Nº Pessoas`, `Roupa` (`Com Roupa`/`Sem Roupa`) e notas.
- A pesquisa global fica sempre visível e permite abrir um registo para edição.
- O menu hamburger (canto superior direito) tem:
  - `Consultar`: painel de filtros por apartamento/ano/mês;
  - `Exportar`: reservado para implementação posterior.

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
- `src/routes/` rotas da aplicação (`login`, `auth/callback`, `apartments`).
- `src/data/` camada de acesso a dados.
- `supabase/migrations/` migrações SQL versionadas.

## Migrações incluídas

- `20260224151000_initial_schema.sql`
- `20260224152000_security_rls.sql`
- `20260224153000_owner_not_null.sql`
- `20260224191500_add_checkin_checkout.sql`
- `20260224194000_sync_nights_from_dates.sql`
- `20260224203000_import_clientes_al.sql`

## Documentação

- Arquitetura: `docs/architecture.md`
- Roadmap: `docs/roadmap.md`
- Setup Supabase: `docs/supabase-setup.md`
- Checklist RLS: `docs/supabase-rls-checklist.md`
- Migrações: `supabase/migrations/`

## Deploy em GitHub Pages

Deploy automático configurado via GitHub Actions em `.github/workflows/deploy-pages.yml`.

- Branch de deploy: `main`
- Base Vite: `"/al-registos/"` (nome atual do repositório)
- Inclui fallback SPA (`dist/404.html`) para rotas como `/auth/callback`.

Para confirmar/publicar no GitHub:

1. `Settings -> Pages`
2. Em `Build and deployment`, selecionar `Source: GitHub Actions`.
3. Fazer push para `main` e verificar o workflow `Deploy GitHub Pages` em `Actions`.
