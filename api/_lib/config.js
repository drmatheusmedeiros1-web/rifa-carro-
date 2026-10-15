// Reutiliza a InfiniteTag configurada na hospedagem (com ou sem o $ inicial).
// Se preferir configurar no código, preencha infiniteTag com o identificador real.
const infiniteTag = '';
export function getInfinitePayHandle() {
  return (process.env.INFINITEPAY_HANDLE || infiniteTag).trim().replace(/^\$/, '');
}
export const PRICE_CENTS = 5000;
export const QUANTITIES = [1, 5, 10, 20, 50];
