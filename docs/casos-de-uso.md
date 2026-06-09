# Casos de Uso — Tempus

Documento de especificação dos casos de uso da plataforma **Tempus**, uma plataforma de rotina de estudos com timer de foco, organização de matérias/metas e assistente de estudos baseado em IA (OpenAI).

## Atores

- **Usuário Não Autenticado (Visitante):** pessoa sem sessão ativa que pode se cadastrar, confirmar e-mail ou efetuar login.
- **Usuário Autenticado (Estudante):** usuário com sessão válida (JWT) que utiliza as funcionalidades da plataforma.
- **Sistema de IA (OpenAI):** ator de apoio acionado para chat com RAG, geração de quizzes, geração de planos de estudo e resumo de anotações.

---

## UC01 - Cadastro de Usuário
**Ator Principal:** Usuário Não Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que um novo usuário crie sua conta na plataforma.
**Pré-condições:** Nenhuma.
**Fluxo Principal:**
1. O usuário acessa a tela de Cadastro.
2. Informa os dados (Nome, E-mail, Senha).
3. O sistema valida as credenciais e criptografa a senha.
4. O sistema cria o registro no banco de dados e retorna o token de acesso (JWT).

**Pós-condições:** Uma nova conta de usuário é criada e ele é autenticado na plataforma.

---

## UC02 - Login (Autenticação)
**Ator Principal:** Usuário Não Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que um usuário existente acesse sua conta.
**Pré-condições:** O usuário possui uma conta cadastrada.
**Fluxo Principal:**
1. O usuário acessa a tela de Login.
2. Informa E-mail e Senha.
3. O sistema valida as credenciais contra o registro armazenado.
4. O sistema gera e retorna o token de acesso (JWT), que é persistido no navegador.

**Fluxo Alternativo:**
- 3a. Credenciais inválidas: o sistema retorna erro de autenticação e não emite token.

**Pós-condições:** O usuário fica autenticado e é redirecionado ao Dashboard.

---

## UC03 - Visualizar Perfil do Usuário
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Exibir os dados da conta do usuário autenticado.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O sistema lê o token JWT da requisição.
2. Valida o token e carrega o registro do usuário.
3. Retorna os dados do perfil (nome, e-mail).

**Pós-condições:** Os dados do perfil são apresentados ao usuário.

---

## UC04 - Atualizar Dados do Perfil
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que o usuário altere seus dados cadastrais (ex.: nome).
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa as configurações de perfil.
2. Edita os campos desejados.
3. O sistema valida e persiste as alterações.
4. Retorna o perfil atualizado.

**Pós-condições:** Os dados do usuário são atualizados no banco de dados.

---

## UC05 - Alterar Senha
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que o usuário troque sua senha de acesso.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário informa a senha atual e a nova senha.
2. O sistema verifica se a senha atual confere.
3. O sistema criptografa e persiste a nova senha.

**Fluxo Alternativo:**
- 2a. Senha atual incorreta: o sistema rejeita a operação e mantém a senha anterior.

**Pós-condições:** A senha do usuário é atualizada.

---

## UC06 - Alterar E-mail com Confirmação
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir a troca de e-mail mediante confirmação por link/token enviado por e-mail.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário solicita a alteração informando o novo e-mail.
2. O sistema gera um token de confirmação e envia uma mensagem ao novo endereço.
3. O usuário acessa o link de confirmação.
4. O sistema valida o token e efetiva a troca do e-mail.

**Fluxo Alternativo:**
- 4a. Token inválido ou expirado: a troca não é realizada.

**Pós-condições:** O e-mail do usuário é atualizado após a confirmação.

---

## UC07 - Excluir Conta
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que o usuário remova permanentemente sua conta e seus dados.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário solicita a exclusão da conta.
2. O sistema remove o registro do usuário e os dados associados.

**Pós-condições:** A conta é excluída e o usuário deixa de estar autenticado.

---

## UC08 - Gerenciar Matérias (Subjects)
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir criar, listar, visualizar, editar e excluir matérias de estudo.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa a tela de Matérias.
2. Cria uma nova matéria informando nome (e atributos como cor/meta).
3. O sistema persiste a matéria vinculada ao usuário.
4. O usuário pode listar, editar ou excluir suas matérias.

**Pós-condições:** As matérias do usuário ficam organizadas e disponíveis para vincular a sessões e planos.

---

## UC09 - Iniciar Sessão de Foco (Timer)
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Iniciar uma sessão de estudo cronometrada, opcionalmente vinculada a uma matéria.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário define a duração planejada e (opcionalmente) a matéria.
2. O usuário inicia o timer.
3. O sistema cria a sessão com status "em andamento" e registra o horário de início.

