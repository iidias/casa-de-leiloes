# Fluxo do sistema

### Contas

1. A pessoa cria uma conta padrão e entra como licitante (`BIDDER`), ou marca **Sou leiloeiro** e entra como leiloeiro (`SELLER`).
2. Um e-mail identifica uma única conta e um único papel. Para ter os dois acessos, são duas contas com e-mails diferentes.
3. Toda conta nasce com uma carteira. A do leiloeiro recebe o valor dos arremates.

### Leilão

1. O leiloeiro busca uma obra na API do Art Institute e cria o lote com lance inicial, incremento mínimo, início e fim. O servidor copia os dados e a imagem da obra para o banco.
2. O lote aparece na vitrine como **agendado**. No horário de início passa a **ao vivo**, sem nenhum job: o estado é calculado pelo horário do servidor.
3. O licitante deposita um saldo simulado na carteira.
4. O licitante entra na sala do lote e dá um lance. O primeiro precisa ser maior ou igual ao lance inicial; os seguintes, maiores ou iguais ao lance atual mais o incremento mínimo. Aceito o lance, o valor fica **comprometido** na carteira dele.
5. Outro licitante cobre o lance. O valor comprometido de quem foi superado volta ao **disponível** na mesma hora. Quem está ganhando não pode cobrir o próprio lance.
6. Se o lance acontece com 2 minutos ou menos para o fim, o fim do lote ganha **mais 2 minutos**, a cada lance tardio.
7. No fim do lote:
   - **com lances:** o valor é debitado do vencedor, creditado ao leiloeiro e o comprovante é gerado;
   - **sem lances:** o lote encerra sem vencedor.
8. O vencedor vê o comprovante em **Meus arremates** e pode compartilhá-lo por link. O link mostra só o essencial e nenhum dado pessoal.
9. Qualquer pessoa, sem login, abre a **auditoria** do lote e vê o histórico completo, com o resultado "íntegro" ou "adulterado".

### Cancelamento

O leiloeiro só cancela um lote que ainda não recebeu lances, esteja ele agendado ou ao vivo. Lote cancelado some da vitrine e, para quem não é o dono, responde como se não existisse.

### Lances recusados

Todo lance recusado volta com o motivo: abaixo do mínimo, saldo insuficiente, você já está ganhando, lote ainda não iniciado ou lote encerrado.
