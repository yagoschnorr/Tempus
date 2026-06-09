# Casos de Teste End-to-End (E2E) — Tempus

Documento de especificação dos **casos de teste end-to-end** da plataforma **Tempus**, derivados dos casos de uso descritos em [`casos-de-uso.md`](./casos-de-uso.md).

Os testes E2E exercitam a aplicação de ponta a ponta a partir da interface (UI), validando os fluxos completos do usuário no navegador.

## Convenções

- **Ferramenta:** Playwright (Chromium), conforme `frontend/playwright.config.ts`.
- **Ambiente:** o Vite sobe com `VITE_USE_MOCKS=true` e `VITE_E2E=true`, de modo que o **MSW intercepta todas as chamadas `/api`** (sem backend real). As respostas vêm dos handlers em `src/lib/mocks/handlers.ts`.
- **Rastreabilidade:** cada caso de teste (CT) referencia o caso de uso (UC) que o originou.
- **Identificação:** `CTxx-n` onde `xx` é o número do UC associado e `n` o número do cenário.
- **Tipos de cenário:** Principal (caminho feliz), Alternativo (variação prevista) e Exceção (erro/validação).

### Legenda de status esperado

| Símbolo | Significado |
| :-----: | ----------- |
| ✅ | Resultado esperado de sucesso |
| ⚠️ | Resultado esperado de erro/validação tratada |
| ⛔ | Não automatizado (sem UI correspondente na aplicação atual) |

---

## CT01 — Cadastro de Usuário (UC01)

| Campo | Conteúdo |
| --- | --- |
| **Objetivo** | Validar o cadastro de um novo usuário pela UI. |
| **Pré-condições** | Aplicação carregada; nenhum usuário autenticado. |

### CT01-1 — Cadastro bem-sucedido (Principal) ✅
1. Acessar `/register`.
2. Preencher Nome, E-mail e Senha com dados válidos.
3. Submeter o formulário.
4. **Resultado esperado:** usuário é autenticado e redirecionado ao `/dashboard`; a navegação autenticada (sidebar) fica visível.

### CT01-2 — E-mail já cadastrado (Exceção) ⚠️
1. Acessar `/register` e preencher com um e-mail já existente.
2. Submeter o formulário.
3. **Resultado esperado:** mensagem de erro é exibida; o usuário permanece em `/register` e não é autenticado.

### CT01-3 — Validação de campos obrigatórios/formato (Exceção) ⚠️
1. Acessar `/register` e submeter com campos vazios ou e-mail em formato inválido.
2. **Resultado esperado:** mensagens de validação são exibidas; o envio é bloqueado.

---

## CT02 — Login (UC02)

| Campo | Conteúdo |
| --- | --- |
| **Objetivo** | Validar a autenticação de um usuário existente. |
| **Pré-condições** | Usuário previamente cadastrado (mock). |

### CT02-1 — Login bem-sucedido (Principal) ✅
1. Acessar `/login`.
2. Preencher E-mail e Senha válidos.
3. Clicar em "Entrar no Tempus".
4. **Resultado esperado:** redirecionamento para `/dashboard`; item de navegação "Matérias" visível.

### CT02-2 — Credenciais inválidas (Exceção) ⚠️
1. Acessar `/login` e informar senha incorreta.
2. Submeter.
3. **Resultado esperado:** mensagem de erro de autenticação; usuário permanece em `/login` sem token.

### CT02-3 — Persistência da sessão (Alternativo) ✅
1. Efetuar login com sucesso.
2. Recarregar a página.
3. **Resultado esperado:** o usuário continua autenticado (token lido de `localStorage["tempus.auth"]`).

---

## CT03 — Visualizar Perfil (UC03)

### CT03-1 — Exibição dos dados do perfil (Principal) ✅
1. Autenticar e acessar a área de perfil/configurações.
2. **Resultado esperado:** nome e e-mail do usuário autenticado são exibidos corretamente.

---

## CT04 — Atualizar Dados do Perfil (UC04)

### CT04-1 — Atualização de nome bem-sucedida (Principal) ✅
1. Autenticar e acessar as configurações de perfil.
2. Alterar o nome e salvar.
3. **Resultado esperado:** confirmação de sucesso; o novo nome é refletido na UI.

### CT04-2 — Validação de campo inválido (Exceção) ⚠️
1. Tentar salvar com nome vazio.
2. **Resultado esperado:** mensagem de validação; alteração não é persistida.

---

## CT05 — Alterar Senha (UC05)

