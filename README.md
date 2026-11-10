# Casa de Leilões (leilõesPaintings)

> Um leiloeiro cria lotes a partir de obras de arte buscadas numa API pública (Art Institute of Chicago), definindo lance inicial, incremento mínimo e horários de início e fim. Licitantes depositam um saldo simulado e disputam cada lote com lances ao vivo; o valor de quem está ganhando fica comprometido na carteira e volta ao disponível assim que alguém cobre. Quem vence recebe um comprovante assinado que pode compartilhar por link, e qualquer pessoa, mesmo sem login, consegue conferir na página de auditoria que o histórico de lances do lote não foi adulterado.

Projeto do desafio técnico Elite Dev da Verzel.

| | |
|---|---|
| **Aplicação (deploy)** | https://leiloespaintings.vercel.app |
| **API (deploy)** | https://casa-de-leiloes-jq4l.onrender.com (`GET /health`) |
| **Repositório** | front e back no mesmo repositório: `frontend/` e `backend/` |

## Acesso rápido para avaliação

1. Abra https://leiloespaintings.vercel.app. A API está no plano gratuito do Render, que "dorme" quando fica parada: o **primeiro acesso pode levar cerca de 50 s** para responder.
2. Entre com uma das contas de demonstração (tabela em [Contas de demonstração](#contas-de-demonstração)). Os dados já estão carregados: um lote ao vivo com lances, um sem lances, um agendado e um encerrado com comprovante.
3. Para ver a disputa em tempo real, use duas janelas (uma normal e uma anônima), cada uma com um licitante, no mesmo lote ao vivo.

## Funcionalidades

**Leiloeiro (`SELLER`)**: não dá lances.
- Busca obras na API do Art Institute of Chicago e cria um lote a partir delas (imagem, título, atributos da obra, lance inicial, incremento mínimo, início e fim, descrição).
- Cancela lotes que ainda não receberam lances.
- Vê o resultado de cada lote encerrado (arrematado ou não, e por quanto) e o total recebido.

**Licitante (`BIDDER`)**
- Deposita saldo simulado e acompanha saldo total, comprometido e disponível, com extrato.
- Entra na sala do lote ao vivo: lance atual, histórico, posição, contagem regressiva e indicador "você está ganhando" / "você foi superado", tudo atualizado em tempo real (SSE), sem recarregar a página.
- Dá lances; toda recusa volta com o motivo (abaixo do mínimo, saldo insuficiente, você já está ganhando, lote ainda não iniciado, lote encerrado).
- Em **Meus lances** (página "Meus lances e arremates") vê os lotes em que deu lance e os que venceu, com o comprovante e o link de compartilhamento.

**Qualquer pessoa, sem login**
- Vitrine com lotes ao vivo, agendados e encerrados (cancelados não aparecem).
- Sala do lote em modo leitura.
- **Auditoria** do histórico de lances, com o resultado "íntegro" ou "adulterado".
- Comprovante compartilhado por link, sem dados pessoais.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router |
| Backend | Node.js, Express 5 (JavaScript, ES modules) |
| Banco | PostgreSQL (Neon), acessado com Prisma 7 |
| Validação | Zod (modo estrito) |
| Autenticação | JWT (8 h) + bcrypt |
| Tempo real | Server-Sent Events |
| Testes | Vitest |

## Regras de lance

Só são aceitos em lote **ao vivo** (`início ≤ agora < fim`, pelo relógio do servidor).

| Situação | Regra |
|---|---|
| Primeiro lance | maior ou igual ao **lance inicial** |
| Lances seguintes | maiores ou iguais ao **lance atual + incremento mínimo** |
| Líder | não pode cobrir o próprio lance |
| Saldo | o lance precisa caber no saldo **disponível** (total − comprometido) |
| Anti-sniping | lance aceito nos últimos 2 minutos soma **+2 minutos** ao fim do lote, a cada vez que acontecer |

Recusas e seus motivos: abaixo do mínimo · saldo insuficiente · você já está ganhando · lote ainda não iniciado · lote encerrado.

Ao encerrar, o valor é debitado do vencedor, creditado ao leiloeiro e o comprovante é gerado. Lote sem lances fecha sem vencedor.

## Documentação complementar

| Documento | Conteúdo |
|---|---|
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisões de projeto (D1 a D16), com o que foi descartado |
| [docs/FLOW.md](docs/FLOW.md) | Fluxo do sistema, do cadastro à liquidação |
| [docs/ERD.md](docs/ERD.md) | Modelo de dados (8 tabelas) |
| [docs/AUDIT.md](docs/AUDIT.md) | Como a auditoria detecta adulteração (cadeia de hashes selada com HMAC), o que pega e os limites |
| [docs/SECURITY.md](docs/SECURITY.md) | Credenciais, chaves, o que é público e o que nunca aparece em resposta pública |
| [docs/AI_USAGE.md](docs/AI_USAGE.md) | Onde e como a IA foi usada |
| [docs/design/](docs/design/README.md) | Protótipo visual (Figma Make), só referência |

## Como executar localmente

### Pré-requisitos

- Node.js 22.12 ou superior (desenvolvido com Node 24) e npm.
- Um banco PostgreSQL. O projeto usa o [Neon](https://neon.tech); qualquer PostgreSQL serve.
- Para rodar os testes: um **segundo banco**, só para testes (por exemplo, uma branch `test` no Neon).

### 1. Backend

```bash
cd backend
npm install       
cp .env.example .env
```

Preencha o `backend/.env`:

| Variável | O que é |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL (começa com `postgresql://`) |
| `TEST_DATABASE_URL` | Banco **exclusivo** dos testes (ver "Testes"). Só é lido pelo `npm test` |
| `JWT_SECRET` | Segredo dos tokens de login |
| `AUDIT_HMAC_KEY` | Chave que sela o histórico de lances |
| `RECEIPT_SIGNING_KEY` | Chave que assina o comprovante |
| `RECEIPT_LINK_KEY` | Chave que assina o link público do comprovante |
| `PORT` | Porta da API (padrão `3000`) |
| `CORS_ORIGIN` | Origem do frontend (ex.: `http://localhost:5173`) |
| `APP_PUBLIC_URL` | Endereço público do frontend |
| `AIC_BASE_URL` | API do Art Institute (padrão `https://api.artic.edu/api/v1`) |
| `AIC_CONTACT` | Contato enviado no header `AIC-User-Agent` ao Art Institute (obrigatório) |

**Os 4 segredos são obrigatórios: sem eles a API não sobe, de propósito.** Cada um precisa ter pelo menos 32 bytes e ser diferente dos outros. Gere cada um com:

```bash
openssl rand -base64 48
```

Sem `openssl` (Windows), use o Node:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Confira o `.env`, aplique as migrations e suba a API:

```bash
npm run check:env       
npx prisma migrate deploy   
npm run seed             
npm run dev                
```

> **Atenção:** `migrate deploy` e `seed` usam a `DATABASE_URL` do `.env`. Confira para qual banco ela aponta antes de rodar.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     
npm run dev            
```

`VITE_API_URL` é lida **no build**: se mudar, é preciso gerar o build de novo. Build de produção: `npm run build` (saída em `frontend/dist`).

## Publicação (deploy)

| Peça | Onde | Configuração |
|---|---|---|
| Banco | Neon (PostgreSQL) | Uma branch para a aplicação e outra, separada, só para os testes |
| Backend | Render (Web Service) | Raiz `backend` · build `npm install && npx prisma migrate deploy` · start `node src/server.js` · health check `/health` |
| Frontend | Vercel | Raiz `frontend` · preset Vite · build `npm run build` · saída `dist` · `vercel.json` com o rewrite de SPA |

Variáveis em produção:
- **Render:** as mesmas do `backend/.env.example`, exceto `TEST_DATABASE_URL`. Os 4 segredos são diferentes dos de desenvolvimento, `CORS_ORIGIN` e `APP_PUBLIC_URL` apontam para o endereço da Vercel (sem barra no final) e `NODE_ENV=production`.
- **Vercel:** `VITE_API_URL` com o endereço da API no Render (sem barra no final).

Duas observações do Neon e do Render:
- As migrations precisam da connection string **direta** do Neon (sem `-pooler` no host). Pela string com pooler, o `prisma migrate deploy` estoura o tempo ao pedir o lock do banco (erro `P1002`).
- Opcional, só no Render: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`. Com o Neon "dormindo", o build pode falhar com `P1002` ao pedir o lock do `prisma migrate deploy`; a variável pula esse lock (ver D17 em [docs/DECISIONS.md](docs/DECISIONS.md)). Não é necessária para rodar localmente.
- Trocar um segredo HMAC depois do seed faz a auditoria acusar todos os lotes como adulterados (ver [docs/SECURITY.md](docs/SECURITY.md)).

## Contas de demonstração

Criadas por `npm run seed` (senha de demonstração, só para teste):

| Perfil | E-mail | Senha |
|---|---|---|
| Leiloeiro | `leiloeiro@teste.com` | `senha123` |
| Licitante 1 | `licitante1@teste.com` | `senha123` |
| Licitante 2 | `licitante2@teste.com` | `senha123` |

Dados criados pelo seed:

1. **Lote ao vivo com 2 lances** (Licitante 1 a R$ 1.000,00 e Licitante 2 a R$ 1.100,00), termina 30 dias depois do seed.
2. **Lote ao vivo sem lances**, bom para testar o cancelamento.
3. **Lote agendado**, começa 7 dias depois do seed.
4. **Lote encerrado e liquidado**, arrematado pelo Licitante 1 por R$ 900,00, com comprovante.

Cada licitante começa com R$ 50.000,00 de saldo. As obras do seed ficam em `backend/prisma/fixtures`, então o seed não depende da API externa.

O seed é reexecutável: apaga os dados de uma rodada anterior **só das 3 contas de demonstração e dos lotes delas**. Se encontrar lances de outras contas nesses lotes, ele para e explica, em vez de apagar o histórico de outra pessoa.

## Testes

```bash
cd backend
npm test
```

Os testes **apagam todas as tabelas** do banco em que rodam. Por isso:
- usam `TEST_DATABASE_URL`, nunca `DATABASE_URL`;
- se `TEST_DATABASE_URL` não estiver definida, ou for igual à `DATABASE_URL`, o `npm test` nem começa;
- aplicam as migrations nesse banco antes de rodar.

Use um banco separado (no Neon, uma branch dedicada) e **nunca** a connection string de produção.

Cobertura (em `backend/tests/`): regras de valor mínimo e quem pode dar lance e quando, saldo comprometido, anti-sniping, 20 lances simultâneos no mesmo lote, saldo disputado entre dois lotes, liquidação sem cobrar duas vezes, adulterações feitas direto no banco, link público do comprovante, 404 para recurso de outra pessoa e permissões de papel.

## Roteiros para testar à mão

Use uma janela normal e uma anônima para ter dois usuários ao mesmo tempo (a sessão fica no `localStorage` do navegador).

1. **Disputa ao vivo.** Licitante 1 e Licitante 2 abrem o mesmo lote ao vivo. Um dá lance e o outro vê o lance aparecer sem recarregar. Quem cobre faz o outro ver "você foi superado" e o saldo comprometido dele voltar ao disponível. Quem lidera tenta cobrir o próprio lance e recebe "você já está ganhando".
2. **Recusas.** Lance abaixo do mínimo; lance maior que o saldo disponível; lote agendado; lote encerrado.
3. **Anti-sniping e liquidação.** Como leiloeiro, crie um lote que termina em 3 minutos (a duração mínima é de 2). Com menos de 2 minutos restantes, dê um lance: o fim ganha +2 minutos nos dois navegadores. Ao encerrar, o vencedor recebe o comprovante, a carteira dele é debitada e o painel do leiloeiro soma o valor em "total recebido".
4. **Auditoria.** Abra `/lotes/<id>/auditoria` numa janela anônima: resultado "íntegro". A técnica e os ataques testados estão em [docs/AUDIT.md](docs/AUDIT.md).
5. **Comprovante.** Em **Meus lances**, copie o link do comprovante e abra numa janela anônima: não há nome nem e-mail. Troque um caractere do link: "comprovante não encontrado". Gere um novo link: o antigo para de funcionar.
6. **API externa fora do ar.** Aponte `AIC_BASE_URL` para um endereço inválido e reinicie a API: vitrine, sala, auditoria e comprovante continuam funcionando; só a busca de obras no painel do leiloeiro falha, com mensagem amigável.

## Comportamentos que podem surpreender

- **Liquidação no fim do lote ou no primeiro acesso depois dele.** Um encerrador roda a cada 5 s; além dele, as leituras liquidam o lote vencido que encontrarem (D15). No Render gratuito, que dorme depois de 15 minutos sem acesso, o encerrador não roda: o primeiro acesso depois do fim demora cerca de 50 s e é ele quem fecha o lote.
- **Prorrogação sem limite.** Cada lance nos últimos 2 minutos soma 2 minutos ao fim atual, quantas vezes acontecer (D9).
- **Apelido por lote.** O mesmo licitante é "Licitante #1" num lote e pode ser "Licitante #3" em outro, de propósito (privacidade, D8).
- **Gerar novo link de comprovante invalida o anterior** na hora.
- **Uma sessão por navegador** (token no `localStorage`). Para usar dois perfis ao mesmo tempo, use uma janela anônima.
- **Um e-mail, um papel.** Para ter acesso de leiloeiro e de licitante, são duas contas.
- **Não rode o seed num banco que uma API no ar já está usando.** O encerrador da API liquida, a cada 5 s, qualquer lote vencido que encontrar. O seed cria o lote encerrado com lances no passado, então a API pode liquidá-lo no meio dos lances e o seed falha com `LOT_ENDED`. Antes de semear um banco em produção, suspenda a API (no Render, *Suspend Service*) e retome depois. Rodando local, com a API desligada, isso não acontece.
- **O lote "ao vivo" do seed termina 30 dias depois do seed.** Passado esse prazo, rode o seed de novo.
- **Duração mínima do lote: 2 minutos.** Horários são enviados com fuso e mostrados no horário de Brasília (D12).
- **Limites de depósito:** de R$ 1 a R$ 100.000 por depósito, e saldo total de licitante até R$ 10 milhões (D14).
- **Trocar uma chave HMAC depois de gerar dados** faz a auditoria acusar os lotes antigos como adulterados (a assinatura deixa de bater). Se precisar trocar, rode o seed de novo.
- **A busca de obras** depende da API do Art Institute e usa cache de 10 minutos; se ela estiver fora do ar, só essa busca falha.

## Limitações conhecidas

- Opcionais **não implementados**: busca e filtro de lotes, cancelamento de lote com lances e estorno automático, Docker Compose e modo escuro.
- O leiloeiro não edita um lote depois de criado: se errou, cancela (quando não há lances) e cria outro.
- O token de login não tem revogação no servidor: sair apaga o token do navegador e ele expira sozinho em 8 horas.
- Sem recuperação de senha, nota fiscal ou revenda entre usuários (fora do escopo do desafio).
- Quem tiver ao mesmo tempo a chave de auditoria e acesso ao banco consegue reescrever o histórico com selos válidos (ver limites em [docs/AUDIT.md](docs/AUDIT.md)).

## Uso de IA

Detalhado em [docs/AI_USAGE.md](docs/AI_USAGE.md).
