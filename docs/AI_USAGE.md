# Uso de IA neste projeto

Usei IA como assistente de programação ao longo de todo o projeto. A maior parte do código do backend e do frontend foi escrita com o Claude a partir de decisões, regras e revisões minhas: eu defini o que construir, conferi cada etapa contra o PDF, testei à mão, rodei e commitei. A tabela abaixo diz, por área, o que a IA fez e o que ficou comigo.

## Ferramentas
- **Claude (Anthropic):** leitura e planejamento do desafio, código do backend e do frontend, testes automatizados e documentação.
- **Figma Make:** telas de média fidelidade e código de protótipo em `docs/design/` (não é o frontend da aplicação).
- **Bruno:** cliente HTTP que usei para testar as rotas da API por conta própria.

## Onde usei

| Área | O que a IA fez | O que eu decidi, revisei ou fiz |
|---|---|---|
| Planejamento | Mapeou as regras de negócio do PDF e montou um plano de trabalho com um checklist ligando cada exigência às tarefas | Conferi o mapa contra o PDF e pedi uma segunda varredura só das regras que desclassificariam a entrega |
| Regras de negócio | Apontou pontos do PDF com mais de uma leitura e escreveu a regra do próximo lance mínimo | Escolhi somar 2 minutos ao fim atual a cada lance tardio (D9), fiquei com o Art Institute of Chicago (D2) e aceitei a duração mínima de 2 minutos para o avaliador ver anti-sniping e encerramento sem esperar. Pedi uma revisão específica para não confundir lance inicial, incremento e próximo mínimo, que removeu uma validação inventada que recusaria lotes válidos |
| Lições do desafio anterior | Transformou a devolutiva que recebi da Verzel em regras de segurança: credencial assinada com HMAC e boa entropia, nenhuma credencial em rota pública e 404 para recurso de outra pessoa | A devolutiva e a leitura dela são minhas; conferi que cada ponto virou regra e código |
| Documentação | Escreveu o FLOW.md, o ERD.md, o AUDIT.md (cadeia de hashes com selo HMAC, tabela de ataques e limites), o SECURITY.md e o texto do README | Revisei o conteúdo contra o código e as regras do PDF, principalmente os limites da auditoria (restaurar uma cópia antiga do lote só o comprovante detecta) |
| Design | Mapeou o design system do meu projeto de ingressos, escreveu o prompt do Figma Make e revisou as telas em duas rodadas (faltavam as 5 recusas de lance, o estado "adulterado", a sala por fase e um identificador interno exposto no comprovante) | Escolhi reaproveitar o visual anterior, defini o nome leilõesPaintings, gerei as telas no Figma Make, apliquei as correções e aprovei |
| Banco e migrations | Escreveu o `schema.prisma` com as 8 tabelas e a migration manual com os CHECKs de saldo e de lote | Conferi tabela por tabela contra o ERD.md, fixei o Prisma na 7.10.1 quando o npm instalou uma versão de teste, rodei as migrations no Neon e conferi as tabelas no Prisma Studio e as constraints no SQL Editor |
| API, autenticação e catálogo | Escreveu a base da API (erros, helmet, limites, validação do ambiente com Zod), cadastro e login com JWT e bcrypt, e a integração com a API do Art Institute com timeout, cache e erro amigável | Testei no Bruno o cadastro, o `/auth/me` (inclusive com token adulterado de propósito), a busca na API, a criação de lote, a vitrine, o 404 para lote de outro leiloeiro, o cancelamento e a API fora do ar. Pedi a revisão que removeu três arquivos vazios commitados por acidente e limitou as tentativas de cadastro |
| Carteira, lances e auditoria | Escreveu a carteira, o lance com trava de linha e relógio do banco, as 5 mensagens de recusa, o anti-sniping, os apelidos por lote e a cadeia de auditoria | Pedi cuidado máximo por ser o coração do desafio, testei no Bruno e só depois pedi testes de ataque (tokens forjados, corridas pelo mesmo saldo, 19 adulterações direto no banco) |
| Liquidação, comprovante e tempo real | Escreveu a liquidação, o encerrador, o comprovante assinado, o link público com HMAC e o tempo real por SSE | Pedi uma releitura do PDF antes de começar e outra antes do commit, e testei o básico no Bruno |
| Reaproveitamento do projeto anterior | Adaptou peças do meu projeto de ingressos, com crédito no código: o código assinado do ingresso virou o link do comprovante (agora com 128 bits e assinatura conferida antes do banco, a correção da devolutiva), a liberação de reservas vencidas virou a liquidação no primeiro acesso, e o seed virou o do leilão. No frontend, o cliente da API, o login guardado e as rotas protegidas | O código de base é do meu projeto anterior e a ideia de reaproveitar foi minha: perguntei o que servia, pedi o plano antes de qualquer código e aprovei |
| Frontend | Montou o projeto React com Vite e Tailwind e as telas: login, vitrine, sala ao vivo, carteira, meus lances e arremates, comprovante e auditoria públicos e painel do leiloeiro, seguindo o protótipo | Pedi commits menores e conferência contra o PDF a cada etapa. Testei no navegador com duas contas disputando o mesmo lote |
| Seed | Escreveu o seed (leiloeiro, 2 licitantes, lotes ao vivo, agendado e encerrado com comprovante) e o script que baixa as 4 obras para o seed não depender da API | Baixei as obras e rodei o seed contra o Neon. Os erros que reportei viraram duas correções: o servidor de imagens recusava o download e o seed parava sem mostrar o motivo |
| Testes e segurança | Configurou o Vitest com banco só de teste e escreveu 37 testes das regras críticas (valor mínimo, líder, saldo comprometido, 20 lances simultâneos, anti-sniping, liquidação sem cobrar duas vezes, adulterações no banco, link do comprovante, 404 para recurso alheio). Rodou, à parte e fora do repositório, uma bateria de testes de ataque; ela achou e corrigiu o saldo do leiloeiro estourando em R$ 21,47 milhões (D16), erro interno com token de conta apagada e id de lote sem codificação no front | Pedi para tentar quebrar o sistema antes de commitar, criei a branch de testes no Neon e rodei a suíte nela, nunca no banco principal |
| Deploy | Ajudou a diagnosticar dois problemas: a migration que estourava o tempo pelo pooler do Neon (resolvido com a connection string direta) e o seed que falhava porque o encerrador da API no ar liquidava o lote encerrado no meio dos lances (resolvido suspendendo a API durante o seed) | Criei os serviços no Render e na Vercel, gerei os segredos de produção, configurei as variáveis e o CORS e rodei o seed em produção |

