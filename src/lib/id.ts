// Gera IDs únicos de verdade (usa crypto.randomUUID quando disponível).
// Usado em toda a aplicação para IDs de itens, clientes, categorias, produtos e formas
// de pagamento — evita qualquer colisão de chave quando dois registros são criados no
// mesmo milissegundo, que é uma causa clássica de crash "removeChild" no React ao
// reconciliar listas com chaves duplicadas.
export function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
