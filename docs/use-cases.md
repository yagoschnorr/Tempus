# Casos de Uso — Tempus

---

## UC01 — Registrar Conta

**Atores:** Usuário não autenticado  
**Objetivo:** Permitir que um novo usuário crie uma conta na plataforma Tempus.  
**Pré-condição:** O e-mail informado não está cadastrado no sistema.  
**Pós-condição:** Conta criada com sucesso e usuário autenticado via token JWT.

**Fluxo principal:**

1. O usuário acessa a tela de cadastro.
2. O sistema exibe o formulário com campos: nome, e-mail, senha.
3. O usuário preenche os dados e submete o formulário.
4. O sistema valida os dados (e-mail, senha com critérios mínimos).
5. O sistema cria a conta no banco de dados.
6. O sistema retorna o token de acesso JWT e os dados do usuário.
7. O usuário é redirecionado para o dashboard.

---

## UC02 — Fazer Login

**Atores:** Usuário cadastrado  
**Objetivo:** Autenticar o usuário e conceder acesso à plataforma.  
**Pré-condição:** O usuário possui conta cadastrada e ativa.  
**Pós-condição:** Usuário autenticado com token JWT válido na sessão.

**Fluxo principal:**

1. O usuário acessa a tela de login.
2. O sistema solicita e-mail e senha.
3. O usuário informa as credenciais e confirma.
4. O sistema valida as credenciais no banco de dados.
5. O sistema gera e retorna um token de acesso JWT.
6. O usuário é redirecionado para o dashboard.

---

## UC03 — Gerenciar Matérias

**Atores:** Usuário autenticado  
**Objetivo:** Permitir ao usuário criar, visualizar, editar e excluir matérias de estudo.  
**Pré-condição:** Usuário autenticado na plataforma.  
**Pós-condição:** Matéria criada, atualizada ou removida com sucesso no banco de dados.

**Fluxo principal:**

1. O usuário acessa a seção de matérias.
2. O sistema lista todas as matérias cadastradas pelo usuário.
3. O usuário seleciona a ação desejada: criar, editar ou excluir.
4. Para criar: o usuário informa dados da matéria.
5. O sistema persiste as alterações e retorna os dados atualizados.
6. A lista de matérias é atualizada na interface.

---

## UC04 — Iniciar e Encerrar Sessão de Estudo

**Atores:** Usuário autenticado  
**Objetivo:** Registrar uma sessão de estudo cronometrada associada a uma matéria.  
**Pré-condição:** Usuário autenticado. Ao menos uma matéria cadastrada (opcional).  
**Pós-condição:** Sessão de estudo registrada com duração real, pausas e status final.

**Fluxo principal:**

1. O usuário acessa o timer de estudo e seleciona uma matéria (opcional).
2. O usuário define a duração planejada e inicia a sessão.
3. O sistema registra o horário de início e cria a sessão com status `in_progress`.
4. O usuário estuda pelo tempo determinado. Pode pausar e retomar.
5. O sistema registra o tempo de pausa acumulado.
6. O usuário encerra a sessão ao completar o tempo ou manualmente.
7. O sistema registra a duração real, atualiza o status para `completed` e salva as anotações.

---

## UC05 — Fazer Upload de Documento PDF

**Atores:** Usuário autenticado  
**Objetivo:** Carregar um documento PDF para a biblioteca pessoal e torná-lo pesquisável pela IA.  
**Pré-condição:** Usuário autenticado. Arquivo no formato PDF.  
**Pós-condição:** Documento armazenado, texto extraído, dividido em chunks e embeddings gerados no banco vetorial.

**Fluxo principal:**

1. O usuário acessa a biblioteca de documentos.
2. O usuário seleciona um arquivo PDF e uma matéria (opcional) e confirma o upload.
3. O sistema armazena o arquivo e cria o registro do documento com status `processing`.
4. O sistema extrai o texto do PDF via pdfplumber.
5. O sistema divide o texto em chunks com tiktoken.
6. O sistema gera embeddings via OpenAI e os armazena no banco vetorial (pgvector).
7. O sistema atualiza o status do documento para `ready`.

---

## UC06 — Gerar Quiz a partir de Tópico Geral

