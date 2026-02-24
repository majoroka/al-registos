# Roadmap

## Visão

Concluir o MVP de registo de AL com segurança mínima de produção, qualidade de código estável e base pronta para evoluir.

## Fase 0 - Imediato (agora)

- [x] Login por email/password.
- [x] Login por GitHub OAuth.
- [x] Rotas protegidas.
- [x] CRUD base de apartamentos.
- [x] CRUD base de estadias.
- [x] Documentação de setup e checklist de segurança.
- [x] Criar migração inicial de schema (tabelas e FKs) para projetos novos.
- [ ] Aplicar migrações no novo projeto Supabase.
- [x] Corrigir erro de tipagem em `src/data/stays.ts`.

## Fase 1 - Estabilização (curto prazo)

- [ ] Linting e formatação (`eslint` + `prettier`).
- [ ] Testes unitários básicos para validações e helpers.
- [ ] Estados de loading/empty/error mais consistentes nas listas.
- [ ] Normalizar feedback de erro para todas as rotas.
- [ ] Melhorar UX do formulário de estadias (máscaras e validações de campo).

## Fase 2 - Segurança e confiabilidade

- [ ] Validar RLS com testes manuais de multi-utilizador.
- [ ] Garantir `owner_id not null` em produção após backfill.
- [ ] Revisão de grants e permissões `anon` vs `authenticated`.
- [ ] Logs de auditoria básicos para operações críticas.

## Fase 3 - Produto (médio prazo)

- [ ] Pesquisa e paginação de registos.
- [ ] Exportação CSV/PDF.
- [ ] Dashboard com métricas por ano/apartamento.
- [ ] Gestão de perfis/utilizadores.
- [ ] Histórico de alterações por registo.

## Critérios de pronto para produção (v1)

- [ ] `npm run typecheck` sem erros.
- [ ] Migrações versionadas e aplicadas no ambiente alvo.
- [ ] RLS validado para leitura/escrita entre utilizadores diferentes.
- [ ] Fluxo de autenticação testado em navegador privado.
- [ ] Backups e plano de recuperação documentados.