## O que fiz sem IA
- Criei o repositório no GitHub e fiz a revisão e o commit de cada etapa.
- Configurei o banco no Neon (branch principal e branch de testes), preenchi o `.env` e rodei as migrations.
- Li a devolutiva do desafio anterior, que virou a base das regras de segurança.
- Escolhi o nome da marca e a direção visual.
- Gerei as telas no Figma Make e apliquei as correções das duas rodadas.
- Testei as rotas da API no Bruno: autenticação, catálogo, lotes, carteira, lances, auditoria, encerramento e comprovante.
- Rodei o seed e reportei os erros que apareceram.
- Rodei os testes automatizados e testei o fluxo no navegador com duas contas disputando o mesmo lote.
- Publiquei o backend no Render e o frontend na Vercel.

## O que aprendi
- **Decisões de arquitetura:** aprendi a ver, antes de construir, a necessidade de cada peça e a documentar as decisões, o que também guia melhor a IA. Ganhei confiança para escolher cada ferramenta pelo cenário de uso e pelo que ela traz ao negócio.
- **Trabalho com IA:** aprendi a estruturar melhor os prompts para gerar código melhor e a analisar criticamente o código gerado, em vez de aceitá-lo como veio.
- **Segurança:** aprendi a decidir com mais cuidado, a partir do alerta que recebi no desafio anterior sobre a segurança da autenticação (código de baixa entropia) e da sugestão de melhoria que acompanhou o alerta.
- **API HTTP:** entendi melhor as rotas e os códigos de retorno, e como devolver mensagens de erro claras.
- **Organização:** aprendi a documentar o projeto de forma mais formal e a mapear o fluxo de trabalho, do começo ao fim, para entregar um MVP.
- **Reaproveitamento:** aprendi a reutilizar melhor componentes e código de um projeto anterior, com crédito.
- **Deploy:** aprendi a publicar e configurar os serviços (Neon, Render e Vercel) e a resolver os problemas que só aparecem em produção.
