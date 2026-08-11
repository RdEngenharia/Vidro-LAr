import React, { useState, useEffect } from 'react';
import { TeamMember, TeamMemberPermissions } from '../types';
import { listTeamMembers, createTeamMember, updateTeamMemberPermissions, removeTeamMember } from '../lib/teamApi';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  Trash2,
  Pencil,
  X,
  Check,
  Loader2,
  FileText,
  UserRound,
  Grid,
  Receipt,
} from 'lucide-react';

const MAX_MEMBERS = 2;

const PERMISSION_META: Array<{ id: keyof TeamMemberPermissions; label: string; icon: React.ElementType; description: string }> = [
  { id: 'orcamentos', label: 'Orçamentos e Pedidos', icon: FileText, description: 'Criar, editar e visualizar orçamentos' },
  { id: 'clientes', label: 'Cadastro de Clientes', icon: UserRound, description: 'Criar e editar clientes' },
  { id: 'precos', label: 'Categorias e Preços', icon: Grid, description: 'Alterar valores e produtos' },
  { id: 'boletos', label: 'Emitir Boletos', icon: Receipt, description: 'Emitir boletos (não inclui configurar o cofre bancário)' },
];

function emptyPermissions(): TeamMemberPermissions {
  return { orcamentos: false, clientes: false, precos: false, boletos: false };
}

interface UserManagementProps {
  currentUserUid: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUserUid }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPermissions, setFormPermissions] = useState<TeamMemberPermissions>(emptyPermissions());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const memberCount = members.filter((m) => m.role === 'member').length;
  const atLimit = memberCount >= MAX_MEMBERS;

  const loadMembers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const list = await listTeamMembers();
      // Mestre sempre primeiro, depois membros por nome
      list.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'master' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setMembers(list);
    } catch (err: any) {
      setLoadError(err?.message || 'Erro ao carregar a equipe.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const openCreateForm = () => {
    setEditingUid(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPermissions(emptyPermissions());
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (member: TeamMember) => {
    setEditingUid(member.uid);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormPassword('');
    setFormPermissions({ ...member.permissions });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUid(null);
  };

  const togglePermission = (id: keyof TeamMemberPermissions) => {
    setFormPermissions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Informe o nome do usuário.');
      return;
    }

    const hasAnyPermission = Object.values(formPermissions).some(Boolean);
    if (!hasAnyPermission) {
      setFormError('Marque pelo menos uma área de acesso para este usuário.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUid) {
        await updateTeamMemberPermissions({ memberUid: editingUid, permissions: formPermissions, name: formName.trim() });
      } else {
        if (!formEmail.trim()) {
          setFormError('Informe o e-mail do usuário.');
          setIsSaving(false);
          return;
        }
        if (formPassword.length < 6) {
          setFormError('A senha precisa ter pelo menos 6 caracteres.');
          setIsSaving(false);
          return;
        }
        await createTeamMember({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          permissions: formPermissions,
        });
      }
      closeForm();
      await loadMembers();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar o usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(`Remover o acesso de "${member.name}"? Essa pessoa não conseguirá mais entrar no sistema.`)) return;
    setRemovingUid(member.uid);
    try {
      await removeTeamMember(member.uid);
      await loadMembers();
    } catch (err: any) {
      alert(err?.message || 'Erro ao remover o usuário.');
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Usuários do Sistema
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Você é o administrador (mestre) da conta. Pode criar até {MAX_MEMBERS} usuários adicionais e escolher
            exatamente o que cada um enxerga.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={atLimit}
          title={atLimit ? `Limite de ${MAX_MEMBERS} usuários adicionais atingido` : ''}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4 text-blue-400" />
          <span>Adicionar Usuário</span>
        </button>
      </div>

      {atLimit && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
          Limite de {MAX_MEMBERS} usuários adicionais atingido. Remova um usuário existente para poder criar outro.
        </div>
      )}

      {/* Lista de usuários */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando equipe...
        </div>
      ) : loadError ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
          {loadError}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map((member) => {
            const isMaster = member.role === 'master';
            const isSelf = member.uid === currentUserUid;
            return (
              <div
                key={member.uid}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isMaster ? 'bg-amber-100' : 'bg-blue-100'
                      }`}
                    >
                      {isMaster ? (
                        <Crown className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Shield className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {member.name} {isSelf && <span className="text-slate-400 font-normal">(você)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isMaster ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isMaster ? 'Mestre' : 'Membro'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PERMISSION_META.map((perm) => {
                    const active = member.permissions?.[perm.id];
                    const Icon = perm.icon;
                    return (
                      <span
                        key={perm.id}
                        title={perm.description}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-300 border-slate-100'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {perm.label}
                      </span>
                    );
                  })}
                </div>

                {!isMaster && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openEditForm(member)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={removingUid === member.uid}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {removingUid === member.uid ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Remover
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criar/editar usuário */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                {editingUid ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  placeholder="Nome do usuário"
                />
              </div>

              {!editingUid && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      minLength={6}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Combine com a pessoa antes — ela poderá trocar a própria senha depois de logar.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">O que esse usuário pode acessar</label>
                <div className="space-y-2">
                  {PERMISSION_META.map((perm) => {
                    const Icon = perm.icon;
                    const active = formPermissions[perm.id];
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            active ? 'bg-slate-900' : 'bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900">{perm.label}</p>
                          <p className="text-[10px] text-slate-500">{perm.description}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            active ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : editingUid ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
