import { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert, Loader2, CheckCircle, Clock, XCircle, UserCheck, Ban,
  ChevronDown, ChevronUp, RotateCcw, Save, Send, Megaphone, Smartphone,
  Crown, User as UserIcon, AlertTriangle, Search
} from 'lucide-react';
import api from '../api/api';
import { toast } from 'react-toastify';

interface UserPermissions {
  campaigns: boolean;
  quickSend: boolean;
  multiInstance: boolean;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  isSuspended: boolean;
  maxDailyShots: number;
  dailyShotsSent: number;
  dailyShotsDate: string | null;
  totalShotsSent: number;
  permissions: UserPermissions;
  createdAt: string;
  _count: { instances: number; campaigns: number };
}

const ROLES = [
  { value: 'USER', label: 'Usuario', icon: UserIcon },
  { value: 'ADMIN', label: 'Admin', icon: Crown },
];

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'suspended'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'USER' | 'ADMIN'>('all');

  const [edits, setEdits] = useState<Record<string, Partial<UserData & { permissions: UserPermissions }>>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/auth/users/stats');
      setUsers(res.data);
    } catch {
      toast.error('Erro ao buscar usuarios');
    } finally {
      setLoading(false);
    }
  }

  function getEdit(userId: string) {
    return edits[userId] || {};
  }

  function setEdit(userId: string, data: Partial<UserData & { permissions: UserPermissions }>) {
    setEdits(prev => ({ ...prev, [userId]: { ...prev[userId], ...data } }));
  }

  function getEffective(user: UserData) {
    const edit = getEdit(user.id);
    return {
      role: edit.role ?? user.role,
      isApproved: edit.isApproved ?? user.isApproved,
      isSuspended: edit.isSuspended ?? user.isSuspended,
      maxDailyShots: edit.maxDailyShots ?? user.maxDailyShots,
      permissions: edit.permissions ?? (user.permissions as UserPermissions),
    };
  }

  function hasPendingChanges(user: UserData) {
    const edit = getEdit(user.id);
    return Object.keys(edit).length > 0;
  }

  async function handleSave(user: UserData) {
    const edit = getEdit(user.id);
    if (Object.keys(edit).length === 0) return;
    setSaving(user.id);
    try {
      const res = await api.put(`/auth/users/${user.id}`, edit);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...res.data } : u));
      setEdits(prev => { const n = { ...prev }; delete n[user.id]; return n; });
      toast.success(`${user.name} atualizado!`);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(null);
    }
  }

  async function handleResetDaily(user: UserData) {
    try {
      await api.post(`/auth/users/${user.id}/reset-daily`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, dailyShotsSent: 0 } : u));
      toast.success('Contador diario resetado');
    } catch {
      toast.error('Erro ao resetar');
    }
  }

  function isDailyToday(user: UserData) {
    if (!user.dailyShotsDate) return false;
    const d = new Date(user.dailyShotsDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function shortId(id: string) {
    return id.substring(0, 8).toUpperCase();
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.id.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === 'approved' && (!u.isApproved || u.isSuspended)) return false;
      if (statusFilter === 'pending' && u.isApproved) return false;
      if (statusFilter === 'suspended' && !u.isSuspended) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, search, statusFilter, roleFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-10">
        <div className="p-2 bg-indigo-600/20 rounded-lg">
          <ShieldAlert className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Gestao de Usuarios</h1>
          <p className="text-slate-400 text-sm">Permissoes, limites de disparo, cargos e controle total.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 mb-1">Total Usuarios</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-green-400 mb-1">Aprovados</p>
          <p className="text-2xl font-bold text-green-400">{users.filter(u => u.isApproved && !u.isSuspended).length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-amber-400 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-amber-400">{users.filter(u => !u.isApproved).length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-red-400 mb-1">Suspensos</p>
          <p className="text-2xl font-bold text-red-400">{users.filter(u => u.isSuspended).length}</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {([['all', 'Todos'], ['approved', 'Aprovados'], ['pending', 'Pendentes'], ['suspended', 'Suspensos']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === val ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setRoleFilter(r => r === 'all' ? 'ADMIN' : r === 'ADMIN' ? 'USER' : 'all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
              roleFilter !== 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {roleFilter === 'all' ? 'Cargo: Todos' : roleFilter}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-3">{filteredUsers.length} usuario(s) encontrado(s)</p>

      <div className="space-y-3">
        {filteredUsers.map(user => {
          const eff = getEffective(user);
          const isExpanded = expandedUser === user.id;
          const pending = hasPendingChanges(user);
          const dailyToday = isDailyToday(user);
          const dailyPercent = user.maxDailyShots > 0
            ? Math.min(100, Math.round(((dailyToday ? user.dailyShotsSent : 0) / user.maxDailyShots) * 100))
            : 0;

          return (
            <div key={user.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
              pending ? 'border-indigo-600/50' : 'border-slate-800'
            }`}>
              {/* Row header */}
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpandedUser(isExpanded ? null : user.id)}
              >
                {/* Status indicator */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  user.isSuspended ? 'bg-red-500' :
                  user.isApproved ? 'bg-green-500' : 'bg-amber-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold truncate">{user.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      eff.role === 'ADMIN' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {eff.role}
                    </span>
                    {user.isSuspended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-600/20 text-red-400">SUSPENSO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded" title={user.id}>
                      #{shortId(user.id)}
                    </span>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5" title="Disparos hoje">
                    <Send className="w-3.5 h-3.5" />
                    <span className={dailyPercent >= 90 ? 'text-red-400 font-bold' : ''}>
                      {dailyToday ? user.dailyShotsSent : 0}/{user.maxDailyShots}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Total disparado">
                    <Megaphone className="w-3.5 h-3.5" />
                    {user.totalShotsSent.toLocaleString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1.5" title="Instancias">
                    <Smartphone className="w-3.5 h-3.5" />
                    {user._count.instances}
                  </div>
                  <div className="flex items-center gap-1.5" title="Campanhas">
                    <Megaphone className="w-3.5 h-3.5" />
                    {user._count.campaigns}
                  </div>
                </div>

                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-6 space-y-6">
                  {/* Stats row mobile */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:hidden">
                    <div className="bg-slate-800 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Hoje</p>
                      <p className="font-bold">{dailyToday ? user.dailyShotsSent : 0}/{user.maxDailyShots}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="font-bold">{user.totalShotsSent.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Instancias</p>
                      <p className="font-bold">{user._count.instances}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Campanhas</p>
                      <p className="font-bold">{user._count.campaigns}</p>
                    </div>
                  </div>

                  {/* Daily progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Disparos Hoje</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {dailyToday ? user.dailyShotsSent : 0} / {eff.maxDailyShots}
                        </span>
                        <button onClick={() => handleResetDaily(user)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Resetar
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${dailyPercent >= 90 ? 'bg-red-500' : dailyPercent >= 60 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${dailyPercent}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-4">
                      {/* Role */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Cargo</label>
                        <div className="flex gap-2">
                          {ROLES.map(r => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setEdit(user.id, { role: r.value })}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                eff.role === r.value ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <r.icon className="w-4 h-4" /> {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status toggles */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEdit(user.id, { isApproved: !eff.isApproved })}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              eff.isApproved ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {eff.isApproved ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            {eff.isApproved ? 'Aprovado' : 'Pendente'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEdit(user.id, { isSuspended: !eff.isSuspended })}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              eff.isSuspended ? 'bg-red-600/20 text-red-400 border border-red-600/30' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {eff.isSuspended ? <Ban className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            {eff.isSuspended ? 'Suspenso' : 'Ativo'}
                          </button>
                        </div>
                      </div>

                      {/* Daily limit */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Limite Diario de Disparos</label>
                        <input
                          type="number" min={0} max={100000}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                          value={eff.maxDailyShots}
                          onChange={e => setEdit(user.id, { maxDailyShots: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    {/* Right column — Permissions */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-3">Permissoes</label>
                      <div className="space-y-3">
                        {[
                          { key: 'campaigns' as const, label: 'Criar Campanhas', desc: 'Permite criar e gerenciar campanhas de disparo', icon: Megaphone },
                          { key: 'quickSend' as const, label: 'Disparo Rapido', desc: 'Permite usar a funcao de disparo rapido', icon: Send },
                          { key: 'multiInstance' as const, label: 'Multiplas Instancias', desc: 'Permite conectar mais de uma instancia do WhatsApp', icon: Smartphone },
                        ].map(perm => (
                          <label key={perm.key} className="flex items-center gap-3 bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-all">
                            <input
                              type="checkbox"
                              checked={eff.permissions[perm.key]}
                              onChange={e => setEdit(user.id, { permissions: { ...eff.permissions, [perm.key]: e.target.checked } })}
                              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                            />
                            <perm.icon className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{perm.label}</p>
                              <p className="text-xs text-slate-500">{perm.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                    <span>Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                    <span>Total disparado: {user.totalShotsSent.toLocaleString('pt-BR')} mensagens</span>
                  </div>

                  {/* Save button */}
                  {pending && (
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setEdits(prev => { const n = { ...prev }; delete n[user.id]; return n; })}
                        className="px-5 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSave(user)}
                        disabled={saving === user.id}
                        className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                        {saving === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alteracoes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum usuario encontrado.</p>
          </div>
        )}
      </div>
    </>
  );
}
