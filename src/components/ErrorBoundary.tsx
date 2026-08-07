import React from 'react';
import { AlertTriangle, RotateCcw, Terminal } from 'lucide-react';
import { logError } from '../lib/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onOpenDevConsole?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

// Rede de segurança da aplicação: se qualquer componente quebrar durante a renderização
// (ex: erro de DOM do html2canvas, chave duplicada em lista, etc.), o React por padrão
// desmonta a árvore inteira e a tela fica em branco. Este boundary captura o erro,
// registra no log interno (visível no Painel do Desenvolvedor) e mostra uma tela de
// recuperação em vez de branco total — sem perder os dados (o Firestore guarda
// tudo em cache local automaticamente, mesmo offline).
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Erro desconhecido' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('REACT_RENDER_CRASH', error, { componentStack: info.componentStack });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-lg p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Ocorreu um erro inesperado</h2>
              <p className="text-xs text-slate-500 mt-1">
                Seus dados salvos não foram perdidos (ficam no dispositivo). Tente novamente ou recarregue a página.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
              <p className="text-[11px] font-mono text-slate-500 break-words">{this.state.errorMessage}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleTryAgain}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Recarregar a página
              </button>
              {this.props.onOpenDevConsole && (
                <button
                  onClick={this.props.onOpenDevConsole}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Ver detalhes técnicos do erro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