**Pós-condições:** Uma sessão de foco ativa é criada e o cronômetro está em execução.

---

## UC10 - Pausar e Retomar Sessão de Foco
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir interromper temporariamente e depois retomar a sessão em andamento.
**Pré-condições:** Existe uma sessão de foco em andamento.
**Fluxo Principal:**
1. O usuário pausa a sessão; o sistema registra o início da pausa.
2. O usuário retoma a sessão; o sistema acumula o tempo de pausa.

**Pós-condições:** O tempo de pausa é contabilizado separadamente da duração efetiva de estudo.

---

## UC11 - Concluir Sessão de Foco
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Encerrar uma sessão de estudo registrando o tempo efetivamente estudado.
**Pré-condições:** Existe uma sessão de foco em andamento.
**Fluxo Principal:**
1. O usuário conclui a sessão.
2. O sistema registra a duração real, o tempo total de pausa e o horário de término.
3. O sistema marca a sessão como concluída.

**Pós-condições:** A sessão concluída passa a compor as métricas de progresso do usuário.

---

## UC12 - Abandonar Sessão de Foco
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Encerrar uma sessão sem concluí-la (abandono).
**Pré-condições:** Existe uma sessão de foco em andamento ou pausada.
**Fluxo Principal:**
1. O usuário abandona a sessão.
2. O sistema marca a sessão com status "abandonada" e registra o término.

**Pós-condições:** A sessão é encerrada como abandonada e não conta como sessão concluída.

---

## UC13 - Consultar Histórico de Sessões
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Listar e visualizar detalhes das sessões de estudo realizadas.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa o histórico de sessões.
2. O sistema lista as sessões do usuário (com filtros opcionais).
3. O usuário pode abrir uma sessão específica para ver seus detalhes.

**Pós-condições:** O histórico de sessões é apresentado ao usuário.

---

## UC14 - Upload e Processamento de Documento (PDF)
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI — embeddings)
**Descrição/Objetivo:** Permitir o envio de materiais (PDF) que serão processados para uso na base de conhecimento (RAG).
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário envia um arquivo PDF.
2. O sistema cria o documento com status "processing".
3. O sistema extrai o texto, divide em trechos (chunks) e gera embeddings.
4. Os trechos com embeddings são persistidos e o documento passa para status "ready".

**Fluxo Alternativo:**
- 3a. Falha no processamento: o documento recebe status "failed".

**Pós-condições:** O documento fica disponível como fonte de contexto para o chat com RAG.

---

## UC15 - Gerenciar Documentos
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Listar, visualizar o status e excluir documentos enviados.
**Pré-condições:** O usuário está autenticado e possui documentos enviados.
**Fluxo Principal:**
1. O usuário acessa a lista de documentos.
2. O sistema exibe os documentos e seus status (processing/ready/failed).
3. O usuário pode excluir um documento.

**Pós-condições:** Os documentos ficam organizados; documentos excluídos deixam de ser usados no RAG.

---

## UC16 - Conversar com o Assistente de Estudos (Chat com RAG)
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI — chat + embeddings)
**Descrição/Objetivo:** Permitir que o usuário faça perguntas e receba respostas contextualizadas pelos seus documentos.
**Pré-condições:** O usuário está autenticado; preferencialmente possui documentos com status "ready".
**Fluxo Principal:**
1. O usuário inicia uma nova conversa enviando uma pergunta.
2. O sistema gera o embedding da pergunta e recupera os trechos mais relevantes (retrieval).
3. O sistema envia o contexto recuperado e a pergunta ao modelo de IA.
4. O sistema retorna a resposta acompanhada das fontes utilizadas.

**Pós-condições:** A pergunta e a resposta (com fontes) ficam registradas em uma sessão de chat.

---

## UC17 - Continuar Conversa em Sessão de Chat
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI)
**Descrição/Objetivo:** Permitir enviar novas perguntas dentro de uma conversa existente, mantendo o histórico.
**Pré-condições:** Existe uma sessão de chat criada.
**Fluxo Principal:**
1. O usuário envia uma nova mensagem na sessão existente.
2. O sistema considera o histórico e o contexto recuperado por RAG.
3. O sistema retorna a resposta com as fontes.

**Pós-condições:** A nova troca de mensagens é adicionada ao histórico da sessão.

---

## UC18 - Gerenciar Sessões de Chat
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Listar, abrir, renomear e excluir conversas com o assistente.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa a lista de conversas.
2. Pode abrir uma conversa para ver o histórico completo.
3. Pode renomear ou excluir uma conversa.

