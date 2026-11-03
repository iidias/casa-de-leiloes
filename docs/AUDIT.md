# Auditoria: como o histórico de lances detecta adulteração

O desafio pede que qualquer alteração, remoção ou inserção posterior no histórico de lances, mesmo feita direto no banco, seja detectada pela auditoria. Este documento explica a técnica escolhida, o que ela pega e o que ela não pega.

## A ameaça

Alguém com acesso ao banco de dados abre o histórico de um lote e:
- altera o valor ou o horário de um lance;
- apaga um lance do meio ou do fim;
- insere um lance que não aconteceu;
- muda as regras do lote (lance inicial, incremento, horários);
- troca a pessoa por trás de um apelido, para mudar quem paga e quem recebe o comprovante.

## A técnica: cadeia de hashes selada com HMAC

**1. Cada lance aponta para o anterior.** O conteúdo de cada lance é escrito sempre no mesmo formato e passa por SHA-256:

```
conteúdo = v1 | lote | sequência | apelido | valor | horário | fim depois do lance | hash do lance anterior
hash     = SHA-256(conteúdo)
```

Como o hash do anterior faz parte do conteúdo, mexer em qualquer lance muda o hash dele e quebra o elo com o próximo.

**2. O primeiro elo é o próprio lote.** O "lance anterior" do primeiro lance é um hash gênese, calculado com o id do lote, o leiloeiro, o lance inicial, o incremento, o início e o fim original. Mudar as regras do lote direto no banco quebra a cadeia desde o começo.

**3. Cada hash é selado com uma chave secreta.** Só o hash não basta: quem tem acesso ao banco pode adulterar e recalcular todos os hashes. Por isso cada lance tem também um selo:

```
selo = HMAC-SHA256(chave de auditoria, hash)
```

A chave fica só na variável de ambiente do servidor, nunca no banco nem no repositório. Sem ela não dá para produzir um selo válido.

**4. O lote sela o topo da cadeia.** Apagar o último lance deixa uma cadeia menor, mas ainda coerente. Para pegar isso, o lote guarda a quantidade de lances e o hash do último, também selados com a chave. Se sumir um lance do fim, a contagem e o selo do lote deixam de bater.

**5. O apelido é selado com a pessoa.** O histórico público mostra "Licitante #2", nunca quem é. O vínculo entre apelido e usuário tem um selo próprio, e cada lance precisa pertencer ao usuário do seu apelido.

## O que a verificação confere

1. O hash gênese, recalculado a partir das regras atuais do lote.
2. Para cada lance, em ordem: a sequência é 1, 2, 3… sem buracos; o hash do anterior bate; o hash recalculado bate; o selo bate.
3. A quantidade de lances e o último hash batem com o topo selado do lote.
4. O preço atual do lote é o valor do último lance, os valores são crescentes e cada lance respeita a regra de mínimo.
5. O fim atual do lote é o "fim depois do lance" do último lance (ou o fim original, se não houve lance).
6. Os selos dos participantes batem e cada lance pertence à pessoa do seu apelido.
7. Em lote liquidado: o valor final é o último lance, e o comprovante tem o último hash da cadeia e uma assinatura válida.

Qualquer falha marca o lote como **adulterado** e aponta em qual lance o problema aparece.

## O que cada ataque quebra

| Ataque direto no banco | O que acusa |
|---|---|
| Alterar valor, horário ou apelido de um lance | O hash recalculado não bate |
| Apagar um lance do meio | A sequência pula e o elo do lance seguinte não bate |
| Apagar o último lance | A contagem e o topo selado do lote não batem |
| Inserir um lance | Sem a chave, o selo do lance falso não bate |
| Mudar lance inicial, incremento ou horários | O hash gênese não bate (ou o fim não bate com o último lance) |
| Trocar a pessoa por trás de um apelido | O selo do participante não bate |
| Adulterar e recalcular todos os hashes | Os selos não batem, porque exigem a chave |

## Duas camadas de verificação

- **No servidor:** confere tudo, inclusive os selos, porque só ele tem a chave.
- **No navegador:** a página pública de auditoria recalcula a cadeia de SHA-256 sozinha, sem depender do servidor para essa parte. Quem abre a página não precisa confiar 100% no servidor para conferir os elos.

O histórico público não mostra selos nem nenhum dado pessoal: só sequência, apelido, valor, horários e hashes.

## Limites (honestos)

- **Quem tiver ao mesmo tempo a chave e o banco** consegue reescrever o histórico com selos válidos. A proteção depende de a chave ficar fora do banco.
- **Restaurar um lote inteiro para uma cópia antiga e válida** do próprio banco (lote e lances juntos) gera um estado coerente. Quem detecta isso é o **comprovante**: ele guarda o último hash da cadeia no momento do encerramento, fora do controle de quem mexe no banco depois.
- **Trocar a chave em produção** invalida os selos já gravados, e a auditoria passaria a acusar tudo como adulterado. A chave não é trocada depois do seed.
