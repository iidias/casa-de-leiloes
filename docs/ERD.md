# Modelo de dados

São 8 tabelas. Valores em dinheiro são sempre centavos inteiros (D3), e horários são gravados em UTC.

**User** — licitante ou leiloeiro. Campo `role` com `BIDDER` ou `SELLER`. E-mail único.

**Wallet** — uma por usuário. Guarda `totalCents` e `committedCents`; o disponível é a diferença e não é gravado. O banco impede, com CHECK, que o comprometido fique negativo ou maior que o total (D4).

**LedgerEntry** — o extrato da carteira: depósito, débito de arremate, crédito de arremate e liberação por cancelamento (este tipo existe no modelo, mas ainda não é usado: o cancelamento de lote com lances não foi implementado). É o que explica de onde veio cada centavo do saldo total. Comprometer e liberar saldo durante a disputa não gera lançamento, porque não é dinheiro entrando nem saindo.

**Lot** — o lote. Tem uma cópia dos dados da obra (título, artista, data, técnica, dimensões, descrição), as regras definidas pelo leiloeiro (`startingPriceCents`, `minIncrementCents`, `startsAt`, `endsAt`, `originalEndsAt`) e o estado da disputa (`currentPriceCents`, `leaderId`, `bidCount`). Também guarda o topo da cadeia de auditoria (`headHash`, `headSeal`). O `status` só registra `ACTIVE`, `CANCELLED` ou `SETTLED`; agendado, ao vivo e encerrado são calculados pelo horário (D6).

**LotImage** — os bytes da imagem da obra, baixada na criação do lote. Fica separada do `Lot` para a vitrine não carregar a imagem em toda consulta, e existe para a vitrine continuar com foto mesmo se a API externa cair.

**LotParticipant** — liga cada licitante ao apelido dele naquele lote ("Licitante #N", D8). Único por lote e usuário, e único por lote e apelido. Cada linha tem um selo HMAC, para ninguém trocar a pessoa por trás de um apelido direto no banco.

**Bid** — cada lance. Tem a sequência dentro do lote (`seq`, única por lote), o valor, o apelido, o novo fim depois do lance (`endsAtAfter`) e os campos da cadeia de auditoria (`prevHash`, `hash`, `seal`). Tem também uma chave de idempotência, para um duplo clique não virar dois lances.

**Receipt** — o comprovante de arremate. Um por lote, no máximo. Guarda vencedor, leiloeiro, valor, o último hash da cadeia no momento do encerramento, a assinatura HMAC do conteúdo e o identificador usado no link público de compartilhamento.

### Relações

- Um leiloeiro tem vários lotes.
- Um lote tem vários lances, vários participantes, uma imagem e no máximo um comprovante.
- Um usuário tem uma carteira, e a carteira tem vários lançamentos de extrato.
- Um lance pertence a um lote e a um licitante.
