# Uso de IA neste projeto

## Ferramentas
- Claude (Anthropic): leitura do desafio, planejamento, revisão de regras e escrita da documentação inicial.

## Onde usei

| Parte | O que a IA fez | O que eu decidi ou revisei |
|-------|----------------|----------------------------|
| Leitura do PDF | Mapeou as regras de negócio obrigatórias do desafio (papéis, regras de lance, carteira, liquidação, auditoria, privacidade, telas e requisitos não funcionais) | Conferi o mapa contra o PDF e pedi uma segunda varredura só das regras que desclassificariam a entrega |
| Plano de tarefas | Montou o plano de tarefas por dia, com um checklist de conformidade ligando cada exigência do PDF às tarefas | Revisei a ordem e o escopo; o plano fica fora do repositório |
| Lições do desafio anterior | Transformou a devolutiva que recebi da Verzel em regras para este projeto: credencial assinada com HMAC e boa entropia, nenhuma credencial em rota pública e 404 para recurso de outra pessoa | A devolutiva e a leitura dela são minhas; conferi que cada ponto virou tarefa |
| Anti-sniping | Apontou que "+2 minutos" tem duas leituras possíveis | Escolhi somar 2 minutos ao fim atual a cada lance tardio (D9) |
| Lance inicial e incremento | Escreveu a regra do próximo lance mínimo | Pedi uma revisão específica para não confundir lance inicial, incremento mínimo e próximo lance mínimo. Isso tirou uma validação inventada ("incremento menor que o lance inicial") que recusaria lotes válidos |
| Escolha da API | Comparou opções (Art Institute of Chicago, The Met, Discogs, Scryfall, Open Library, Pokémon TCG) | Fiquei com o Art Institute of Chicago (D2) |
| Duração mínima do lote | Sugeriu baixar o mínimo de 10 para 2 minutos | Aceitei, para quem avalia conseguir ver anti-sniping e encerramento sem esperar |
| Documentação de fluxo e dados | Escreveu o resumo do README, o FLOW.md e o ERD.md (8 tabelas) seguindo o plano | Conferi que o fluxo bate com as regras do PDF e com as decisões |
| Técnica de auditoria | Escreveu o AUDIT.md: cadeia de hashes SHA-256, selo HMAC em cada lance, topo da cadeia selado no lote e selo no vínculo apelido → pessoa, com a tabela de ataques e os limites | Revisei os limites antes de aceitar, principalmente o caso de restaurar uma cópia antiga do lote, que só o comprovante detecta |
| Segurança | Escreveu o SECURITY.md com cada valor sensível, as 4 chaves separadas e o link do comprovante assinado | Conferi que cada ponto da devolutiva do desafio anterior aparece ali |
| Telas (Figma Make) | Mapeou o design system do projeto de ingressos, escreveu o prompt do Figma Make e revisou as telas geradas em duas rodadas, apontando estados que faltavam (as 5 recusas de lance, auditoria adulterada, sala por fase e papel) e um identificador interno exposto no comprovante | Escolhi reaproveitar o visual anterior, defini o nome leilõesPaintings, rodei as correções no Figma Make e aprovei as telas |
| Base do backend | Criou o package.json, o prisma.config.ts (no mesmo formato do projeto anterior), o .env.example e o .env de desenvolvimento com os 4 segredos gerados por `openssl rand -base64 48` | Instalei as dependências e preenchi a connection string do Neon na minha máquina |
| Validação do ambiente | Escreveu o src/config/env.js com Zod: o servidor não sobe se faltar variável, se um segredo tiver menos de 32 bytes ou se dois segredos forem iguais. Testou os três casos antes de entregar | Conferi as mensagens de erro |
| Schema do banco | Escreveu o schema.prisma com as 8 tabelas do ERD.md e validou com `prisma validate` | Conferi tabela por tabela contra o ERD.md e o plano |
| Migrations | Escreveu a migration manual com os 5 CHECKs de saldo e de lote, e me orientou quando o npm instalou o `prisma` 8 (versão de teste) junto com o `@prisma/client` 7 | Fixei o Prisma na 7.10.1, rodei as migrations no Neon e conferi as 8 tabelas no Prisma Studio e as 5 constraints no SQL Editor |
| Estrutura inicial | Criou o .gitignore, a pasta docs e o texto das decisões D1 a D10 | Revisei o texto antes do primeiro commit, que fiz eu mesmo |

## O que fiz sem IA
- Criação do repositório no GitHub
- Revisão e commit de cada etapa
- Testei a API do Art Institute por conta própria no Bruno: montei a requisição de busca com os parâmetros de filtro e de campos, e a de imagem, e conferi as respostas
- [completar ao longo do projeto]

## O que aprendi
- [completar no fim do projeto]