**Atores:** Usuário autenticado  
**Objetivo:** Criar um quiz de múltipla escolha gerado pela IA com base em um tema descrito pelo usuário.  
**Pré-condição:** Usuário autenticado.  
**Pós-condição:** Quiz criado com questões de múltipla escolha e gabaritos gerados pela IA.

**Fluxo principal:**

1. O usuário acessa a seção de quizzes e escolhe a opção "Tópico geral".
2. O usuário informa o tema, o número de questões e, opcionalmente, uma matéria.
3. O sistema envia o tema para a API da OpenAI solicitando a geração das questões.
4. A IA retorna as questões com opções (a, b, c, d), gabarito e explicação.
5. O sistema persiste o quiz e as questões no banco de dados com status `pending`.
6. O quiz fica disponível para o usuário responder.

---

## UC07 — Responder Quiz e Ver Resultado

**Atores:** Usuário autenticado  
**Objetivo:** Responder às questões de um quiz e obter o resultado com pontuação e explicações.  
**Pré-condição:** Usuário autenticado. Quiz criado com status `pending` ou `in_progress`.  
**Pós-condição:** Respostas registradas. Quiz com status `completed` e pontuação final calculada.

**Fluxo principal:**

1. O usuário acessa um quiz disponível.
2. O sistema exibe a primeira questão com as quatro opções de resposta.
3. O usuário seleciona uma resposta e confirma.
4. O sistema verifica se a resposta está correta e retorna o gabarito com explicação.
5. O usuário avança para a próxima questão e repete o processo.
6. Após a última questão, o sistema calcula a pontuação final (percentual de acertos).
7. O sistema atualiza o quiz para status `completed` e registra a data de conclusão.
8. O sistema exibe o resultado final ao usuário.

---

## UC08 — Gerenciar Cadernos e Anotações

**Atores:** Usuário autenticado  
**Objetivo:** Organizar anotações de estudo em cadernos, com suporte a criação, edição e exclusão.  
**Pré-condição:** Usuário autenticado na plataforma.  
**Pós-condição:** Cadernos e anotações criados, atualizados ou removidos com sucesso.

**Fluxo principal:**

1. O usuário acessa a seção de cadernos.
2. O sistema lista os cadernos do usuário, ordenados por fixados e por atividade recente.
3. O usuário cria um caderno informando título, descrição e cor.
4. O sistema persiste o caderno e o exibe na lista.
5. O usuário abre um caderno e cria uma anotação informando título e conteúdo.
6. O sistema salva a anotação e atualiza a data de última atividade do caderno.

---

## UC09 — Alterar Dados do Perfil

**Atores:** Usuário autenticado  
**Objetivo:** Atualizar informações pessoais da conta como nome e fuso horário.  
**Pré-condição:** Usuário autenticado.  
**Pós-condição:** Dados do perfil atualizados no banco de dados.

**Fluxo principal:**

1. O usuário acessa a seção de configurações do perfil.
2. O sistema exibe os dados atuais: nome, e-mail e fuso horário.
3. O usuário edita os campos desejados e confirma as alterações.
4. O sistema valida e persiste as atualizações.
5. O sistema retorna os dados do perfil atualizados.

---

## UC10 — Tirar Dúvida com IA via Chat (RAG)

**Atores:** Usuário autenticado  
**Objetivo:** Fazer perguntas a um assistente de IA que responde com base nos documentos do usuário.  
**Pré-condição:** Usuário autenticado. Ao menos um documento processado na biblioteca (opcional, mas necessário para respostas contextualizadas).  
**Pós-condição:** Pergunta respondida pela IA com base no contexto dos documentos. Conversa salva no histórico.

**Fluxo principal:**

1. O usuário acessa o chat e digita uma pergunta.
2. O sistema identifica a sessão de chat (nova ou existente).
3. O sistema gera o embedding da pergunta e busca os chunks mais relevantes no banco vetorial (pgvector).
4. O sistema monta o prompt com os trechos recuperados e envia para a OpenAI.
5. A IA gera uma resposta contextualizada.
6. O sistema salva a mensagem do usuário e a resposta da IA no histórico.
7. O sistema retorna a resposta com as fontes utilizadas (documento, página, trecho).

