# AL Registo

Frontend em React + Vite + TypeScript para registo de hóspedes de Alojamento Local, com Supabase (Auth + Postgres + RLS).

## Estado atual

Projeto em fase inicial, mas com fluxo operacional completo para uso diário:

- login por email/password;
- rotas protegidas no frontend;
- ecrã principal orientado a 2 apartamentos;
- criação, edição, consulta e eliminação de registos;
- pesquisa global por todos os apartamentos;
- menu hamburger com 4 painéis:
  - `Consultar`
  - `Visualizar`
  - `Exportar`
  - `Imprimir`
- exportação em PDF com escolha de nome e gravação (com fallback por browser);
- impressão com layout dedicado;
- calendário mensal com marcação visual de reservas no `Visualizar`, `Exportar` e `Imprimir`;
- migrações Supabase aplicadas e importação inicial (43 registos).

## Fluxo principal (`/apartments`)

- Cards:
  - `T1 - Tropical (8168/AL)`
  - `T2 - Caravela (4668/AL)`
- Ao clicar num card, abre o formulário de criação de registo.
- Formulário com:
  - `Entrada / Saída` por seletor de datas (range);
  - cálculo automático de noites;
  - `Nº Pessoas`, `Roupa` (`Com Roupa`/`Sem Roupa`) e `Notas`.
- Pesquisa global sempre visível.
- Ações por registo: `Editar`, `Criar` (duplicar), `Consultar`, `Eliminar`.
- Eliminação com confirmação em modal custom.

## Painéis do menu

- `Consultar`:
  - filtros por apartamento, ano e mês;
  - lista de resultados com ações.
- `Visualizar`:
  - mesmos filtros;
  - apresentação agrupada por ano/mês para revisão em ecrã;
  - calendário por mês com o mesmo padrão visual de PDF/Impressão;
  - registos com círculo de cor correspondente à reserva.
- `Exportar`:
  - mesmos filtros;
  - exporta PDF (ano e mês obrigatórios);
  - calendário com dias em círculo, trocas no mesmo dia em diagonal e meio preenchimento no dia de saída.
- `Imprimir`:
  - mesmos filtros;
  - abre janela de impressão com o mesmo layout base do PDF.

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

> No frontend usa apenas a `anon key`.

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
- `src/components/DatePickerInput.tsx` seletor de datas (range).
- `src/routes/` rotas da aplicação.
- `src/data/` camada de acesso a dados.
- `supabase/migrations/` migrações SQL.

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

## Deploy em GitHub Pages

Deploy automático via GitHub Actions em `.github/workflows/deploy-pages.yml`.

- branch de deploy: `main`;
- base Vite: `"/al-registos/"`;
- fallback SPA: `dist/404.html`.

Checklist de ativação:

1. `Settings -> Pages`
1. Em `Build and deployment`, selecionar `Source: GitHub Actions`
1. Fazer push para `main` e verificar workflow `Deploy GitHub Pages`
