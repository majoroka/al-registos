# Roadmap

## Visão

Consolidar o MVP de registo AL com operação diária estável, segurança consistente e documentação suficiente para manutenção.

## Fase 0 - Base funcional (concluída)

- [x] Login por email/password.
- [x] Rotas protegidas.
- [x] Fluxo principal em `/apartments` (cards -> criar registo).
- [x] CRUD de estadias.
- [x] Pesquisa global com `Pesquisar` e `Limpar`.
- [x] Modal de consulta completa do registo.
- [x] Eliminação com confirmação em modal custom.
- [x] Formulário com `Entrada/Saída` e cálculo automático de noites.
- [x] Menu hamburger com 4 áreas:
  - `Consultar`
  - `Visualizar`
  - `Exportar`
  - `Imprimir`
- [x] Exportação PDF e impressão com layout dedicado.
- [x] Migrações de schema + RLS aplicadas.
- [x] Importação histórica inicial (`clientes_AL.csv`, 43 registos).
- [x] Deploy GitHub Pages configurado.

## Fase 1 - Estabilização UX/UI (curto prazo)

- [ ] Afinar design do calendário no documento de saída (contraste e legibilidade).
- [ ] Rever densidade tipográfica do PDF para diferentes volumes mensais.
- [ ] Ajustar consistência visual dos estados `loading/empty/error` entre painéis.
- [ ] Validar responsividade final dos painéis de menu em mobile.
- [ ] Pequena modularização do `Apartments.tsx` (extração de helpers de exportação).

## Fase 2 - Qualidade e manutenção

- [ ] Configurar `eslint` + `prettier`.
- [ ] Introduzir testes unitários para validações e helpers de datas.
- [ ] Criar testes de fluxo mínimo para filtros e exportação.
- [ ] Definir convenções de versionamento e changelog.

## Fase 3 - Segurança e operação

- [ ] Executar auditoria manual multi-utilizador RLS.
- [ ] Definir processo de rotação de credenciais/tokens.
- [ ] Documentar rotina de backup e recuperação.
- [ ] Rever permissões e políticas após cada nova migração.

## Fase 4 - Evolução de produto

- [ ] Dashboard com métricas por apartamento/ano/mês.
- [ ] Paginação para listas maiores.
- [ ] Histórico de alterações por registo.
- [ ] Gestão de utilizadores/perfis (quando necessário).
- [ ] Estratégia de importação incremental de históricos futuros.

## Critérios de pronto para produção (v1)

- [ ] `npm run typecheck` sem erros.
- [ ] Migrações aplicadas e verificadas no ambiente alvo.
- [ ] RLS validado em cenário com dois utilizadores distintos.
- [ ] Fluxo completo (`Consultar`/`Visualizar`/`Exportar`/`Imprimir`) validado em browser alvo.
- [ ] Processo operacional documentado (backup, rollback, suporte).
