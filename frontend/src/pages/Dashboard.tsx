import { useEffect, useState } from 'react';
import { Plus, Smartphone, Loader2, CheckCircle2, XCircle, X, QrCode, Trash2 } from 'lucide-react';
import api from '../api/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

interface Instance {
  id: string;
  name: string;
  displayName?: string;
  status: string;
  busy?: boolean;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchInstances();
  }, []);

  async function fetchInstances() {
    try {
      setLoading(true);
      const response = await api.get('/instances');
      setInstances(response.data);
    } catch {
      toast.error('Erro ao buscar instancias');
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
      toast.success('Instancia criada com sucesso');
    } catch {
      toast.error('Erro ao criar instancia');
    } finally {
      setIsCreating(false);
    }
  }

  function promptDeleteInstance(id: string) {
    setPendingDeleteId(id);
    setIsDeleteModalOpen(true);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
    setIsDeleteModalOpen(false);
  }

  async function confirmDeleteInstance() {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/instances/${pendingDeleteId}`);
      setInstances(prev => prev.filter(i => i.id !== pendingDeleteId));
      toast.success("Instancia removida com sucesso");
    } catch {
      toast.error("Erro ao remover instancia");
    } finally {
      setIsDeleting(false);
      setPendingDeleteId(null);
      setIsDeleteModalOpen(false);
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
    } catch {
      toast.error('Erro ao gerar QR Code. Tente novamente.');
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
      toast.success('Sincronizacao concluida com sucesso');
    } catch {
      setIsQrModalOpen(false);
      fetchInstances();
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold">Minhas Instancias</h1>
          <p className="text-slate-400 text-sm">Ola, {user?.name}. Gerencie suas conexoes.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-indigo-600/20">
          <Plus className="w-5 h-5" /> Nova Instancia
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : instances.length === 0 ? (
        <div className="text-center py-20">
          <Smartphone className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma instancia</h3>
          <p className="text-slate-500 mb-6">Conecte seu primeiro numero do WhatsApp.</p>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold">
            <Plus className="w-5 h-5 inline mr-2" /> Criar Instancia
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance) => (
            <div key={instance.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group relative flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                  <Smartphone className="w-6 h-6 text-indigo-400" />
                </div>
                <span className={`text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-bold ${instance.status === 'CONNECTED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {instance.status === 'CONNECTED' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {instance.status}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold truncate">{instance.displayName || instance.name}</h3>
                {instance.busy && <p className="text-xs text-yellow-400 mb-1">Enviando...</p>}
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
                  onClick={() => promptDeleteInstance(instance.id)}
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

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full">
            <h2 className="text-xl font-bold mb-6">Nova Instancia</h2>
            <form onSubmit={handleCreateInstance}>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nome da instancia</label>
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

      {/* QR Modal */}
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
            <p className="text-slate-400 text-sm mb-8">Abra o WhatsApp e aponte a camera para a tela.</p>
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
              {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ja escaneei'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Confirmar Exclusao</h2>
            <p className="text-slate-400 mb-6">Tem certeza que deseja excluir esta instancia? Isso removera a conexao no WhatsApp tambem.</p>
            <div className="flex gap-3">
              <button type="button" onClick={cancelDelete} className="flex-1 py-3 text-slate-400">Cancelar</button>
              <button onClick={confirmDeleteInstance} disabled={isDeleting} className="flex-1 bg-red-600 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
