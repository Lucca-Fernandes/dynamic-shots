import { useEffect, useState } from 'react';
import { Plus, LayoutDashboard, Smartphone, LogOut, Loader2, CheckCircle2, XCircle, ShieldCheck, X, Send, QrCode, Trash2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api';

interface Instance {
  id: string;
  name: string;
  status: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const userJson = localStorage.getItem('@DynamicShots:user');
  const user = userJson ? JSON.parse(userJson) : null;

  useEffect(() => {
    fetchInstances();
  }, []);

  async function fetchInstances() {
    try {
      setLoading(true);
      const response = await api.get('/instances');
      setInstances(response.data);
    } catch (err) {
      console.error('Erro ao buscar instâncias');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (!newInstanceName.trim()) return;
    setIsCreating(true);
    try {
      await api.post('/instances', { name: newInstanceName });
      setNewInstanceName('');
      setIsModalOpen(false);
      fetchInstances();
    } catch (err) {
      alert('Erro ao criar instância');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteInstance(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta instância? Isso removerá a conexão no WhatsApp também.")) return;
    try {
      await api.delete(`/instances/${id}`);
      fetchInstances();
    } catch (err) {
      alert("Erro ao excluir instância");
    }
  }

  async function handleConnect(id: string) {
    setActiveInstanceId(id);
    setQrCodeData(null);
    setIsQrModalOpen(true);
    try {
      const response = await api.get(`/instances/${id}/connect`);
      if (response.data.qrcode) {
        setQrCodeData(response.data.qrcode);
      }
    } catch (err: any) {
      alert("Erro ao gerar QR Code. Tente novamente.");
      setIsQrModalOpen(false);
    }
  }

  async function handleConfirmScan() {
    if (!activeInstanceId) return;

    setIsSyncing(true);
    try {
      await api.get(`/instances/${activeInstanceId}/sync`);

      setIsQrModalOpen(false);
      setActiveInstanceId(null);
      setQrCodeData(null);

      fetchInstances();

    } catch (err) {
      console.error("Erro na sincronização", err);
      setIsQrModalOpen(false);
      fetchInstances();
    } finally {
      setIsSyncing(false);
    }
  }

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex text-white font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 flex flex-col fixed h-full z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg"><LayoutDashboard className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-xl tracking-tight">Dynamic Shots</span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium text-sm">
            <Smartphone className="w-5 h-5" /> Instâncias
          </Link>
          <Link to="/disparos" className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all text-sm">
            <Send className="w-5 h-5" /> Disparos
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/z-admin" className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-500" /> Painel ADM
            </Link>
          )}
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 transition-colors mt-auto text-sm">
          <LogOut className="w-5 h-5" /> Sair
        </button>
      </aside>

      <main className="flex-1 ml-64 p-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold">Minhas Instâncias</h1>
            <p className="text-slate-400 text-sm">Olá, {user?.name}. Gerencie suas conexões.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-5 h-5" /> Nova Instância
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <div key={instance.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group relative flex flex-col">

                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                    <Smartphone className="w-6 h-6 text-indigo-400" />
                  </div>

                  <span className={`text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-bold ${instance.status === 'CONNECTED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {instance.status === 'CONNECTED' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {instance.status}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold truncate">{instance.name}</h3>
                  <p className="text-[10px] text-slate-500 mb-6 font-mono opacity-50">ID: {instance.id}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnect(instance.id)}
                    disabled={instance.status === 'CONNECTED'}
                    className="flex-4 py-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:bg-slate-800"
                  >
                    <QrCode className="w-4 h-4" />
                    {instance.status === 'CONNECTED' ? 'Conectado' : 'Conectar WhatsApp'}
                  </button>

                  <button
                    onClick={() => handleDeleteInstance(instance.id)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all flex justify-center items-center border border-transparent hover:border-red-500/30"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full">
            <h2 className="text-xl font-bold mb-6">Nova Instância</h2>
            <form onSubmit={handleCreateInstance}>
              <input
                autoFocus
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white mb-6 outline-none"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="Ex: Celular Vendas"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-400">Cancelar</button>
                <button disabled={isCreating} className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold">
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] max-w-sm w-full text-center relative">
            <button
              onClick={() => { setIsQrModalOpen(false); setActiveInstanceId(null); setQrCodeData(null); }}
              className="absolute top-6 right-6 text-slate-500 hover:text-white"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold mb-2">Escaneie o QR Code</h2>
            <p className="text-slate-400 text-sm mb-8">Abra o WhatsApp e aponte a câmera para a tela.</p>

            <div className="bg-white p-4 rounded-3xl inline-block mb-8">
              {qrCodeData ? (
                <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-2xl">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                </div>
              )}
            </div>

            <button
              onClick={handleConfirmScan}
              disabled={isSyncing || !qrCodeData}
              className="w-full bg-indigo-600 py-4 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Já escaneei'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}