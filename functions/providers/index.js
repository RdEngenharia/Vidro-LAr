// Registro central de provedores de boleto. Para adicionar um banco novo:
// 1. Criar functions/providers/<nome>.js exportando issueBoleto(credentials, boletoData)
// 2. Registrar aqui embaixo
// Nenhum outro arquivo do sistema precisa mudar.
const efi = require('./efi');
const inter = require('./inter');
const asaas = require('./asaas');

const PROVIDERS = {
  asaas,
  efi,
  inter,
};

function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Provedor de boleto desconhecido: "${name}"`);
  }
  return provider;
}

module.exports = { getProvider, PROVIDERS };
