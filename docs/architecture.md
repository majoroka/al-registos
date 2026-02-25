# Architecture

## Objetivo

Aplicação web para registo e consulta de hóspedes em Alojamento Local, com autenticação e persistência em Supabase.

## Stack

- Frontend: React 18 + TypeScript + Vite
- Router: `react-router-dom`
- Backend-as-a-Service: Supabase (Auth + Postgres + RLS)

## Rotas e layout

- `src/main.tsx`
  - Inicializa React, `BrowserRouter` com `basename` e `AuthProvider`.
- `src/App.tsx`
  - Define rotas (`/login`, `/auth/callback`, `/apartments`).
  - `/stays` redireciona para `/apartments`.
  - Renderiza header global (`AL Registo` + logout) quando existe sessão.
- `src/components/ProtectedRoute.tsx`
  - Exige sessão para aceder às rotas privadas.

## Autenticação

- `src/context/AuthContext.tsx`
  - Mantém estado de sessão (`session`, `loading`) e `signOut`.
- `src/routes/Login.tsx`
  - Login por email/password.
  - Login por GitHub OAuth (`signInWithOAuth`).
- `src/routes/AuthCallback.tsx`
  - Finaliza callback OAuth (`exchangeCodeForSession`) e redireciona para `/apartments`.

## Ecrã principal (`/apartments`)

- `src/routes/Apartments.tsx`
  - Cards de apartamentos com ação direta de criação de registo:
    - `T1 - Tropical (8168/AL)`
    - `T2 - Caravela (4668/AL)`
  - Formulário modal de criação/edição de registo.
  - Pesquisa global por todos os registos.
  - Menu hamburger no cabeçalho com:
    - `Consultar` (filtros por apartamento, ano, mês)
    - `Exportar` (placeholder)

## Camada de dados

- `src/lib/supabase.ts`
  - Cliente Supabase inicializado a partir de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `src/data/apartments.ts`
  - Leitura de apartamentos (`listApartments`).
- `src/data/stays.ts`
  - CRUD de estadias (`listStays`, `createStay`, `updateStay`, `deleteStay`).

## Modelo de dados

- `apartments`
  - `id`, `name`, `owner_id`, `created_at`
- `stays`
  - `id`, `guest_name`, `guest_phone`, `guest_email`, `guest_address`
  - `apartment_id`, `people_count`, `nights_count`
  - `linen`, `rating`, `notes`
  - `check_in`, `check_out`, `year`
  - `owner_id`, `created_at`

## Regras aplicadas no frontend

- `check-out` deve ser posterior a `check-in`.
- `nights_count` é calculado pelas datas.
- `year` é derivado do `check-in`.
- `linen` limitado a `Com Roupa` ou `Sem Roupa`.

## Base de dados e segurança

- Migrações versionadas em `supabase/migrations/`.
- RLS com isolamento por `owner_id`.
- `owner_id` obrigatório em `apartments` e `stays`.
- Trigger para sincronizar campos derivados (`nights_count`, `year`) quando há datas.

## Estado atual e riscos

- Estado:
  - fluxo principal e consultas já operacionais;
  - importação inicial de histórico executada via migração SQL.
- Riscos pendentes:
  - ausência de testes automatizados;
  - exportação ainda por implementar;
  - registos históricos ainda precisam de preenchimento de `check-in/check-out`.
