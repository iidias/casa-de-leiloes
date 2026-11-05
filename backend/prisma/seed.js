import { writeSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import prisma from '../src/lib/prisma.js';
import { register } from '../src/services/authService.js';
import { placeBid } from '../src/services/bidService.js';
import { createLotFromArtwork } from '../src/services/lotService.js';
import { settleLot } from '../src/services/settlementService.js';
import { deposit } from '../src/services/walletService.js';

// Seed de demonstração (tarefa 78). Estrutura adaptada do seed.js do meu projeto anterior
// (ingressos): contas de teste fixas no topo, dados da obra fixos para não depender da API
// externa, e reexecutável.
//
// Diferença importante: aqui TUDO passa pelos services (cadastro, depósito, lote, lance,
// liquidação). Lance criado com prisma.bid.create direto não teria hash nem selo, e a página
// de auditoria mostraria o lote do seed como adulterado.
//
// Senha "senha123": só para demonstração (está no README).

const HERE = dirname(fileURLToPath(import.meta.url));
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const SELLER = { name: 'Leiloeiro Teste', email: 'leiloeiro@teste.com', password: 'senha123', isSeller: true };
const BIDDER_1 = { name: 'Licitante 1', email: 'licitante1@teste.com', password: 'senha123', isSeller: false };
const BIDDER_2 = { name: 'Licitante 2', email: 'licitante2@teste.com', password: 'senha123', isSeller: false };
const USERS = [SELLER, BIDDER_1, BIDDER_2];
const BALANCE_CENTS = 5_000_000; // R$ 50.000,00 para cada licitante

// Etapa atual: se algo falhar ou o processo sair no meio, a mensagem diz onde parou.
let step = 'início';
let finished = false;
const say = (text) => console.log(text);
const stepTo = (name) => {
  step = name;
  say(`... ${name}`);
};

async function loadFixtures() {
  let obras;
  try {
    obras = JSON.parse(await readFile(join(HERE, 'fixtures', 'obras.json'), 'utf8'));
  } catch {
    throw new Error('Faltam as obras do seed. Rode uma vez: node prisma/fixtures/baixar-obras.js');
  }
  if (!Array.isArray(obras) || obras.length < 4) throw new Error('prisma/fixtures/obras.json precisa ter 4 obras');
  return Promise.all(
    obras.slice(0, 4).map(async ({ file, mimeType, ...artwork }) => ({
      artwork,
      image: { mimeType, bytes: await readFile(join(HERE, 'fixtures', file)) },
    })),
  );
}

// Apaga os dados de demonstração de uma rodada anterior.
// Só apaga se o seed "estiver sozinho": se alguém de fora deu lance num lote do seed, ou se um
// licitante do seed deu lance em lote de outra pessoa, apagar mexeria no dinheiro e no histórico
// auditável de quem não é do seed. Nesse caso o seed para e explica.
async function removePreviousSeed() {
  const users = await prisma.user.findMany({
    where: { email: { in: USERS.map((u) => u.email) } },
    select: { id: true, wallet: { select: { id: true } } },
  });
  if (users.length === 0) return;
  const userIds = users.map((u) => u.id);
  const walletIds = users.map((u) => u.wallet?.id).filter(Boolean);
  const lotIds = (await prisma.lot.findMany({ where: { sellerId: { in: userIds } }, select: { id: true } })).map((l) => l.id);

  const outsiders = await prisma.bid.count({
    where: {
      OR: [
        { lotId: { in: lotIds }, bidderId: { notIn: userIds } },
        { bidderId: { in: userIds }, lotId: { notIn: lotIds } },
      ],
    },
  });
  if (outsiders > 0) {
    throw new Error(
      'Há lances de outras contas nos lotes do seed (ou das contas do seed em outros lotes). ' +
        'O seed não apaga isso para não mexer no saldo nem no histórico de mais ninguém. ' +
        'Para recomeçar do zero num banco de teste: npx prisma migrate reset e depois npm run seed',
    );
  }

  // Ordem por causa das chaves estrangeiras.
  await prisma.$transaction([
    prisma.receipt.deleteMany({ where: { lotId: { in: lotIds } } }),
    prisma.ledgerEntry.deleteMany({ where: { OR: [{ walletId: { in: walletIds } }, { lotId: { in: lotIds } }] } }),
    prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } }),
    prisma.lotParticipant.deleteMany({ where: { lotId: { in: lotIds } } }),
    prisma.lotImage.deleteMany({ where: { lotId: { in: lotIds } } }),
    prisma.lot.deleteMany({ where: { id: { in: lotIds } } }),
    prisma.wallet.deleteMany({ where: { id: { in: walletIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  say(`Seed anterior apagado (${lotIds.length} lote(s)).`);
}

async function main() {
  stepTo('lendo as obras de prisma/fixtures');
  const [obra1, obra2, obra3, obra4] = await loadFixtures(); // antes de apagar: sem fixtures, não mexe em nada
  stepTo('conferindo e apagando o seed anterior');
  await removePreviousSeed();

  stepTo('criando as contas');

  // Contas pelo mesmo cadastro da API (usuário e carteira juntos, senha com bcrypt).
  const seller = (await register(SELLER)).user;
  const bidder1 = (await register(BIDDER_1)).user;
  const bidder2 = (await register(BIDDER_2)).user;
  for (const u of USERS) say(`Conta: ${u.email} / ${u.password}`);
  stepTo('depositando o saldo');
  await deposit(bidder1.id, BALANCE_CENTS);
  await deposit(bidder2.id, BALANCE_CENTS);
  say('Saldo: R$ 50.000,00 para cada licitante');

  const now = Date.now();

  // 1. Ao vivo, fim em 30 dias, 2 lances (licitante 1, depois licitante 2).
  //    É o "lote publicado com lances abertos" do PDF. Lances com o relógio do banco, como na API.
  stepTo('criando o lote 1');
  const live = await createLotFromArtwork(
    seller.id,
    {
      startingPriceCents: 100_000,
      minIncrementCents: 10_000,
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + 30 * DAY),
      description: 'Lote de demonstração com lances abertos.',
    },
    obra1.artwork,
    obra1.image,
  );
  stepTo('dando os lances do lote 1');
  await placeBid({ lotId: live.id, userId: bidder1.id, amountCents: 100_000 });
  await placeBid({ lotId: live.id, userId: bidder2.id, amountCents: 110_000 });
  say(`1. Ao vivo com 2 lances: ${live.title}`);

  // 2. Ao vivo sem lances, fim em 30 dias. Serve para testar o cancelamento.
  stepTo('criando o lote 2');
  const empty = await createLotFromArtwork(
    seller.id,
    {
      startingPriceCents: 50_000,
      minIncrementCents: 5_000,
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + 30 * DAY),
      description: 'Lote de demonstração ainda sem lances.',
    },
    obra2.artwork,
    obra2.image,
  );
  say(`2. Ao vivo sem lances: ${empty.title}`);

  // 3. Agendado: começa em 7 dias.
  stepTo('criando o lote 3');
  const scheduled = await createLotFromArtwork(
    seller.id,
    {
      startingPriceCents: 200_000,
      minIncrementCents: 20_000,
      startsAt: new Date(now + 7 * DAY),
      endsAt: new Date(now + 14 * DAY),
      description: 'Lote de demonstração agendado.',
    },
    obra3.artwork,
    obra3.image,
  );
  say(`3. Agendado: ${scheduled.title}`);

  // 4. Encerrado e liquidado, vencido pelo licitante 1.
  //    Criado com início e fim no passado; os lances usam o relógio injetável do placeBid
  //    (só o seed passa esse valor), então hash, selo e prorrogação ficam coerentes.
  const endedStart = new Date(now - 3 * DAY);
  const endedEnd = new Date(now - 1 * DAY);
  stepTo('criando o lote 4');
  const ended = await createLotFromArtwork(
    seller.id,
    {
      startingPriceCents: 80_000,
      minIncrementCents: 5_000,
      startsAt: endedStart,
      endsAt: endedEnd,
      description: 'Lote de demonstração já encerrado.',
    },
    obra4.artwork,
    obra4.image,
  );
  stepTo('dando os lances do lote 4');
  // Três lances: licitante 1 abre (vira "Licitante #1"), licitante 2 cobre, licitante 1 cobre de novo e vence.
  await placeBid({ lotId: ended.id, userId: bidder1.id, amountCents: 80_000, clock: new Date(now - 2 * DAY) });
  await placeBid({ lotId: ended.id, userId: bidder2.id, amountCents: 85_000, clock: new Date(now - 2 * DAY + HOUR) });
  await placeBid({ lotId: ended.id, userId: bidder1.id, amountCents: 90_000, clock: new Date(now - 2 * DAY + 2 * HOUR) });
  // Liquida como se o encerrador tivesse passado logo depois do fim: debita, credita e emite o comprovante.
  stepTo('liquidando o lote 4');
  const result = await settleLot(ended.id, { now: new Date(endedEnd.getTime() + 5_000) });
  if (!result?.sold) throw new Error('O lote encerrado do seed não foi liquidado');
  say(`4. Encerrado: ${ended.title}, arrematado pelo ${result.winnerAlias} por R$ 900,00 (com comprovante)`);
}

// O Node encerra sem aviso quando fica esperando algo que nunca responde. Assim, pelo menos diz onde parou.
// Escrita síncrona aqui: no terminal do Windows o console é assíncrono e, com o processo saindo,
// a linha se perderia.
process.on('exit', (code) => {
  if (!finished) writeSync(2, `O seed saiu sem terminar (código ${code}), na etapa: ${step}\n`);
});

main()
  .then(() => {
    finished = true;
    say('Seed concluído.');
  })
  .catch((error) => {
    finished = true;
    // Erro de configuração do próprio seed: só a mensagem. Qualquer outro: o erro inteiro, para diagnóstico.
    const detail = error?.message && !error.code && !error.cause ? error.message : inspect(error, { depth: 5 });
    console.error(`O seed falhou na etapa: ${step}\n${detail}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
