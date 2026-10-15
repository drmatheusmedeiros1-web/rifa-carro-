// Conta recebedora confirmada pelo organizador: $thiago_beautynorte.
// A conta é definida no servidor e não pode ser alterada pelo visitante.
const infiniteTag = 'thiago_beautynorte';
export function getInfinitePayHandle() {
  return infiniteTag;
}
export const PRICE_CENTS = 5000;
export function isValidQuantity(quantity) {
  return Number.isSafeInteger(quantity) && quantity >= 1 && Number.isSafeInteger(quantity * PRICE_CENTS);
}
