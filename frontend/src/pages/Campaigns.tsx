import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Megaphone, Plus, Loader2, Play, Pause, X, Upload,
  CheckCircle2, XCircle, Clock, AlertCircle, Mic, Square, Trash2, Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/api';
import Papa from 'papaparse';

interface Campaign {
  id: string;
  name: string;
  message: string;
  mediaType: string;
  status: string;
  totalLeads: number;
  sentCount: number;
  errorCount: number;
  delayMin: number;
  delayMax: number;
  createdAt: string;
  instance?: { displayName?: string; name: string; status: string };
}

interface Instance {
  id: string;
  name: string;
  displayName?: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  IDLE: { label: 'Aguardando', color: 'bg-slate-500/10 text-slate-400', icon: Clock },
  SENDING: { label: 'Enviando', color: 'bg-blue-500/10 text-blue-400', icon: Play },
  PAUSED: { label: 'Pausada', color: 'bg-yellow-500/10 text-yellow-400', icon: Pause },
  COMPLETED: { label: 'Concluida', color: 'bg-green-500/10 text-green-400', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-500/10 text-red-400', icon: XCircle },
};

const MEDIA_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documento' },
];

const MEDIA_ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar',
};

export function CampaignsPage() {
  const navigate = useNavigate();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '',
    instanceId: '',
    message: '',
    mediaType: 'text',
    mediaUrl: '',
    delayMin: 20,
    delayMax: 40,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLeads, setCsvLeads] = useState<any[]>([]);
  const [numbers, setNumbers] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Audio recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const res = await api.get('/campaigns');
      setCampaigns(res.data);
    } catch {
      toast.error('Erro ao buscar campanhas');
    } finally {
      setLoading(false);
    }
  }

  async function openNewCampaign() {
    try {
      const res = await api.get('/instances');
      setInstances(res.data);
      if (res.data.length > 0) setForm(f => ({ ...f, instanceId: res.data[0].id }));
      setIsModalOpen(true);
    } catch {
      toast.error('Erro ao carregar instancias');
    }
  }

  function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setAvailableVariables(fields);
        setCsvLeads(results.data as any[]);

        // Smart phone column detection
        let phoneKey = fields.find(f => {
          const lower = f.toLowerCase();
          return ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(k => lower.includes(k));
        });
        if (!phoneKey && fields.length > 0) {
          phoneKey = fields.find(f => {
            const val = String((results.data as any[])[0]?.[f] || '');
            return val.replace(/\D/g, '').length >= 10;
          });
        }
        if (!phoneKey) phoneKey = fields[0];

        if (phoneKey) {
          const phones = (results.data as any[]).map((row: any) => row[phoneKey!]).filter(Boolean).join('\n');
          setNumbers(phones);
        }
        toast.success(`${results.data.length} contatos encontrados`);
      }
    });
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setAudioBlob(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    toast.success(`Arquivo selecionado: ${file.name}`);
  }

  function insertVariable(variable: string) {
    setForm(f => ({ ...f, message: f.message + `{${variable}}` }));
  }

  // Audio recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        setMediaFile(null);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error('Erro ao acessar microfone. Verifique as permissoes do navegador.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function discardAudio() {
    setAudioBlob(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.instanceId || !form.message) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    // Build leads from textarea (user may have edited)
    const phoneList = numbers.split('\n').map(n => n.trim()).filter(n => n.replace(/\D/g, '').length >= 10);
    if (phoneList.length === 0 && !csvFile) {
      toast.error('Adicione contatos via CSV ou manualmente');
      return;
    }

    setIsCreating(true);
    try {
      // Upload media file or audio blob first if present
      let mediaUrl = form.mediaUrl;
      const fileToUpload = audioBlob
        ? new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
        : mediaFile;

      if (fileToUpload && !mediaUrl) {
        const uploadForm = new FormData();
        uploadForm.append('file', fileToUpload);
        const uploadRes = await api.post('/upload/media', uploadForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = uploadRes.data.url;
      }

      // Build leads JSON from textarea + CSV data
      let leads: any[] = [];
      if (csvLeads.length > 0) {
        const keys = Object.keys(csvLeads[0]);
        let phoneKey = keys.find(k => ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(term => k.toLowerCase().includes(term)));
        if (!phoneKey) phoneKey = keys.find(k => String(csvLeads[0][k] || '').replace(/\D/g, '').length >= 10);
        if (!phoneKey) phoneKey = keys[0];
        const csvMap = new Map<string, any>();
        if (phoneKey) csvLeads.forEach((row: any) => csvMap.set(String(row[phoneKey!] || '').replace(/\D/g, ''), row));
        leads = phoneList.map(phone => {
          const clean = phone.replace(/\D/g, '');
          const row = csvMap.get(clean);
          return row ? { ...row, phone: clean } : { phone: clean };
        });
      } else {
        leads = phoneList.map(phone => ({ phone: phone.replace(/\D/g, '') }));
      }

      // Send as JSON (not FormData with CSV) since we already parsed leads
      const res = await api.post('/campaigns', (() => {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('instanceId', form.instanceId);
        fd.append('message', form.message);
        fd.append('mediaType', form.mediaType);
        if (mediaUrl) fd.append('mediaUrl', mediaUrl);
        fd.append('delayMin', String(form.delayMin));
        fd.append('delayMax', String(form.delayMax));
        fd.append('leads', JSON.stringify(leads));
        return fd;
      })(), { headers: { 'Content-Type': 'multipart/form-data' } });

      toast.success('Campanha criada com sucesso!');
      setIsModalOpen(false);
      resetForm();
      navigate(`/campaigns/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar campanha');
    } finally {
      setIsCreating(false);
    }
  }

  function resetForm() {
    setForm({ name: '', instanceId: '', message: '', mediaType: 'text', mediaUrl: '', delayMin: 20, delayMax: 40 });
    setCsvFile(null);
    setCsvLeads([]);
    setNumbers('');
    setAvailableVariables([]);
    setMediaFile(null);
    discardAudio();
  }

  return (
    <>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="text-indigo-500" /> Campanhas
          </h1>
          <p className="text-slate-400 text-sm">Gerencie seus disparos com rastreamento completo.</p>
        </div>
        <button
          onClick={openNewCampaign}
          className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" /> Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma campanha ainda</h3>
          <p className="text-slate-500 mb-6">Crie sua primeira campanha para comecar os disparos.</p>
          <button onClick={openNewCampaign} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold">
            <Plus className="w-5 h-5 inline mr-2" /> Criar Campanha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(campaign => {
            const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.IDLE;
            const StatusIcon = statusCfg.icon;
            const progress = campaign.totalLeads > 0
              ? Math.round(((campaign.sentCount + campaign.errorCount) / campaign.totalLeads) * 100)
              : 0;

            return (
              <Link
                key={campaign.id}
                to={`/campaigns/${campaign.id}`}
                className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-indigo-600/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold truncate flex-1 mr-3">{campaign.name}</h3>
                  <span className={`text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-bold whitespace-nowrap ${statusCfg.color}`}>
                    <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4 truncate">
                  {campaign.instance?.displayName || campaign.instance?.name || 'Sem instancia'}
                </p>
                <div className="w-full bg-slate-800 rounded-full h-2 mb-3">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="text-green-400">{campaign.sentCount} enviados</span>
                  {campaign.errorCount > 0 && <span className="text-red-400">{campaign.errorCount} erros</span>}
                  <span>{campaign.totalLeads} total</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-2xl w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Nova Campanha</h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome da Campanha</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Promocao Black Friday"
                />
              </div>

              {/* Instance */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Instancia</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.instanceId}
                  onChange={e => setForm(f => ({ ...f, instanceId: e.target.value }))}
                >
                  {instances.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.displayName || i.name} {i.status !== 'CONNECTED' ? '(desconectada)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Media Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Midia</label>
                <div className="flex gap-2 flex-wrap">
                  {MEDIA_TYPES.map(mt => (
                    <button
                      key={mt.value}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, mediaType: mt.value, mediaUrl: '' }));
                        setMediaFile(null);
                        discardAudio();
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        form.mediaType === mt.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Upload (if not text) */}
              {form.mediaType !== 'text' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {form.mediaType === 'audio' ? 'Audio' : 'Arquivo de Midia'}
                  </label>

                  {form.mediaType === 'audio' ? (
                    <div className="space-y-3">
                      {/* Audio recorder */}
                      {!audioBlob && !mediaFile && (
                        <div className="flex gap-2">
                          {!isRecording ? (
                            <button
                              type="button"
                              onClick={startRecording}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 py-3 rounded-xl transition-all"
                            >
                              <Mic className="w-4 h-4" /> Gravar Audio
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition-all animate-pulse"
                            >
                              <Square className="w-4 h-4" /> Parar ({formatTime(recordingTime)})
                            </button>
                          )}
                          {!isRecording && (
                            <>
                              <input type="file" ref={mediaInputRef} onChange={handleMediaSelect} accept="audio/*" className="hidden" />
                              <button
                                type="button"
                                onClick={() => mediaInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
                              >
                                <Upload className="w-4 h-4" /> Enviar Arquivo
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Audio preview */}
                      {audioUrl && (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <audio src={audioUrl} controls className="flex-1 h-10" />
                          <button type="button" onClick={discardAudio} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Uploaded audio file preview */}
                      {mediaFile && !audioBlob && (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <span className="text-sm text-slate-300 flex-1 truncate">{mediaFile.name}</span>
                          <button type="button" onClick={() => setMediaFile(null)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* File upload for image/video/document */}
                      <input
                        type="file"
                        ref={mediaInputRef}
                        onChange={handleMediaSelect}
                        accept={MEDIA_ACCEPT[form.mediaType] || '*'}
                        className="hidden"
                      />
                      {!mediaFile ? (
                        <button
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
                        >
                          <Upload className="w-4 h-4" /> Selecionar Arquivo
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="text-sm text-slate-300 flex-1 truncate">{mediaFile.name}</span>
                          <button type="button" onClick={() => setMediaFile(null)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Optional: still allow URL as fallback */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                        <div className="relative flex justify-center"><span className="bg-slate-900 px-3 text-xs text-slate-500">ou cole uma URL</span></div>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        value={form.mediaUrl}
                        onChange={e => { setForm(f => ({ ...f, mediaUrl: e.target.value })); if (e.target.value) setMediaFile(null); }}
                        placeholder="https://exemplo.com/arquivo.jpg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CSV Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lista de Contatos (CSV)</label>
                <input type="file" ref={csvInputRef} onChange={handleCsvSelect} accept=".csv" className="hidden" />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
                >
                  <Upload className="w-4 h-4" /> {csvFile ? csvFile.name : 'Selecionar CSV'}
                </button>
              </div>

              {/* Numbers textarea — always visible */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Users className="w-4 h-4 text-indigo-400" /> Contatos (um por linha)
                </label>
                <textarea
                  className="w-full h-28 bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="5511999999999"
                  value={numbers}
                  onChange={e => setNumbers(e.target.value)}
                />
                {csvLeads.length > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    {csvLeads.length} contatos carregados do CSV — edite acima se necessario
                  </p>
                )}
              </div>

              {/* Message template */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300">Mensagem</label>
                  {availableVariables.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {availableVariables.map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => insertVariable(f)}
                          className="bg-slate-800 hover:bg-indigo-600 px-2 py-1 rounded-lg text-[10px] border border-slate-700 transition-all"
                        >
                          {`{${f}}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <textarea
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Ola {nome}! Tudo bem?"
                />
              </div>

              {/* Delay config */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Delay Min (s)</label>
                  <input
                    type="number" min={10} max={120}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.delayMin}
                    onChange={e => setForm(f => ({ ...f, delayMin: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Delay Max (s)</label>
                  <input
                    type="number" min={10} max={120}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.delayMax}
                    onChange={e => setForm(f => ({ ...f, delayMax: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Delay aleatorio entre {form.delayMin}s e {form.delayMax}s entre cada mensagem
              </p>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="flex-1 py-3 text-slate-400">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
