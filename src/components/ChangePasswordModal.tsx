import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { Lock, X, Check } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword, authError } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Preencha todos os campos');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('A nova senha precisa ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação não bate com a nova senha');
      return;
    }

    setIsSubmitting(true);
    const success = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (success) {
      setSuccessMessage('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setErrorMessage(authError || 'Não foi possível alterar a senha.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200">

        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm">Alterar Senha</h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Atual</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer mt-2"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
