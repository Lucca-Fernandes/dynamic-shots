import { useEffect, useState } from 'react';
import { Plus, LayoutDashboard, Smartphone, LogOut, Loader2, CheckCircle2, XCircle, ShieldCheck, X, Send, QrCode } from 'lucide-react';
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
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const userJson = localStorage.getItem('@DynamicShots:user');
  const user = userJson ? JSON.parse(userJson) : null;

  useEffect(() => {
    fetchInstances();
  }, []);

  async function fetchInstances() {
    try {
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

  async function handleConnect(id: string) {
    setConnectingId(id);
    try {
      const response = await api.get(`/instances/${id}/connect`);
      setQrCodeData(response.data.qrcode);
      setIsQrModalOpen(true);
    } catch (err) {
      alert('Não foi possível gerar o QR Code. Verifique se a API está online.');
    } finally {
      setConnectingId(null);
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

      <main className="flex-1 ml-64 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold">Minhas Instâncias</h1>
            <p className="text-slate-400 text-sm">Bem-vindo, {user?.name}.</p>
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
              <div key={instance.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/50 transition-all group relative">
                <div className="flex justify-between mb-4">
                  <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                    <Smartphone className="w-6 h-6 text-indigo-400" />
                  </div>
                  <span className={`text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider ${
                    instance.status === 'CONNECTED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {instance.status === 'CONNECTED' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {instance.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold truncate">{instance.name}</h3>
                <p className="text-[10px] text-slate-500 mb-6 font-mono">ID: {instance.id}</p>
                
                <button 
                  onClick={() => handleConnect(instance.id)}
                  disabled={connectingId === instance.id || instance.status === 'CONNECTED'}
                  className="w-full py-3 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:bg-slate-800"
                >
                  {connectingId === instance.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  {instance.status === 'CONNECTED' ? 'WhatsApp Conectado' : 'Conectar WhatsApp'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-100">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X /></button>
            <h2 className="text-2xl font-bold mb-2 text-indigo-400">Nova Instância</h2>
            <p className="text-slate-400 mb-6 text-sm">Dê um nome para identificar seu WhatsApp.</p>
            <form onSubmit={handleCreateInstance}>
              <input
                autoFocus
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 text-white mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="Ex: Suporte 01"
              />
              <button disabled={isCreating} className="w-full bg-indigo-600 py-4 rounded-xl font-bold flex justify-center shadow-lg shadow-indigo-600/40">
                {isCreating ? <Loader2 className="animate-spin" /> : 'Confirmar e Criar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 z-110">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] max-w-sm w-full text-center shadow-2xl relative">
            <button 
              onClick={() => { setIsQrModalOpen(false); setQrCodeData(null); fetchInstances(); }} 
              className="absolute top-6 right-6 text-slate-500 hover:text-white"
            >
              <X />
            </button>
            
            <h2 className="text-2xl font-bold mb-2">Escaneie o QR Code</h2>
            <p className="text-slate-400 text-sm mb-8">Abra o WhatsApp {'>'} Aparelhos Conectados.</p>
            
            <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(79,70,229,0.3)]">
              {qrCodeData ? (
                <img src={qrCodeData} alt="WhatsApp QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-2xl">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                </div>
              )}
            </div>

            <button 
              onClick={() => { setIsQrModalOpen(false); fetchInstances(); }}
              className="w-full bg-indigo-600 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
            >
              Já escaneei
            </button>
          </div>
        </div>
      )}
    </div>
  );
}