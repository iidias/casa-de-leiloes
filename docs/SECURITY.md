# Segurança e privacidade

Este projeto parte de uma lição do desafio anterior: **um valor que dá acesso a alguma coisa é uma credencial**, e credencial precisa ser assinada, ter boa entropia e nunca aparecer em resposta pública. Este documento lista cada valor sensível, onde ele vive e quem vê.

## Valores sensíveis

| Valor | É credencial? | Onde aparece | Nunca aparece em |
|---|---|---|---|
| Token de login (JWT) | Sim | Header `Authorization` | URL, logs, respostas públicas |
| Link do comprovante | Sim, ao portador e só para leitura | Para o dono, em Meus arremates | Respostas públicas, logs |
| Id, nome e e-mail do usuário | Dado pessoal | Rotas autenticadas do próprio usuário | Vitrine, sala, tempo real, auditoria, comprovante público |
| Chaves HMAC e segredo do JWT | Segredo | Variáveis de ambiente do servidor | Banco, front, repositório |

## Chaves

Cada finalidade tem a sua chave, para o vazamento de uma não comprometer as outras:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Assinar os tokens de login |
| `AUDIT_HMAC_KEY` | Selar os lances, os participantes e o topo da cadeia de cada lote (ver AUDIT.md) |
| `RECEIPT_SIGNING_KEY` | Assinar o conteúdo do comprovante |
| `RECEIPT_LINK_KEY` | Assinar o link público do comprovante |

- Cada chave tem pelo menos 32 bytes aleatórios, gerados com `openssl rand -base64 48`.
- O servidor **não sobe** se faltar alguma chave ou se ela for curta.
- As chaves de produção são diferentes das de desenvolvimento.
- Trocar uma chave em produção invalida o que ela assinou: com outra `AUDIT_HMAC_KEY`, a auditoria acusaria todos os lotes como adulterados; com outra `RECEIPT_SIGNING_KEY`, os comprovantes; com outra `RECEIPT_LINK_KEY`, os links já enviados param de abrir. Por isso as chaves não são trocadas depois do seed. Se for preciso, rode o seed de novo.
- Toda comparação de assinatura usa `crypto.timingSafeEqual`.

## Link do comprovante

O link tem o formato `r1.<id>.<assinatura>`:
- o `id` tem 128 bits aleatórios;
- a assinatura é um HMAC-SHA256 do `id`, com `RECEIPT_LINK_KEY`;
- a assinatura é conferida **antes** de consultar o banco, então um link forjado nunca chega ao banco;
- a assinatura **não é gravada** no banco, então um vazamento do banco não entrega links prontos;
- o dono pode gerar um link novo, e o antigo para de funcionar na hora;
- link com formato errado, assinatura errada, revogado ou inexistente recebem **a mesma resposta 404**, então quem testa não distingue um caso do outro;
- o link pronto só aparece em rotas autenticadas do próprio dono, e a resposta pública vai com `Cache-Control: no-store`.

A página pública do comprovante mostra só o item, o valor, a data, o apelido do vencedor ("Licitante #N") e o selo de integridade. Não mostra nome, e-mail ou id de ninguém, nem o próprio link.

## Recurso de outra pessoa responde 404

Lote de outro leiloeiro, comprovante de outro licitante ou lote cancelado visto por terceiros respondem **404, com a mesma resposta de "não existe"**. Responder "acesso negado" confirmaria que o recurso existe. Os ids são UUID, nunca sequenciais.

## Outras proteções

- Toda entrada passa por validação com Zod em modo estrito: campo desconhecido é recusado, então o cliente não consegue escolher dono, status ou vencedor.
- Dinheiro só em centavos inteiros (D3).
- Login com mensagem genérica e o mesmo tempo de resposta, exista o e-mail ou não.
- Limite de requisições no cadastro, no login, no depósito e no lance.
- Tempo real (SSE): no máximo 20 conexões abertas por endereço e 2000 no total, para um só cliente não ocupar as vagas de todo mundo.
- O cadastro avisa quando o e-mail já está em uso. É uma escolha consciente: sem confirmação por e-mail (fora do escopo do desafio), não há outro jeito de a pessoa saber por que o cadastro falhou. Para isso não virar uma forma de descobrir em massa quem tem conta, o cadastro tem o mesmo limite de tentativas do login. O login, por sua vez, nunca diz se o e-mail existe.
- Erro inesperado responde mensagem genérica, sem stack trace.
- Token de uma conta que não existe mais (apagada do banco) responde 401, e não erro interno.
- O front codifica o id do lote antes de montar a URL da API, então um endereço como `/lotes/..%2F..%2Fauth%2Fme` não chama outra rota.
- O front vai para o ar com cabeçalhos que impedem a página de ser aberta dentro de outro site (clickjacking), impedem o navegador de adivinhar o tipo de arquivo e não mandam o endereço de origem para outros sites.
- O limite de tentativas usa o IP que o proxy do Render informa (`trust proxy` = 1). Rodando sem proxy, dá para trocar o IP mandando o cabeçalho X-Forwarded-For; por isso, depois do deploy, é preciso conferir que 11 logins seguidos com X-Forwarded-For diferente continuam bloqueados.
- O token de login não tem revogação no servidor: sair apaga o token do navegador, e ele expira sozinho em 8 horas.
