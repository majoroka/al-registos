# Architecture

## Objetivo

Aplicação web para registo, consulta e emissão documental de estadias de Alojamento Local, com isolamento de dados por utilizador em Supabase.

## Stack

- Frontend: React 18 + TypeScript + Vite
- Router: `react-router-dom`
- BaaS: Supabase (`Auth`, `Postgres`, `RLS`)
- Geração de PDF no browser: `html2canvas` + `jspdf`

## Rotas e layout

- `src/main.tsx`
  - Inicialização React, `BrowserRouter` com `basename` e `AuthProvider`.
- `src/App.tsx`
  - Rotas: `/login`, `/auth/callback`, `/apartments`.
  - `/stays` redireciona para `/apartments`.
  - Header global (`AL Registo` + logout) quando existe sessão.
- `src/components/ProtectedRoute.tsx`
  - Bloqueia acesso sem sessão.

## Autenticação

- `src/context/AuthContext.tsx`
  - Estado de sessão (`session`, `loading`) e `signOut`.
- `src/routes/Login.tsx`
  - Login por email/password.
- `src/routes/AuthCallback.tsx`
  - Rota de callback OAuth (compatibilidade com projetos que ativem provider externo).

## Ecrã principal (`/apartments`)

- `src/routes/Apartments.tsx`
  - Cards fixos de apartamentos:
    - `T1 - Tropical (8168/AL)`
    - `T2 - Caravela (4668/AL)`
  - Modal de criação/edição de registo.
  - Pesquisa global sempre visível.
  - Modal de consulta de registo completo.
  - Modal de confirmação de eliminação.
  - Menu hamburger com 4 modos:
    - `Consultar`
    - `Visualizar`
    - `Exportar`
    - `Imprimir`

## Painéis operacionais

- `Consultar`
  - Filtros por apartamento, ano, mês.
  - Resultado em lista acionável (`Editar`, `Criar`, `Consultar`, `Eliminar`).
- `Visualizar`
  - Mesmo layout de filtros.
  - Agrupamento visual por ano e mês para revisão em ecrã.
  - Inclui calendário mensal acima dos registos, com a mesma lógica visual do PDF/Impressão.
  - Mantém correspondência de cor entre célula do calendário e círculo do registo.
- `Exportar`
  - Mesmo layout de filtros.
  - Requer ano e mês.
  - Abre diálogo de nome e gera PDF no browser.
- `Imprimir`
  - Mesmo layout de filtros.
  - Requer ano e mês.
  - Abre janela de impressão.

## Documento de saída (PDF/Impressão)

- Construído em `buildExportDocumentHtml`.
- Estrutura:
  - cabeçalho do mês/ano;
  - calendário mensal com marcação de reservas;
  - lista de registos em cartões.
- Regras visuais:
  - cores por reserva para identificação;
  - dia com saída+entrada pode ter marcação combinada;
  - dia de saída sem nova entrada no mesmo dia pode aparecer como meia célula;
  - dias com número centrado em círculo (normal e spillover com estilos distintos);
  - cada registo mostra um círculo de referência de cor.
- Pipeline PDF:
  - HTML renderizado em `iframe`;
  - rasterização via `html2canvas`;
  - composição A4 com `jspdf`;
  - gravação via `showSaveFilePicker` quando disponível, com fallback para download.

## Camada de dados

- `src/lib/supabase.ts`
  - Cliente Supabase com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `src/data/apartments.ts`
  - `listApartments`.
- `src/data/stays.ts`
  - CRUD: `listStays`, `createStay`, `updateStay`, `deleteStay`.

## Modelo de dados

- `apartments`
  - `id`, `name`, `owner_id`, `created_at`
- `stays`
  - `id`, `guest_name`, `guest_phone`, `guest_email`, `guest_address`
  - `apartment_id`, `people_count`, `nights_count`
  - `linen`, `rating`, `notes`
  - `check_in`, `check_out`, `year`
  - `owner_id`, `created_at`

## Regras de frontend

- `check-out` deve ser posterior a `check-in`.
- `nights_count` derivado automaticamente das datas.
- `year` derivado de `check-in`.
- `linen` limitado a `Com Roupa` ou `Sem Roupa`.

## Segurança e persistência

- Migrações em `supabase/migrations`.
- RLS por `owner_id`.
- `owner_id` obrigatório em `apartments` e `stays`.
- Trigger para sincronização de campos derivados (`nights_count`, `year`) a partir de datas.

## Riscos atuais

- Sem suite de testes automatizados.
- Muita lógica concentrada em `src/routes/Apartments.tsx` (candidato a modularização).
- Exportação visual ainda em iteração de design para maximizar legibilidade/contraste.
- Renderização de gradientes na impressão pode variar entre browsers/impressoras (ex.: Safari).