### CT05-1 — Troca de senha bem-sucedida (Principal) ✅
1. Autenticar e acessar a troca de senha.
2. Informar a senha atual correta e uma nova senha válida; confirmar.
3. **Resultado esperado:** confirmação de sucesso.

### CT05-2 — Senha atual incorreta (Exceção) ⚠️
1. Informar senha atual errada e uma nova senha.
2. **Resultado esperado:** mensagem de erro; a senha não é alterada.

---

## CT06 — Alterar E-mail com Confirmação (UC06)

### CT06-1 — Solicitação de troca de e-mail (Principal) ✅
1. Autenticar e solicitar a alteração informando um novo e-mail.
2. **Resultado esperado:** confirmação de que o e-mail de verificação foi enviado.

### CT06-2 — Confirmação via link com token válido (Principal) ✅
1. Acessar `/auth/email/confirm` com um token válido.
2. **Resultado esperado:** mensagem de sucesso; troca de e-mail efetivada.

### CT06-3 — Token inválido/expirado (Exceção) ⚠️
1. Acessar `/auth/email/confirm` com um token inválido.
2. **Resultado esperado:** mensagem de erro; e-mail não é alterado.

---

## CT07 — Excluir Conta (UC07)

### CT07-1 — Exclusão de conta bem-sucedida (Principal) ✅
1. Autenticar e solicitar a exclusão da conta, confirmando a ação.
2. **Resultado esperado:** sessão encerrada e redirecionamento para a tela de login/cadastro.

### CT07-2 — Cancelar a exclusão (Alternativo) ✅
1. Iniciar a exclusão e cancelar na confirmação.
2. **Resultado esperado:** a conta permanece ativa e o usuário continua autenticado.

---

## CT08 — Gerenciar Matérias (UC08)

| Campo | Conteúdo |
| --- | --- |
| **Pré-condições** | Usuário autenticado. |

### CT08-1 — Criar matéria (Principal) ✅
1. Acessar `/subjects`.
2. Criar uma nova matéria informando nome (e cor/meta, se houver).
3. **Resultado esperado:** a matéria aparece na lista.

### CT08-2 — Editar matéria (Alternativo) ✅
1. Selecionar uma matéria existente e alterar seus dados; salvar.
2. **Resultado esperado:** a lista reflete os dados atualizados.

### CT08-3 — Excluir matéria (Alternativo) ✅
1. Excluir uma matéria existente e confirmar.
2. **Resultado esperado:** a matéria é removida da lista.

### CT08-4 — Validação ao criar sem nome (Exceção) ⚠️
1. Tentar criar uma matéria sem informar o nome.
2. **Resultado esperado:** mensagem de validação; matéria não é criada.

---

## CT09 — Iniciar Sessão de Foco (UC09)

### CT09-1 — Iniciar timer vinculado a uma matéria (Principal) ✅
1. Acessar `/timer`, definir a duração planejada e selecionar uma matéria.
2. Iniciar o timer.
3. **Resultado esperado:** o cronômetro inicia a contagem; a sessão fica com status "em andamento".

### CT09-2 — Iniciar timer sem matéria (Alternativo) ✅
1. Iniciar o timer sem selecionar matéria.
2. **Resultado esperado:** a sessão é criada normalmente sem matéria associada.

---

## CT10 — Pausar e Retomar Sessão (UC10)

### CT10-1 — Pausar e retomar (Principal) ✅
1. Com uma sessão em andamento, pausar o timer.
2. Aguardar e retomar.
3. **Resultado esperado:** a contagem é interrompida ao pausar e prossegue ao retomar; o tempo de pausa é contabilizado separadamente.

---

## CT11 — Concluir Sessão de Foco (UC11)

### CT11-1 — Concluir sessão (Principal) ✅
1. Com uma sessão em andamento, concluir a sessão.
2. **Resultado esperado:** a sessão é marcada como concluída; a duração efetiva e o tempo de pausa são registrados.

---

## CT12 — Abandonar Sessão de Foco (UC12)

### CT12-1 — Abandonar sessão (Principal) ✅
1. Com uma sessão em andamento ou pausada, abandonar a sessão.
2. **Resultado esperado:** a sessão é marcada como "abandonada" e não conta como concluída.

---

## CT13 — Consultar Histórico de Sessões (UC13)