---

## UC11 — Gerar Quiz a partir de Documentos

**Atores:** Usuário autenticado  
**Objetivo:** Criar um quiz de múltipla escolha gerado pela IA com base no conteúdo de documentos da biblioteca.  
**Pré-condição:** Usuário autenticado. Ao menos um documento com status `ready` na biblioteca.  
**Pós-condição:** Quiz criado com questões derivadas do conteúdo dos documentos selecionados.

**Fluxo principal:**

1. O usuário acessa a seção de quizzes e escolhe a opção "A partir de documentos".
2. O usuário seleciona um ou mais documentos da biblioteca e define o número de questões.
3. O sistema recupera os chunks relevantes dos documentos via busca vetorial.
4. O sistema envia o conteúdo recuperado para a OpenAI solicitando a geração das questões.
5. A IA retorna as questões com opções (a, b, c, d), gabarito e explicação.
6. O sistema persiste o quiz e as questões com status `pending`.
7. O quiz fica disponível para o usuário responder.

---

## UC12 — Visualizar e Gerenciar Biblioteca de Documentos

**Atores:** Usuário autenticado  
**Objetivo:** Visualizar, filtrar e remover documentos da biblioteca pessoal.  
**Pré-condição:** Usuário autenticado.  
**Pós-condição:** Documentos listados conforme filtro aplicado. Documento removido quando solicitado.

**Fluxo principal:**

1. O usuário acessa a biblioteca de documentos.
2. O sistema lista todos os documentos do usuário com nome, matéria, tamanho e status.
3. O usuário pode filtrar por matéria ou ordenar por data, tamanho ou nome.
4. O sistema retorna a lista filtrada conforme os critérios selecionados.
5. O usuário seleciona um documento e solicita a exclusão.
6. O sistema remove o documento e seus chunks do banco de dados.

---

## UC13 — Gerar Plano de Estudos com IA

**Atores:** Usuário autenticado  
**Objetivo:** Criar um plano de estudos personalizado com base nas matérias, metas e tempo disponível do usuário.  
**Pré-condição:** Usuário autenticado. Ao menos uma matéria cadastrada.  
**Pós-condição:** Plano de estudos gerado pela IA e salvo no banco de dados.

**Fluxo principal:**

1. O usuário acessa a seção de plano de estudos.
2. O usuário informa as matérias, horas disponíveis por dia e data da próxima prova.
3. O sistema coleta o progresso atual do usuário (sessões, quizzes, metas semanais).
4. O sistema envia as informações para a OpenAI solicitando a geração do plano.
5. A IA retorna um plano com distribuição de horas por matéria e prioridades.
6. O sistema persiste o plano e o exibe ao usuário.

---

## UC14 — Visualizar Progresso no Dashboard

**Atores:** Usuário autenticado  
**Objetivo:** Apresentar ao usuário um resumo consolidado do seu desempenho e progresso de estudos.  
**Pré-condição:** Usuário autenticado.  
**Pós-condição:** Dados de progresso calculados e exibidos ao usuário.

**Fluxo principal:**

1. O usuário acessa o dashboard.
2. O sistema consulta os dados de sessões de estudo, quizzes e matérias do usuário.
3. O sistema calcula as métricas: horas estudadas na semana, sequência de dias, média de acertos em quizzes e matérias ativas.
4. O sistema retorna os dados agregados ao frontend.
5. O dashboard exibe os cards de métricas e o gráfico de progresso semanal.

---

## UC15 — Excluir Conta

**Atores:** Usuário autenticado  
**Objetivo:** Permitir que o usuário remova permanentemente sua conta e todos os dados associados.  
**Pré-condição:** Usuário autenticado.  
**Pós-condição:** Conta e todos os dados do usuário removidos permanentemente do sistema.

**Fluxo principal:**

1. O usuário acessa as configurações da conta e solicita a exclusão.
2. O sistema solicita confirmação via senha atual.
3. O usuário informa a senha e confirma a ação.
4. O sistema valida a senha.
5. O sistema remove todos os dados do usuário (sessões, documentos, quizzes, cadernos, planos).
6. O sistema encerra a sessão e redireciona o usuário para a tela inicial.