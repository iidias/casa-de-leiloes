# Decisões do projeto

Formato: decisão, por quê e o que descartei.

D1 - Mesma stack do projeto de ingressos.
React com Vite no front, Node com Express em JavaScript no back, PostgreSQL no Neon e Prisma. Já levei essa stack até produção uma vez, então os 7 dias vão para as regras de leilão, e não para aprender ferramenta nova.
O que descartei: TypeScript e NestJS. Ajudariam num projeto longo, mas o custo de configuração e de erro de tipagem no build não cabe no prazo.

D2 - Art Institute of Chicago como API de itens.
Não pede chave nem cadastro, então não há segredo de API para guardar. Uma única busca já devolve título, artista, data, técnica e o id da imagem, e dá para filtrar só obras de domínio público, que podem ser exibidas sem problema. Obra de arte também combina com leilão.
O que descartei: The Met (a busca devolve só ids e exige uma chamada por item, o que fica lento e estoura o limite de uso), Discogs (exige token e tem limite baixo) e Scryfall (boa, mas cartas colecionáveis combinam menos com uma casa de leilões).

D3 - Dinheiro em centavos, como número inteiro.
Float erra centavo, e num leilão um centavo decide quem ganha. O backend recebe e guarda tudo em centavos inteiros e recusa qualquer outra coisa (1.5, "100", 1e3, negativo). Formatar em reais é só apresentação.

D4 - Saldo comprometido guardado como coluna na carteira.
A carteira tem saldo total e saldo comprometido; o disponível é a diferença. A linha da carteira é travada durante o lance, e o próprio banco tem uma regra (CHECK) que impede o comprometido de ficar negativo ou maior que o total.
O que descartei: calcular o comprometido somando os lances a cada pedido. É mais lento e não dá para travar uma soma, então dois lances simultâneos poderiam usar o mesmo dinheiro.

D5 - Lances do mesmo lote processados um de cada vez, com trava de linha.
Dentro de uma transação, o lance trava a linha do lote (SELECT ... FOR UPDATE) e depois as carteiras envolvidas, sempre na mesma ordem. Quem chega depois espera o primeiro terminar e então é validado contra o lance atual de verdade.
O que descartei: checar com um if no JavaScript (duas requisições passam juntas antes de qualquer uma gravar) e isolamento SERIALIZABLE (funciona, mas exige repetir a transação a cada conflito).

D6 - Estado do lote calculado pelo horário.
Agendado, ao vivo e encerrado saem da comparação entre o horário atual e o início e fim do lote. Só cancelado e liquidado são gravados. O horário que vale é o do servidor, nunca o do navegador.
O que descartei: um job trocando o status no horário. Se o job atrasar, a vitrine mostra o estado errado.

D7 - Histórico de lances em cadeia de hashes selada com HMAC.
Cada lance guarda o hash do anterior, e cada hash é selado com uma chave que fica só no servidor. Assim, alteração, remoção ou inserção feita direto no banco quebra a cadeia, e quem adulterou não consegue refazer os selos sem a chave. O detalhe está em docs/AUDIT.md.
O que descartei: hash simples sem chave, porque quem tem acesso ao banco recalcularia todos os hashes depois de adulterar.

D8 - Licitante aparece como "Licitante #N" em cada lote.
O número segue a ordem do primeiro lance naquele lote. A mesma pessoa tem números diferentes em lotes diferentes, então a auditoria e o comprovante não expõem dados pessoais e não permitem cruzar lotes para descobrir o histórico de alguém.
O que descartei: mostrar um hash do id do usuário, que seria igual em todos os lotes.

D9 - Anti-sniping soma 2 minutos ao fim atual.
Todo lance aceito com 2 minutos ou menos restantes acrescenta 2 minutos ao fim do lote, quantas vezes acontecer. Lance com 1:30 restante leva o contador para 3:30. O lote só termina quando ninguém mais cobre a tempo.
O que descartei: a outra leitura possível do PDF, em que o novo fim seria o momento do lance mais 2 minutos.

