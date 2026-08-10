import React, { useState } from 'react';
import { CompanySettings } from '../types';
import { useAuth } from '../lib/authContext';
import { Settings, Upload, Save, Building2, CheckCircle2, FileText, Info } from 'lucide-react';

interface CompanySettingsProps {
  settings?: CompanySettings | null;
  onSave: (settings: CompanySettings) => Promise<void>;
}

export const CompanySettingsView: React.FC<CompanySettingsProps> = ({
  settings,
  onSave,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || 'tenant_default';

  const [companyName, setCompanyName] = useState(settings?.companyName || user?.companyName || 'Vidraçaria Coroa Alta');
  const [tradeName, setTradeName] = useState(settings?.tradeName || companyName);
  const [cnpj, setCnpj] = useState(settings?.cnpj || '');
  const [address, setAddress] = useState(settings?.address || 'Rua Tupiguás, Nº 1500 - Aldeia Sta. Maria, Coroa Vermelha - BA');
  const [cityState, setCityState] = useState(settings?.cityState || 'Santa Cruz Cabrália - BA');
  const [phone, setPhone] = useState(settings?.phone || '(73) 99931-3164');
  const [email, setEmail] = useState(settings?.email || 'vidramarcoroaalta@hotmail.com');
  const [tagline, setTagline] = useState(settings?.tagline || 'PORTAS - JANELAS - ESPELHOS - BOX & VIDROS');
  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl || '');
  const [defaultCashDiscount, setDefaultCashDiscount] = useState<number>(settings?.defaultCashDiscount || 10);
  const [defaultValidDays, setDefaultValidDays] = useState<number>(settings?.defaultValidDays || 15);
  const [termsText, setTermsText] = useState(settings?.termsText || 'Proposta válida por 15 dias, ou até reajuste anunciado pelas tempêras.');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redimensiona e comprime a imagem antes de transformar em Base64. O Firestore
  // recusa documentos com mais de 1 MB no total — uma foto de celular sem
  // compressão facilmente ultrapassa isso sozinha, fazendo o salvamento falhar
  // silenciosamente (a logo "sumia" ao recarregar porque nunca foi salva de
  // verdade). Limitar a logo a ~300px de largura deixa ela com poucos KB,
  // suficiente pra qualidade de cabeçalho de PDF, com folga enorme no limite.
  const compressImage = (file: File, maxWidth = 480, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
      reader.onloadend = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido.'));
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const targetWidth = Math.round(img.width * scale);
          const targetHeight = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível processar a imagem neste navegador.'));
            return;
          }
          // IMPORTANTE: preenche o fundo de branco ANTES de desenhar a logo. O
          // formato JPEG não suporta transparência — sem isso, qualquer área
          // transparente do PNG original (o que geralmente parece "fundo branco"
          // na tela) vira preto ao ser achatada pelo canvas.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Logo Upload via file reader (com compressão automática)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaveError('');
    setIsUploadingLogo(true);
    try {
      const compressed = await compressImage(file);
      // Folga de segurança: se mesmo comprimida a imagem ficar grande demais
      // (ex: foto extremamente larga), avisa em vez de deixar salvar silenciosamente.
      const approxBytes = Math.ceil((compressed.length * 3) / 4);
      if (approxBytes > 700_000) {
        setSaveError('Essa imagem ainda ficou grande demais mesmo após compactar. Tente uma foto mais simples ou um logo já em formato PNG/JPG leve.');
        setIsUploadingLogo(false);
        return;
      }
      setLogoUrl(compressed);
    } catch (err: any) {
      setSaveError(err?.message || 'Erro ao processar a imagem da logo.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSavedSuccess(false);

    const updated: CompanySettings = {
      tenantId,
      companyName,
      tradeName,
      cnpj,
      address,
      cityState,
      phone,
      email,
      logoUrl,
      tagline,
      defaultCashDiscount,
      defaultValidDays,
      termsText,
    };

    setIsSaving(true);
    try {
      await onSave(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      // Antes, um erro aqui (ex: documento grande demais no Firestore) ficava
      // silencioso — a tela não avisava nada, e os dados pareciam salvos até a
      // pessoa recarregar a página e ver que sumiram. Agora sempre aparece um aviso.
      setSaveError(
        err?.message?.includes('longer than')
          ? 'Não foi possível salvar: a logo ficou grande demais para o banco de dados. Tente uma imagem menor.'
          : `Erro ao salvar as configurações: ${err?.message || 'tente novamente.'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Configurações da Vidraçaria
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure o cabeçalho, logo, contatos e dados legais que aparecem no PDF impresso para o cliente.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Save className="w-4 h-4 text-blue-400" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      {saveError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <Info className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configurações atualizadas com sucesso! O cabeçalho dos novos PDFs já usará estes dados.</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Logo & Branding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
            Logotipo & Marca Visual
          </h3>

          <div className="space-y-3">
            <div className="border-2 border-dashed border-slate-200 p-4 rounded-xl text-center bg-slate-50 flex flex-col items-center justify-center">
              {isUploadingLogo ? (
                <div className="space-y-2 py-2">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">Otimizando imagem...</p>
                </div>
              ) : logoUrl ? (
                <div className="space-y-2">
                  <img src={logoUrl} alt="Logo Vidraçaria" className="max-h-24 max-w-full object-contain mx-auto" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Remover Imagem
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600 font-semibold">Nenhuma logo personalizada inserida</p>
                  <p className="text-[10px] text-slate-400">Suporta arquivos PNG, JPG ou WebP</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Upload da Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-60"
              />
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slogan / Subtítulo</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="PORTAS - JANELAS - ESPELHOS - BOX & VIDROS"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs uppercase font-bold text-slate-800"
              />
            </div>

            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-blue-900 leading-relaxed">
              <strong className="block mb-0.5">Dica para a Logo:</strong>
              Envie uma imagem em alta resolução (PNG ou JPG) com fundo transparente para garantir um excelente resultado na impressão e visualização do orçamento em PDF.
            </div>
          </div>
        </div>

        {/* Company Data */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
            Dados de Contato & Endereço da Vidraçaria
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social / Nome Oficial</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Vidraçaria Coroa Alta Ltda"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Fantasia</label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Vidraçaria Coroa Alta"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp Comercial</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(73) 99931-3164"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Comercial</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vidramarcoroaalta@hotmail.com"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / Estado</label>
              <input
                type="text"
                value={cityState}
                onChange={(e) => setCityState(e.target.value)}
                placeholder="Santa Cruz Cabrália - BA"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Físico Completo</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua Tupiguás Nº 1500, Aldeia Stª Maria - Coroa Vermelha"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

          </div>

          <hr className="border-slate-100 my-4" />

          {/* Terms and Discounts */}
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
            Termos da Proposta & Descontos Padrão
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">% Desconto Padrão à Vista</label>
              <input
                type="number"
                min="0"
                max="50"
                value={defaultCashDiscount}
                onChange={(e) => setDefaultCashDiscount(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Validade Padrão da Proposta (Dias)</label>
              <input
                type="number"
                min="1"
                value={defaultValidDays}
                onChange={(e) => setDefaultValidDays(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Texto de Validade / Condições Legais do PDF</label>
              <textarea
                rows={2}
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
              ></textarea>
            </div>
          </div>

        </div>

      </div>

    </form>
  );
};
