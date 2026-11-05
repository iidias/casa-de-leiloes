// Dinheiro no front. A API só conversa em centavos inteiros; o texto com vírgula
// existe só na tela. Nada de float: "1.234,56" vira 123456 por manipulação de texto.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 123456 → "R$ 1.234,56"
export function formatBRL(cents) {
  return brl.format((Number(cents) || 0) / 100);
}

// 123456 → "1.234,56" (para preencher um campo de valor)
export function centsToInput(cents) {
  return plain.format((Number(cents) || 0) / 100);
}

// Texto digitado → centavos inteiros, ou null se não for um valor válido.
// Aceita "1.234,56", "1234,56", "1234", "R$ 1.234", "1234.5" e "1234.56".
// O ponto só vale como decimal quando não há vírgula e ele separa 1 ou 2 dígitos
// no final; "1.234" é mil duzentos e trinta e quatro reais, como se lê no Brasil.
export function toCents(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== 'string') return null;

  const text = input.replace(/R\$/gi, '').replace(/\s/g, '');
  if (text === '') return null;

  let whole;
  let fraction = '';

  if (text.includes(',')) {
    const parts = text.split(',');
    if (parts.length !== 2) return null;
    [whole, fraction] = parts;
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(whole)) return null;
    whole = whole.replace(/\./g, '');
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    [whole, fraction] = text.split('.');
  } else if (/^(\d{1,3}(\.\d{3})+|\d+)$/.test(text)) {
    whole = text.replace(/\./g, '');
  } else {
    return null;
  }

  if (!/^\d{0,2}$/.test(fraction)) return null;
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
