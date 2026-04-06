import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Users, Loader2, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Papa from 'papaparse';
import { LimitBanner } from '../components/LimitBanner';

export function SendMessagesPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [csvLeads, setCsvLeads] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [delayMin, setDelayMin] = useState(20);
  const [delayMax, setDelayMax] = useState(40);
  const selectedBusy = instances.find((i) => i.id === selectedInstance)?.busy;

  useEffect(() => {
    api.get('/instances').then(res => {
      setInstances(res.data);
      if (res.data.length > 0) setSelectedInstance(res.data[0].id);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setAvailableVariables(fields);
        setCsvLeads(results.data);

        // Try to find phone column by name, then fallback to first column with numeric values
        let phoneKey = fields.find(f => {
          const lower = f.toLowerCase();
          return ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(k => lower.includes(k));
        });

        // Fallback: first column where the first row value has 10+ digits
        if (!phoneKey && fields.length > 0) {
          phoneKey = fields.find(f => {
            const val = String((results.data as any[])[0]?.[f] || '');
            return val.replace(/\D/g, '').length >= 10;
          });
        }

        // Last fallback: just use first column
        if (!phoneKey) phoneKey = fields[0];

        if (phoneKey) {
          const phones = (results.data as any[]).map((row: any) => row[phoneKey!]).filter(Boolean).join('\n');
          setNumbers(phones);
        }
        toast.success(`${results.data.length} contatos carregados!`);
      },
      error: (error) => {
        toast.error('Erro ao ler CSV: ' + error.message);
      }
    });
  };

  const insertVariable = (variable: string) => {
    setMessage(prev => prev + `{${variable}}`);
  };

  async function startBulkSend() {
    // Always use the numbers textarea as source (user may have edited after CSV import)
    const phoneList = numbers.split('\n').map(n => n.trim()).filter(n => n.replace(/\D/g, '').length >= 10);
    if (phoneList.length === 0) {
      toast.error('Insira ao menos um numero valido.');
      return;
    }

    // If CSV was loaded, match phones back to their row data for variable substitution
    let leads: any[];
    if (csvLeads.length > 0) {
      const keys = Object.keys(csvLeads[0]);
      let phoneKey = keys.find(k => {
        const lower = k.toLowerCase();
        return ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(term => lower.includes(term));
      });
      if (!phoneKey) {
        phoneKey = keys.find(k => String(csvLeads[0][k] || '').replace(/\D/g, '').length >= 10);
      }
      if (!phoneKey) phoneKey = keys[0];
      const csvMap = new Map<string, any>();
      if (phoneKey) {
        csvLeads.forEach((row: any) => {
          csvMap.set(row[phoneKey]?.replace(/\D/g, ''), row);
        });
      }
      leads = phoneList.map(phone => {
        const cleanPhone = phone.replace(/\D/g, '');
        const row = csvMap.get(cleanPhone);
        return row ? { ...row, phone: cleanPhone } : { phone: cleanPhone };
      });
    } else {
      leads = phoneList.map(phone => ({ phone: phone.replace(/\D/g, '') }));
    }

    if (leads.length === 0) {
      toast.error('Nenhum contato valido encontrado.');
      return;
    }
    if (!message) {
      toast.error('A mensagem nao pode estar vazia.');
      return;
    }
    if (!selectedInstance) {
      toast.error('Selecione uma instancia.');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.post('/messages/bulk', {
        instanceId: selectedInstance,
        message,
        leads,
        delayMin,
        delayMax
      });

      toast.success('Disparo iniciado! Acompanhe o progresso.');
      // Redirect to campaign detail for live tracking
      if (res.data.campaignId) {
        navigate(`/campaigns/${res.data.campaignId}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao conectar com o servidor.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <LimitBanner />
      <div className="mb-10">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Send className="text-indigo-500" /> Disparo Rapido
        </h1>
        <p className="text-slate-400 text-sm">Disparo imediato sem salvar campanha. Para rastreamento completo, use <a href="/campaigns" className="text-indigo-400 hover:underline">Campanhas</a>.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-4 shadow-xl">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Sua Mensagem
              </label>
              <div className="flex gap-2 flex-wrap">
                {availableVariables.map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="bg-slate-800 hover:bg-indigo-600 px-3 py-1 rounded-lg text-xs border border-slate-700 transition-all"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              disabled={isSending}
              className="w-full h-64 bg-slate-800 border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-50"
              placeholder="Ola {nome}! Tudo bem?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl h-fit">
          {/* Upload CSV */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Carregar Lista (CSV)</label>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" /> Selecionar Arquivo
            </button>
          </div>

          {/* Instance selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Selecione a Instancia</label>
            <select
              disabled={isSending}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
            >
              {instances.map(i => (
                <option key={i.id} value={i.id}>
                  {i.displayName || i.name}{i.status !== 'CONNECTED' ? ' (desconectada)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Numbers textarea — always visible, populated by CSV or manual input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Users className="w-4 h-4 text-indigo-400" /> Contatos (um por linha)
            </label>
            <textarea
              disabled={isSending}
              className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
              placeholder="5511999999999"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
            />
            {csvLeads.length > 0 && (
              <p className="text-xs text-green-400 mt-1">
                {csvLeads.length} contatos carregados do CSV — edite acima se necessario
              </p>
            )}
          </div>

          {/* Delay config */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" /> Delay entre mensagens (s)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number" min={10} max={120}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white outline-none text-sm"
                value={delayMin}
                onChange={e => setDelayMin(Number(e.target.value))}
                placeholder="Min"
              />
              <span className="text-slate-500 text-sm">-</span>
              <input
                type="number" min={10} max={120}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white outline-none text-sm"
                value={delayMax}
                onChange={e => setDelayMax(Number(e.target.value))}
                placeholder="Max"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Aleatorio entre {delayMin}s e {delayMax}s</p>
          </div>

          <button
            onClick={startBulkSend}
            disabled={isSending || instances.length === 0 || !!selectedBusy}
            className={`w-full py-5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${isSending ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'}`}
          >
            {isSending ? <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando...</> : <><Send className="w-5 h-5" /> Iniciar Disparo</>}
          </button>
        </div>
      </div>
    </>
  );
}