**Pós-condições:** As conversas ficam organizadas conforme as ações do usuário.

---

## UC19 - Gerar Quiz a partir de Conteúdo
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI)
**Descrição/Objetivo:** Gerar automaticamente um questionário de estudo a partir de um conteúdo/matéria.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário solicita a geração de um quiz informando os parâmetros (tema/matéria, quantidade de questões).
2. O sistema aciona a IA para gerar as questões e alternativas.
3. O sistema persiste o quiz com suas questões.

**Pós-condições:** Um novo quiz fica disponível para ser respondido pelo usuário.

---

## UC20 - Responder Quiz
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Permitir que o usuário inicie, responda às questões e finalize um quiz.
**Pré-condições:** Existe um quiz gerado.
**Fluxo Principal:**
1. O usuário inicia o quiz.
2. Responde a cada questão, e o sistema registra as respostas.
3. O usuário finaliza o quiz.
4. O sistema calcula e apresenta o resultado/pontuação.

**Fluxo Alternativo:**
- 5a. O usuário reinicia o quiz para refazê-lo do zero.

**Pós-condições:** O resultado do quiz é registrado e compõe as métricas de desempenho.

---

## UC21 - Gerenciar Quizzes
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Listar, visualizar e excluir quizzes existentes.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa a lista de quizzes.
2. Visualiza um quiz e seus resultados.
3. Pode excluir um quiz.

**Pós-condições:** Os quizzes ficam organizados conforme as ações do usuário.

---

## UC22 - Gerar Plano de Estudos com IA
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI)
**Descrição/Objetivo:** Gerar um plano de estudos personalizado considerando matérias, prioridades, data da prova e horas disponíveis por dia.
**Pré-condições:** O usuário está autenticado e possui matérias cadastradas.
**Fluxo Principal:**
1. O usuário informa título, data da prova (opcional), horas diárias disponíveis e as matérias com suas prioridades.
2. O sistema aciona a IA para elaborar o conteúdo do plano.
3. O sistema persiste o plano com status inicial.

**Pós-condições:** Um plano de estudos personalizado é criado e disponibilizado ao usuário.

---

## UC23 - Gerenciar Planos de Estudo
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Listar, visualizar e atualizar o status de planos de estudo.
**Pré-condições:** O usuário possui planos de estudo gerados.
**Fluxo Principal:**
1. O usuário acessa a lista de planos.
2. Abre um plano para visualizar seu conteúdo.
3. Atualiza o status do plano (ex.: em andamento, concluído).

**Pós-condições:** O status do plano reflete o progresso do usuário.

---

## UC24 - Gerenciar Cadernos (Notebooks)
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Criar, listar, editar e excluir cadernos para organizar anotações.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa a área de Cadernos.
2. Cria um caderno informando título.
3. Pode listar, renomear ou excluir seus cadernos.

**Pós-condições:** Os cadernos ficam disponíveis para conter anotações.

---

## UC25 - Gerenciar Anotações (Notes)
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Criar, listar, editar e excluir anotações dentro de um caderno.
**Pré-condições:** Existe um caderno criado.
**Fluxo Principal:**
1. O usuário abre um caderno.
2. Cria uma anotação com título e conteúdo.
3. Pode listar, editar ou excluir as anotações do caderno.

**Pós-condições:** As anotações ficam armazenadas e organizadas dentro do caderno.

---

## UC26 - Resumir Anotação com IA
**Ator Principal:** Usuário Autenticado (Estudante)
**Ator de Apoio:** Sistema de IA (OpenAI)
**Descrição/Objetivo:** Gerar automaticamente um resumo do conteúdo de uma anotação.
**Pré-condições:** Existe uma anotação com conteúdo.
**Fluxo Principal:**
1. O usuário solicita o resumo de uma anotação.
2. O sistema envia o conteúdo ao modelo de IA.
3. O sistema retorna e associa o resumo gerado à anotação.

**Pós-condições:** O resumo da anotação fica disponível para o usuário.

---

## UC27 - Visualizar Dashboard de Progresso
**Ator Principal:** Usuário Autenticado (Estudante)
**Descrição/Objetivo:** Apresentar métricas agregadas de produtividade e desempenho do usuário.
**Pré-condições:** O usuário está autenticado.
**Fluxo Principal:**
1. O usuário acessa o Dashboard.
2. O sistema calcula e retorna métricas em tempo real: minutos estudados no dia e na semana, número de sessões no dia e na semana, sequência atual (streak) e média de pontuação dos quizzes na semana.

**Pós-condições:** As métricas de progresso são exibidas ao usuário.

---
