import { useState, useEffect, useRef } from 'react';
import {
  Send, MessageSquare, Users, Loader2, Upload, AlertCircle,
  Mic, Square, Trash2, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Papa from 'papaparse';
import { LimitBanner } from '../components/LimitBanner';

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

export function SendMessagesPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [csvLeads, setCsvLeads] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [delayMin, setDelayMin] = useState(20);
  const [delayMax, setDelayMax] = useState(40);

  const [mediaType, setMediaType] = useState('text');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const selectedBusy = instances.find((i) => i.id === selectedInstance)?.busy;

  useEffect(() => {
    api.get('/instances').then(res => {
      setInstances(res.data);
      if (res.data.length > 0) setSelectedInstance(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setAvailableVariables(fields);
        setCsvLeads(results.data);

        let phoneKey = fields.find(f =>
          ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(k => f.toLowerCase().includes(k))
        );
        if (!phoneKey && fields.length > 0) {
          phoneKey = fields.find(f => String((results.data as any[])[0]?.[f] || '').replace(/\D/g, '').length >= 10);
        }
        if (!phoneKey) phoneKey = fields[0];

        if (phoneKey) {
          setNumbers((results.data as any[]).map((row: any) => row[phoneKey!]).filter(Boolean).join('\n'));
        }
        toast.success(`${results.data.length} contatos carregados!`);
      },
      error: (error) => {
        toast.error('Erro ao ler CSV: ' + error.message);
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

  function discardMedia() {
    setMediaFile(null);
    discardAudio();
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function startBulkSend() {
    const phoneList = numbers.split('\n').map(n => n.trim()).filter(n => n.replace(/\D/g, '').length >= 10);
    if (phoneList.length === 0) {
      toast.error('Insira ao menos um numero valido.');
      return;
    }
    if (!message && mediaType === 'text') {
      toast.error('A mensagem nao pode estar vazia.');
      return;
    }
    if (!selectedInstance) {
      toast.error('Selecione uma instancia.');
      return;
    }

    let leads: any[];
    if (csvLeads.length > 0) {
      const keys = Object.keys(csvLeads[0]);
      let phoneKey = keys.find(k =>
        ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(term => k.toLowerCase().includes(term))
      );
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

    setIsSending(true);
    try {
      const fd = new FormData();
      fd.append('instanceId', selectedInstance);
      fd.append('message', message);
      fd.append('mediaType', mediaType);
      fd.append('leads', JSON.stringify(leads));
      fd.append('delayMin', String(delayMin));
      fd.append('delayMax', String(delayMax));

      const fileToUpload = audioBlob
        ? new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
        : mediaFile;
      if (fileToUpload) fd.append('media', fileToUpload);

      const res = await api.post('/messages/bulk', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Disparo iniciado! Acompanhe o progresso.');
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
        <p className="text-slate-400 text-sm">Disparo imediato com rastreamento automatico.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Message */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-4 shadow-xl">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Sua Mensagem
              </label>
              <div className="flex gap-2 flex-wrap">
                {availableVariables.map(v => (
                  <button
                    key={v}
                    onClick={() => setMessage(prev => prev + `{${v}}`)}
                    className="bg-slate-800 hover:bg-indigo-600 px-3 py-1 rounded-lg text-xs border border-slate-700 transition-all"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              disabled={isSending}
              className="w-full h-48 bg-slate-800 border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-50"
              placeholder="Ola {nome}! Tudo bem?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Media Type */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-4 shadow-xl">
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Midia</label>
            <div className="flex gap-2 flex-wrap">
              {MEDIA_TYPES.map(mt => (
                <button
                  key={mt.value}
                  type="button"
                  onClick={() => {
                    setMediaType(mt.value);
                    discardMedia();
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    mediaType === mt.value ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {mt.label}
                </button>
              ))}
            </div>

            {mediaType !== 'text' && (
              <div className="pt-2">
                {mediaType === 'audio' ? (
                  <div className="space-y-3">
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
                    {audioUrl && (
                      <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                        <audio src={audioUrl} controls className="flex-1 h-10" />
                        <button type="button" onClick={discardAudio} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
                    <input
                      type="file"
                      ref={mediaInputRef}
                      onChange={handleMediaSelect}
                      accept={MEDIA_ACCEPT[mediaType] || '*'}
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl h-fit">
          {/* CSV upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Carregar Lista (CSV)</label>
            <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" /> Selecionar Arquivo
            </button>
          </div>

          {/* Instance */}
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

          {/* Numbers */}
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

          {/* Delay */}
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
              />
              <span className="text-slate-500 text-sm">-</span>
              <input
                type="number" min={10} max={120}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white outline-none text-sm"
                value={delayMax}
                onChange={e => setDelayMax(Number(e.target.value))}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Aleatorio entre {delayMin}s e {delayMax}s</p>
          </div>

          <button
            onClick={startBulkSend}
            disabled={isSending || instances.length === 0 || !!selectedBusy}
            className={`w-full py-5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
              isSending ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
            }`}
          >
            {isSending ? <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando...</> : <><Send className="w-5 h-5" /> Iniciar Disparo</>}
          </button>
        </div>
      </div>
    </>
  );
}