D10 - Tempo real com SSE.
O servidor só precisa avisar a sala quando há lance novo, prorrogação ou encerramento; o lance em si vai por POST. SSE faz isso com o próprio HTTP e o navegador reconecta sozinho.
O que descartei: WebSocket (comunicação nos dois sentidos sem necessidade e mais uma biblioteca) e consultar o servidor de tempos em tempos (atrasa a sala e gasta requisições).

D11 - Direção visual reaproveitada do projeto anterior.
O leilão usa o mesmo design system do projeto de ingressos feito anteriormente por mim em outro desafio de codificação: vermelho #E5181B como única cor de destaque, cinzas para fundo e bordas, DM Serif Display nos títulos e Outfit no resto, espaçamento em múltiplos de 4 e raios pequenos (2 a 6 px), com bordas finas no lugar de sombras. A marca é leilõesPaintings. As cores de estado saem da mesma paleta: ao vivo em verde, agendado em azul, encerrado em cinza, "você está ganhando" em verde sólido e "você foi superado" em vermelho sólido, sempre com ícone e texto, nunca só cor. O detalhe memorável é a contagem regressiva, que fica vermelha e pulsa nos últimos 2 minutos, com o aviso de que cada lance acrescenta 2 minutos (D9). As telas de média fidelidade foram geradas no Figma Make e estão em docs/design. Os seletores "Pré-visualizar" existem só no protótipo, para mostrar cada estado. Login, cadastro, painel do leiloeiro e criar lote não foram desenhados, porque reaproveitam componentes.
O que descartei: criar uma identidade nova do zero, que custaria tempo sem ganho para o desafio.

D12 - Horários sempre com fuso, guardados em UTC.
O front manda início e fim com fuso (ISO 8601, por exemplo 2026-11-05T18:00:00-03:00), o banco guarda em UTC e a tela mostra no horário de Brasília. A API recusa horário sem fuso. Horário de encerramento é regra de negócio: com fuso errado, o lote encerraria uma hora antes ou depois.
O que descartei: aceitar horário sem fuso e supor o do servidor, que no Render é UTC e encerraria o lote 3 horas antes do que o leiloeiro escolheu.

D13 - Um relógio só: o do banco, lido depois da trava.
O lance trava a linha do lote e só então lê o horário do banco. Esse horário decide se o lote está ao vivo, entra no hash do lance e define a prorrogação. A prorrogação soma 2 minutos ao fim lido depois da trava, que já pode ter sido estendido por um lance anterior. "Últimos 2 minutos" inclui exatamente 2:00 restantes, e no instante exato do fim o lote já está encerrado.
O que descartei: ler o horário do servidor Node antes da trava. Um lance que esperasse alguns milissegundos na fila poderia ser aceito depois do fim, ou recusado antes dele, e dois lances tardios seguidos poderiam somar os 2 minutos ao mesmo fim antigo.

D14 - Teto de R$ 10 milhões na carteira.
Cada depósito vai de R$ 1 a R$ 100.000, e o saldo total não passa de R$ 10 milhões. O depósito é simulado, então sem teto bastaria repetir depósitos até estourar a coluna do banco, e a resposta viraria um erro interno. Com o teto, a resposta é uma mensagem clara.
O que descartei: deixar sem teto e confiar só no limite de depósitos por minuto, que só atrasa o problema.

D15 - Liquidação no fim do lote ou no primeiro acesso depois dele.
Um encerrador roda a cada 5 s e liquida os lotes vencidos. Além dele, a vitrine, o lote, a auditoria, as rotas do licitante, o painel do leiloeiro e o próprio lance liquidam o lote vencido que encontrarem antes de responder. O Render gratuito dorme depois de 15 minutos sem acesso e, dormindo, o encerrador não roda: sem a segunda peça, quem abrisse o site veria um lote encerrado sem vencedor e sem comprovante. Liquidar duas vezes não debita duas vezes: a liquidação trava o lote e só segue se ele ainda estiver ativo e vencido, e o comprovante é único por lote. Um lote que falhe ao liquidar não impede os outros de fechar.
O que descartei: só o encerrador (falha com o servidor dormindo) e um agendador externo (mais uma peça para configurar sem ganho para o desafio).
