export type Phase = "LIVE" | "SCHEDULED" | "ENDED"

export type Lot = {
  id: string
  title: string
  artist: string
  date: string
  medium: string
  dimensions: string
  image: string
  phase: Phase
  price: number
  meta: string
  bids: number
  description: string
}

export const lots: Lot[] = [
  {
    id: "water-lilies",
    title: "Water Lilies",
    artist: "Claude Monet",
    date: "1906",
    medium: "Óleo sobre tela",
    dimensions: "89,9 × 94,1 cm",
    image:
      "https://www.artic.edu/iiif/2/744becf8-df39-4f9f-bbc9-46859a2ec35b/full/843,/0/default.jpg",
    phase: "LIVE",
    price: 320000,
    meta: "termina em 01:38",
    bids: 8,
    description:
      "Reflexos e camadas de cor dissolvem a fronteira entre a água e o céu nesta visão imersiva do jardim de Giverny.",
  },
  {
    id: "bedroom",
    title: "The Bedroom",
    artist: "Vincent van Gogh",
    date: "1889",
    medium: "Óleo sobre tela",
    dimensions: "73,6 × 92,3 cm",
    image:
      "https://www.artic.edu/iiif/2/a9ea7cb7-7ca9-323d-f057-41eeb6fd0a4d/full/843,/0/default.jpg",
    phase: "LIVE",
    price: 680000,
    meta: "termina em 08:24",
    bids: 13,
    description:
      "Van Gogh transforma seu quarto em Arles com perspectiva inclinada, cores intensas e uma sensação deliberada de repouso.",
  },
  {
    id: "wave",
    title: "Under the Wave off Kanagawa",
    artist: "Katsushika Hokusai",
    date: "1830/33",
    medium: "Xilogravura colorida",
    dimensions: "25,7 × 37,8 cm",
    image:
      "https://www.artic.edu/iiif/2/6ca64fb4-3c6f-b0a7-34bc-d17df8a02a7e/full/843,/0/default.jpg",
    phase: "LIVE",
    price: 245000,
    meta: "termina em 21:06",
    bids: 5,
    description:
      "A onda monumental curva-se sobre pequenas embarcações, enquanto o Monte Fuji permanece estável ao longe.",
  },
  {
    id: "two-sisters",
    title: "Two Sisters (On the Terrace)",
    artist: "Pierre-Auguste Renoir",
    date: "1881",
    medium: "Óleo sobre tela",
    dimensions: "100,5 × 81 cm",
    image:
      "https://www.artic.edu/iiif/2/46df57f9-a162-51a1-5a33-1a8a6418b69e/full/843,/0/default.jpg",
    phase: "SCHEDULED",
    price: 180000,
    meta: "abre 05/11 às 19:00",
    bids: 0,
    description:
      "Duas figuras em um terraço à margem do Sena combinam retrato, paisagem e a luminosidade característica de Renoir.",
  },
  {
    id: "paris-street",
    title: "Paris Street; Rainy Day",
    artist: "Gustave Caillebotte",
    date: "1877",
    medium: "Óleo sobre tela",
    dimensions: "212,2 × 276,2 cm",
    image:
      "https://www.artic.edu/iiif/2/855c02b5-6e6c-ec9e-8f2b-cb3b014029ce/full/843,/0/default.jpg",
    phase: "SCHEDULED",
    price: 420000,
    meta: "abre 07/11 às 20:30",
    bids: 0,
    description:
      "Uma avenida parisiense monumental registra a geometria urbana, o clima e o anonimato da vida moderna.",
  },
  {
    id: "american-gothic",
    title: "American Gothic",
    artist: "Grant Wood",
    date: "1930",
    medium: "Óleo sobre painel",
    dimensions: "78 × 65,3 cm",
    image:
      "https://www.artic.edu/iiif/2/b272df73-bb7f-f15a-f800-7e55230b8e03/full/843,/0/default.jpg",
    phase: "ENDED",
    price: 480000,
    meta: "arrematado por Licitante #2",
    bids: 11,
    description:
      "O retrato rigoroso de um fazendeiro e sua filha tornou-se um dos símbolos mais reconhecidos da arte norte-americana.",
  },
  {
    id: "night-hawks",
    title: "Nighthawks",
    artist: "Edward Hopper",
    date: "1942",
    medium: "Óleo sobre tela",
    dimensions: "84,1 × 152,4 cm",
    image:
      "https://www.artic.edu/iiif/2/831a05de-d3f6-f4fa-a460-23008dd58dda/full/843,/0/default.jpg",
    phase: "ENDED",
    price: 120000,
    meta: "encerrado sem lances",
    bids: 0,
    description:
      "A luz elétrica de uma lanchonete noturna recorta quatro figuras silenciosas em uma cidade quase vazia.",
  },
]

export const bidHistory = [
  {
    alias: "Licitante #3",
    value: 320000,
    time: "19:42:18",
    own: false,
    fresh: true,
  },
  { alias: "Licitante #2", value: 300000, time: "19:41:54", own: true },
  { alias: "Licitante #1", value: 280000, time: "19:40:21", own: false },
  { alias: "Licitante #3", value: 260000, time: "19:38:09", own: false },
  { alias: "Licitante #2", value: 240000, time: "19:36:45", own: true },
]

export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  )
