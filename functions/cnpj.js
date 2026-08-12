// ---------------------------------------------------------------------------
// Validação e consulta de CNPJ — usado no cadastro de conta nova.
// ---------------------------------------------------------------------------
// Duas camadas, propositalmente:
//   1. Validação matemática (dígitos verificadores) — recusa na hora qualquer
//      número inválido, sem gastar uma consulta de rede.
//   2. Consulta real na Receita Federal (via BrasilAPI, pública e gratuita) —
//      confirma que o CNPJ existe DE VERDADE e está ativo. Um número que passa
//      só na validação matemática pode ser inventado; a consulta real é o que
//      de fato previne fraude (cadastro com CNPJ fictício só pra abrir vários
//      testes grátis).
const https = require('https');

function limparCnpj(cnpj) {
  return (cnpj || '').replace(/\D/g, '');
}

// Algoritmo padrão de validação de CNPJ (dígitos verificadores, módulo 11).
function isValidCnpjChecksum(cnpjRaw) {
  const cnpj = limparCnpj(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos os dígitos iguais — sempre inválido

  const calcularDigito = (base) => {
    let tamanho = base.length;
    let pos = tamanho - 7;
    let soma = 0;
    for (let i = tamanho; i >= 1; i--) {
      soma += Number(base.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const resultado = soma % 11;
    return resultado < 2 ? 0 : 11 - resultado;
  };

  const digito1 = calcularDigito(cnpj.substring(0, 12));
  if (digito1 !== Number(cnpj.charAt(12))) return false;

  const digito2 = calcularDigito(cnpj.substring(0, 13));
  if (digito2 !== Number(cnpj.charAt(13))) return false;

  return true;
}

function consultarBrasilApi(cnpj) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'brasilapi.com.br',
        path: `/api/cnpj/v1/${cnpj}`,
        method: 'GET',
        headers: { 'User-Agent': 'VidracariaPro/1.0' },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = null;
          }
          if (res.statusCode === 200 && parsed) {
            resolve(parsed);
          } else if (res.statusCode === 404) {
            reject(new Error('CNPJ não encontrado na Receita Federal. Confira o número digitado.'));
          } else {
            reject(new Error('Não foi possível consultar o CNPJ no momento. Tente novamente em instantes.'));
          }
        });
      }
    );
    req.on('error', () => reject(new Error('Falha de conexão ao consultar o CNPJ.')));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('A consulta do CNPJ demorou demais. Tente novamente.'));
    });
    req.end();
  });
}

// Retorna os dados oficiais da empresa se o CNPJ for válido e estiver ativo;
// lança erro com uma mensagem clara em qualquer outro caso.
async function validarCnpjReal(cnpjRaw) {
  const cnpj = limparCnpj(cnpjRaw);

  if (!isValidCnpjChecksum(cnpj)) {
    throw new Error('CNPJ inválido — confira os números digitados.');
  }

  const dados = await consultarBrasilApi(cnpj);

  const situacao = (dados.descricao_situacao_cadastral || '').toUpperCase();
  if (situacao && situacao !== 'ATIVA') {
    throw new Error(`Este CNPJ está com situação cadastral "${dados.descricao_situacao_cadastral}" na Receita Federal — só é possível cadastrar empresas ativas.`);
  }

  return {
    cnpj,
    razaoSocial: dados.razao_social || '',
    nomeFantasia: dados.nome_fantasia || '',
    situacao: dados.descricao_situacao_cadastral || 'ATIVA',
  };
}

module.exports = { limparCnpj, isValidCnpjChecksum, validarCnpjReal };
