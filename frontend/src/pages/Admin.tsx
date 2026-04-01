import { useEffect, useState } from 'react';
import { UserCheck, ShieldAlert, Clock, CheckCircle, Loader2 } from 'lucide-react';
import api from '../api/api';
import { toast } from 'react-toastify';

interface User {
  id: string;
  name: string;
  email: string;
  isApproved: boolean;
  role: string;
}

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch {
      toast.error('Erro ao buscar usuarios');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await api.patch(`/auth/users/${id}/approve`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isApproved: true } : u));
      toast.success('Usuario aprovado com sucesso!');
    } catch {
      toast.error('Nao foi possivel aprovar o usuario.');
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-10">
        <div className="p-2 bg-indigo-600/20 rounded-lg">
          <ShieldAlert className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Painel de Aprovacao</h1>
          <p className="text-slate-400 text-sm">Gerencie o acesso dos novos usuarios ao sistema.</p>
        </div>
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
                  <th className="p-5 font-semibold">Perfil</th>
                  <th className="p-5 font-semibold text-center">Status</th>
                  <th className="p-5 font-semibold text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-5 font-medium whitespace-nowrap">{user.name}</td>
                    <td className="p-5 text-slate-400 whitespace-nowrap">{user.email}</td>
                    <td className="p-5">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${user.role === 'ADMIN' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                        {user.role}
                      </span>
                    </td>
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
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                          >
                            <UserCheck className="w-4 h-4" /> Aprovar
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
                <p className="text-slate-500">Nenhum usuario registrado.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
