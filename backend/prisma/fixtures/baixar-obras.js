import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadImage, getArtwork } from '../../src/services/aicService.js';

// Roda UMA vez, na sua máquina: baixa 4 obras de domínio público do Art Institute e grava
// os dados e as imagens nesta pasta. Os arquivos vão para o git e o seed lê daqui,
// então o seed nunca depende da API externa (tarefa 78).
//
//   node prisma/fixtures/baixar-obras.js
//
// Passa pelo MESMO aicService das rotas: só entra obra de domínio público, com imagem válida.

const HERE = dirname(fileURLToPath(import.meta.url));
const WANTED = 4;

// Candidatas em ordem de preferência. Se alguma deixar de ser de domínio público ou sair do
// acervo, o script pula para a próxima.
const CANDIDATES = [
  '27992', // Seurat, Tarde de domingo na Ilha de Grande Jatte
  '28560', // Van Gogh, O quarto
  '20684', // Caillebotte, Rua de Paris, dia chuvoso
  '16568', // Monet, Ninfeias
  '14655', // Renoir, Duas irmãs (no terraço)
  '16571', // Monet, Medas de feno
  '64818', // Monet, Medas de feno (fim do verão)
  '81558', // Monet, Chegada do trem de Normandia
  '14620', // Cassatt, O banho
  '87479', // Monet, A ponte japonesa
];

const obras = [];
for (const externalId of CANDIDATES) {
  if (obras.length === WANTED) break;
  let artwork;
  let image;
  try {
    artwork = await getArtwork(externalId);
    if (!artwork) {
      console.log(`Pulando ${externalId}: não encontrada ou sem imagem de domínio público`);
      continue;
    }
    image = await downloadImage(artwork.imageUrl);
  } catch {
    // O motivo já saiu no log do aicService ("[AIC] ..."). Tenta a próxima obra.
    console.log(`Pulando ${externalId}: falha ao falar com o Art Institute (endereço da imagem: ${artwork?.imageUrl ?? '-'})`);
    continue;
  }
  const file = `obra-${externalId}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  await writeFile(join(HERE, file), image.bytes);
  // A descrição da API (licença CC BY) não é guardada, igual ao createLot.
  const { imageUrl, description, ...data } = artwork;
  obras.push({ ...data, file, mimeType: image.mimeType });
  console.log(`OK ${externalId}: ${artwork.title} (${Math.round(image.bytes.length / 1024)} KB)`);
}

if (obras.length < WANTED) {
  console.error(`Só ${obras.length} obra(s) baixada(s). Copie as linhas "[AIC]" acima e me mande.`);
  process.exit(1);
}
await writeFile(join(HERE, 'obras.json'), `${JSON.stringify(obras, null, 2)}\n`);
console.log('Pronto: prisma/fixtures/obras.json e as imagens. Agora rode o seed.');
