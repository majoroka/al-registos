# Roadmap

## Visão

Concluir o MVP de registo de AL com segurança mínima de produção, qualidade de código estável e base pronta para evoluir.

## Fase 0 - Imediato (agora)

- [x] Login por email/password.
- [x] Login por GitHub OAuth.
- [x] Rotas protegidas.
- [x] Fluxo principal em `/apartments` (cards -> criar registo).
- [x] CRUD base de estadias.
- [x] Pesquisa global com `Pesquisar` e `Limpar`.
- [x] Menu hamburger com `Consultar`.
- [x] Filtros de consulta por apartamento, ano e mês.
- [x] Documentação de setup e checklist de segurança.
- [x] Criar migração inicial de schema (tabelas e FKs) para projetos novos.
- [x] Aplicar migrações no projeto Supabase ativo.
- [x] Importar histórico inicial (`clientes_AL.csv`) via migração (43 registos).
- [x] Corrigir erro de tipagem em `src/data/stays.ts`.

## Fase 1 - Estabilização (curto prazo)

- [ ] Linting e formatação (`eslint` + `prettier`).
- [ ] Testes unitários básicos para validações e helpers.
- [ ] Uniformizar estados de loading/empty/error entre pesquisa global e consulta.
- [ ] Melhorar validação visual de campos no formulário (mensagens por campo).
- [ ] Fechar pequenos ajustes de alinhamento/responsividade no painel `Consultar`.

## Fase 2 - Segurança e confiabilidade

- [ ] Validar RLS com testes manuais de multi-utilizador.
- [x] Garantir `owner_id not null` após backfill/migração.
- [x] Revisão base de grants `anon` vs `authenticated` nas migrações.
- [ ] Logs de auditoria básicos para operações críticas.

## Fase 3 - Produto (médio prazo)

- [x] Pesquisa de registos (global + consulta filtrada).
- [ ] Exportação (`Exportar`) no menu hamburger.
- [ ] Preencher `check-in/check-out` no histórico importado.
- [ ] Paginação para listas de resultados maiores.
- [ ] Dashboard com métricas por ano/apartamento.
- [ ] Gestão de perfis/utilizadores.
- [ ] Histórico de alterações por registo.

## Critérios de pronto para produção (v1)

- [ ] `npm run typecheck` sem erros.
- [ ] Migrações versionadas e aplicadas no ambiente alvo.
- [ ] RLS validado para leitura/escrita entre utilizadores diferentes.
- [ ] Fluxo de autenticação testado em navegador privado.
- [ ] Backups e plano de recuperação documentados.