> ⛔ **Não automatizado (E2E).** A aplicação atual não possui tela de histórico de
> sessões: o endpoint `GET /api/sessions` é consumido apenas para **hidratar a
> sessão ativa** no cronômetro (`useTimer`), não para listar sessões passadas.
> Sem UI correspondente, estes cenários não são testáveis end-to-end e ficam
> registrados como `test.skip` em `ct09-ct13-timer-sessions.spec.ts` (para
> preservar a rastreabilidade). Reavaliar quando a tela de histórico existir.

### CT13-1 — Listar histórico (Principal) ⛔ (sem UI)
1. Acessar o histórico de sessões.
2. **Resultado esperado:** as sessões realizadas são listadas.

### CT13-2 — Ver detalhes de uma sessão (Alternativo) ⛔ (sem UI)
1. Abrir uma sessão específica da lista.
2. **Resultado esperado:** os detalhes (duração, pausa, status, horários) são exibidos.

---

## CT14 — Upload e Processamento de Documento (UC14)

### CT14-1 — Upload de PDF bem-sucedido (Principal) ✅
1. Acessar `/documents` e enviar um arquivo PDF válido.
2. **Resultado esperado:** o documento aparece com status "processing" e, após o processamento (mock), transita para "ready".

### CT14-2 — Arquivo inválido (Exceção) ⚠️
1. Tentar enviar um arquivo de tipo não suportado.
2. **Resultado esperado:** mensagem de erro; o documento não é criado.

### CT14-3 — Falha no processamento (Exceção) ⚠️
1. Enviar um documento cujo processamento (mock) falhe.
2. **Resultado esperado:** o documento é exibido com status "failed".

---

## CT15 — Gerenciar Documentos (UC15)

### CT15-1 — Listar documentos com status (Principal) ✅
1. Acessar `/documents`.
2. **Resultado esperado:** os documentos são listados com seus respectivos status.

### CT15-2 — Excluir documento (Alternativo) ✅
1. Excluir um documento existente e confirmar.
2. **Resultado esperado:** o documento é removido da lista.

---

## CT16 — Chat com RAG (UC16)

### CT16-1 — Nova conversa com resposta e fontes (Principal) ✅
1. Acessar `/chat` e enviar uma pergunta.
2. **Resultado esperado:** a resposta do assistente é exibida acompanhada das fontes; a conversa passa a constar na lista de sessões.

### CT16-2 — Pergunta sem documentos disponíveis (Alternativo) ✅
1. Enviar uma pergunta sem documentos "ready".
2. **Resultado esperado:** o assistente responde (sem fontes ou indicando ausência de contexto), sem erro de aplicação.

---

## CT17 — Continuar Conversa em Sessão (UC17)

### CT17-1 — Enviar nova mensagem em sessão existente (Principal) ✅
1. Abrir uma conversa existente e enviar nova mensagem.
2. **Resultado esperado:** a nova troca é adicionada ao histórico, preservando as mensagens anteriores.

---

## CT18 — Gerenciar Sessões de Chat (UC18)

### CT18-1 — Listar e abrir conversa (Principal) ✅
1. Acessar a lista de conversas e abrir uma delas.
2. **Resultado esperado:** o histórico completo da conversa é exibido.

### CT18-2 — Renomear conversa (Alternativo) ✅
1. Renomear uma conversa existente.
2. **Resultado esperado:** o novo título é refletido na lista.

### CT18-3 — Excluir conversa (Alternativo) ✅
1. Excluir uma conversa e confirmar.
2. **Resultado esperado:** a conversa é removida da lista.

---

## CT19 — Gerar Quiz (UC19)

### CT19-1 — Gerar quiz com sucesso (Principal) ✅
1. Acessar `/quiz` e solicitar a geração informando tema/matéria e quantidade de questões.
2. **Resultado esperado:** um novo quiz é criado e exibido com suas questões.

### CT19-2 — Validação de parâmetros (Exceção) ⚠️
1. Tentar gerar um quiz sem informar os parâmetros obrigatórios.
2. **Resultado esperado:** mensagem de validação; o quiz não é gerado.

---

## CT20 — Responder Quiz (UC20)

### CT20-1 — Responder e finalizar (Principal) ✅
1. Iniciar um quiz, responder a todas as questões e finalizar.
2. **Resultado esperado:** a pontuação/resultado é calculada e apresentada.

### CT20-2 — Reiniciar quiz (Alternativo) ✅
1. Após concluir um quiz, reiniciá-lo.
2. **Resultado esperado:** as respostas anteriores são zeradas e o quiz pode ser refeito.

---

## CT21 — Gerenciar Quizzes (UC21)

