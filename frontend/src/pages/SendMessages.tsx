import { useState, useEffect } from 'react';
import { Send, MessageSquare, Users, LayoutDashboard, Smartphone, ShieldCheck, LogOut, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';

export function SendMessagesPage() {
  const navigate = useNavigate();

  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState('');

  const [isSending, setIsSending] = useState(false);

  // CORREÇÃO: Agora declaramos os setters que estavam faltando
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<Array<{ number: string; status: 'success' | 'error'; message?: string }>>([]);

  const user = JSON.parse(localStorage.getItem('@DynamicShots:user') || '{}');

  useEffect(() => {
    api.get('/instances').then(res => {
      setInstances(res.data);
      if (res.data.length > 0) setSelectedInstance(res.data[0].id);
    });
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  async function startBulkSend() {
    const list = numbers
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 8);

    if (list.length === 0) {
      toast.error('Insira ao menos um número válido.');
      return;
    }
    if (!message) {
      toast.error('A mensagem não pode estar vazia.');
      return;
    }
    if (!selectedInstance) {
      toast.error('Selecione uma instância.');
      return;
    }

    setIsSending(true);
    // Resetar logs e progresso antes de iniciar
    setLogs([]);
    setProgress({ current: 0, total: list.length });

    try {
      await api.post('/messages/bulk', {
        instanceId: selectedInstance,
        message: message,
        numbers: list
      });

      toast.success('O disparo foi iniciado! O servidor processará a fila.');

      setNumbers('');
      setMessage('');

    } catch (err: any) {
      console.error("Erro ao iniciar disparo:", err);
      toast.error(err.response?.data?.error || 'Erro ao conectar com o servidor.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex text-white font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 flex flex-col fixed h-full">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg"><LayoutDashboard className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-xl tracking-tight">Dynamic Shots</span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Smartphone className="w-5 h-5" /> Instâncias
          </Link>
          <Link to="/disparos" className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium">
            <Send className="w-5 h-5" /> Disparos
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/z-admin" className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
              <ShieldCheck className="w-5 h-5 text-amber-500" /> Painel ADM
            </Link>
          )}
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 transition-colors mt-auto">
          <LogOut className="w-5 h-5" /> Sair
        </button>
      </aside>

      <main className="flex-1 ml-64 p-10">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><Send className="text-indigo-500" /> Disparo em Massa</h1>
            <p className="text-slate-400">Intervalo configurado: <span className="text-indigo-400 font-bold">30 segundos</span> (Anti-Ban).</p>
          </div>
          {isSending && progress.total > 0 && (
            <div className="text-right">
              <p className="text-sm font-bold text-indigo-400 animate-pulse">Enviando: {progress.current} / {progress.total}</p>
              <div className="w-48 h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3"><MessageSquare className="w-4 h-4 text-indigo-400" /> Sua Mensagem</label>
                <textarea
                  disabled={isSending}
                  className="w-full h-64 bg-slate-800 border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-50"
                  placeholder="Olá! Esta é uma mensagem personalizada..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                ></textarea>
              </div>
            </div>

            {logs.length > 0 && (
  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-64 overflow-y-auto space-y-2">
    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Relatório de Envio</h3>

    {logs.map((log, idx) => (
      <div 
        key={`${log.number}-${idx}`} 
        className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50"
      >
        <span className="font-mono text-sm truncate max-w-[180px]">
          {log.number}
        </span>
        <div className="flex items-center gap-2">
          {log.status === 'success' ? (
            <span className="text-green-500 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Enviado
            </span>
          ) : (
            <span className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> 
              {log.message || 'Erro'}
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
)}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl h-fit">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Selecione a Instância</label>
              <select
                disabled={isSending}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
              >
                {instances.length > 0 ? (
                  instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)
                ) : (
                  <option>Nenhuma conexão ativa</option>
                )}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3"><Users className="w-4 h-4 text-indigo-400" /> Lista de Contatos</label>
              <textarea
                disabled={isSending}
                className="w-full h-48 bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                placeholder="Ex:&#10;5511999999999&#10;5511888888888"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
              ></textarea>
            </div>

            <button
              onClick={startBulkSend}
              disabled={isSending || instances.length === 0}
              className={`w-full py-5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${isSending
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando Fila...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Iniciar Disparo
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}