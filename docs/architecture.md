# Architecture

## Objetivo

Aplicação web para registo de hóspedes e estadias de Alojamento Local, com autenticação e persistência em Supabase.

## Stack

- Frontend: React 18 + TypeScript + Vite
- Router: `react-router-dom`
- Backend-as-a-Service: Supabase (Auth + Postgres + RLS)

## Componentes principais

- `src/main.tsx`
  - Inicializa React, `BrowserRouter` com `basename` e `AuthProvider`.
- `src/context/AuthContext.tsx`
  - Mantém estado de sessão (`session`, `loading`) e `signOut`.
- `src/App.tsx`
  - Define rotas e layout base.
- `src/components/ProtectedRoute.tsx`
  - Restringe acesso a rotas autenticadas.
- `src/routes/Login.tsx`
  - Login por email/password e GitHub OAuth.
- `src/routes/AuthCallback.tsx`
  - Finaliza callback OAuth e redireciona para `/apartments`.
- `src/routes/Apartments.tsx`
  - CRUD básico de apartamentos.
- `src/routes/Stays.tsx`
  - CRUD de registos/estadias com filtros por ano/apartamento.
- `src/data/*.ts`
  - Queries e mutações Supabase para tabelas `apartments` e `stays`.

## Fluxos

## 1) Arranque e sessão

1. `AuthProvider` consulta sessão atual no Supabase.
2. App renderiza rotas.
3. Rotas privadas exigem sessão válida.

## 2) Login email/password

1. Utilizador submete formulário.
2. `supabase.auth.signInWithPassword`.
3. Ao receber sessão, redireciona para `/apartments`.

## 3) Login GitHub OAuth

1. Utilizador clica `Entrar com GitHub`.
2. `signInWithOAuth` redireciona para GitHub.
3. Retorno em `/auth/callback`.
4. `exchangeCodeForSession` e redirecionamento para `/apartments`.

## Modelo de dados esperado

- `apartments`
  - `id`, `name`, `owner_id`, `created_at`
- `stays`
  - `id`, `guest_*`, `apartment_id`, `people_count`, `nights_count`, `rating`, `year`, `owner_id`, `created_at`

As migrações de segurança estão em `supabase/migrations/`.

## Segurança

- Variáveis sensíveis no frontend limitadas a `anon key`.
- RLS com isolamento por `owner_id`.
- Policies de leitura/escrita para utilizador autenticado.

## Riscos atuais

- Falta de testes automatizados.
- Migrações ainda precisam ser aplicadas no novo projeto Supabase.