### CT21-1 — Listar e visualizar quizzes (Principal) ✅
1. Acessar a lista de quizzes e abrir um deles.
2. **Resultado esperado:** o quiz e seus resultados são exibidos.

### CT21-2 — Excluir quiz (Alternativo) ✅
1. Excluir um quiz e confirmar.
2. **Resultado esperado:** o quiz é removido da lista.

---

## CT22 — Gerar Plano de Estudos (UC22)

| Campo | Conteúdo |
| --- | --- |
| **Pré-condições** | Usuário autenticado com matérias cadastradas. |

### CT22-1 — Gerar plano com sucesso (Principal) ✅
1. Acessar `/study-plan` e informar título, data da prova, horas diárias e matérias com prioridades.
2. Solicitar a geração.
3. **Resultado esperado:** o plano é gerado com conteúdo e status inicial, e fica disponível na lista.

### CT22-2 — Validação sem matérias selecionadas (Exceção) ⚠️
1. Tentar gerar um plano sem selecionar matérias.
2. **Resultado esperado:** mensagem de validação; o plano não é gerado.

---

## CT23 — Gerenciar Planos de Estudo (UC23)

### CT23-1 — Listar e abrir plano (Principal) ✅
1. Acessar a lista de planos e abrir um plano.
2. **Resultado esperado:** o conteúdo do plano é exibido.

### CT23-2 — Atualizar status do plano (Alternativo) ✅
1. Alterar o status de um plano (ex.: para "concluído").
2. **Resultado esperado:** o novo status é refletido na UI.

---

## CT24 — Gerenciar Cadernos (UC24)

### CT24-1 — Criar caderno (Principal) ✅
1. Acessar `/notebooks` e criar um caderno informando título.
2. **Resultado esperado:** o caderno aparece na lista.

### CT24-2 — Renomear caderno (Alternativo) ✅
1. Renomear um caderno existente.
2. **Resultado esperado:** o novo título é refletido na lista.

### CT24-3 — Excluir caderno (Alternativo) ✅
1. Excluir um caderno e confirmar.
2. **Resultado esperado:** o caderno é removido da lista.

---

## CT25 — Gerenciar Anotações (UC25)

| Campo | Conteúdo |
| --- | --- |
| **Pré-condições** | Existe um caderno criado. |

### CT25-1 — Criar anotação (Principal) ✅
1. Abrir um caderno (`/notebooks/:id`) e criar uma anotação com título e conteúdo.
2. **Resultado esperado:** a anotação aparece no caderno.

### CT25-2 — Editar anotação (Alternativo) ✅
1. Editar uma anotação existente e salvar.
2. **Resultado esperado:** o conteúdo atualizado é exibido.

### CT25-3 — Excluir anotação (Alternativo) ✅
1. Excluir uma anotação e confirmar.
2. **Resultado esperado:** a anotação é removida do caderno.

---

## CT26 — Resumir Anotação com IA (UC26)

### CT26-1 — Gerar resumo de anotação (Principal) ✅
1. Abrir uma anotação com conteúdo e solicitar o resumo.
2. **Resultado esperado:** o resumo gerado é exibido e associado à anotação.

---

## CT27 — Visualizar Dashboard de Progresso (UC27)

### CT27-1 — Exibição das métricas (Principal) ✅
1. Autenticar e acessar `/dashboard`.
2. **Resultado esperado:** são exibidas as métricas em tempo real: minutos estudados (dia/semana), número de sessões (dia/semana), sequência atual (streak) e média de pontuação dos quizzes na semana.

### CT27-2 — Redirecionamento da raiz para o dashboard (Alternativo) ✅
1. Acessar a rota raiz `/` autenticado.
2. **Resultado esperado:** redirecionamento automático para `/dashboard`.

---

## CT-AUTH — Controle de Acesso a Rotas Protegidas (transversal)

> Caso de teste transversal de segurança de navegação (`RequireAuth`), aplicável a todas as rotas autenticadas.

### CT-AUTH-1 — Acesso não autenticado é bloqueado (Exceção) ⚠️
1. Sem autenticação, tentar acessar uma rota protegida (ex.: `/subjects`).
2. **Resultado esperado:** redirecionamento para `/login`.

### CT-AUTH-2 — Logout encerra a sessão (Principal) ✅
1. Autenticado, efetuar logout.
2. **Resultado esperado:** sessão encerrada e redirecionamento para `/login`; rotas protegidas deixam de ser acessíveis.
