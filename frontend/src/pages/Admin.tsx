import { useEffect, useState } from 'react';
import { UserCheck, ShieldAlert, Clock, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

interface User {
  id: string;
  name: string;
  email: string;
  isApproved: boolean;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await api.patch(`/auth/users/${id}/approve`);
      await fetchUsers();
    } catch (err) {
      console.error("Erro ao aprovar:", err);
      alert('Não foi possível aprovar o usuário.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-white">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <ShieldAlert className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Painel de Aprovação</h1>
              <p className="text-slate-400 text-sm">Gerencie o acesso dos novos usuários ao sistema.</p>
            </div>
          </div>

          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar para Dashboard
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-5 font-semibold">Nome</th>
                    <th className="p-5 font-semibold">E-mail</th>
                    <th className="p-5 font-semibold text-center">Status</th>
                    <th className="p-5 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-5 font-medium whitespace-nowrap">{user.name}</td>
                      <td className="p-5 text-slate-400 whitespace-nowrap">{user.email}</td>
                      <td className="p-5">
                        <div className="flex justify-center">
                          {user.isApproved ? (
                            <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-green-500/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Aprovado
                            </span>
                          ) : (
                            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5" /> Pendente
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end min-h-9 items-center">
                          {!user.isApproved ? (
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 transform active:scale-95"
                            >
                              <UserCheck className="w-4 h-4" /> Aprovar Usuário
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Acesso Liberado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="p-20 text-center">
                  <p className="text-slate-500">Nenhum usuário aguardando aprovação no momento.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
          Aprovações automáticas via banco de dados estão desativadas.
        </div>
      </div>
    </div>
  );
}