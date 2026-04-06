import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, XCircle, Loader2, CheckCircle2,
  Clock, AlertTriangle, Users, Megaphone, RefreshCw, Trash2, RotateCcw,
  Pencil, X, Upload, Mic, Square, UserPlus
} from 'lucide-react';
import Papa from 'papaparse';
import { LimitBanner } from '../components/LimitBanner';
import { toast } from 'react-toastify';
import api from '../api/api';

interface Campaign {
  id: string;
  name: string;
  message: string;
  mediaType: string;
  mediaUrl?: string | null;
  status: string;
  totalLeads: number;
  sentCount: number;
  errorCount: number;
  delayMin: number;
  delayMax: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  instance?: { displayName?: string; name: string; status: string };
}

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

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  errorMsg: string | null;
  sentAt: string | null;
}

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'text-slate-400' },
  SENDING: { label: 'Enviando', color: 'text-blue-400' },
  SENT: { label: 'Enviado', color: 'text-green-400' },
  FAILED: { label: 'Falhou', color: 'text-red-400' },
};

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsFilter, setLeadsFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', message: '', mediaType: 'text', mediaUrl: '', delayMin: 20, delayMax: 40 });
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [editAudioBlob, setEditAudioBlob] = useState<Blob | null>(null);
  const [editAudioUrl, setEditAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Add leads modal state
  const [isAddLeadsOpen, setIsAddLeadsOpen] = useState(false);
  const [addLeadsCsv, setAddLeadsCsv] = useState<File | null>(null);
  const [addLeadsCsvData, setAddLeadsCsvData] = useState<any[]>([]);
  const [addLeadsNumbers, setAddLeadsNumbers] = useState('');
  const [addLeadsVars, setAddLeadsVars] = useState<string[]>([]);
  const [isAddingLeads, setIsAddingLeads] = useState(false);
  const addLeadsCsvRef = useRef<HTMLInputElement>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCampaign();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [id]);

  useEffect(() => {
    fetchLeads();
  }, [id, leadsPage, leadsFilter]);

  useEffect(() => {
    if (campaign && campaign.status === 'SENDING') {
      startSSE();
    } else {
      eventSourceRef.current?.close();
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [campaign?.status]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await api.get(`/campaigns/${id}`);
      setCampaign(res.data);
    } catch {
      toast.error('Erro ao buscar campanha');
      navigate('/campaigns');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeads() {
    try {
      const params: Record<string, string> = { page: String(leadsPage), limit: '20' };
      if (leadsFilter) params.status = leadsFilter;
      const res = await api.get(`/campaigns/${id}/leads`, { params });
      setLeads(res.data.leads);
      setLeadsTotal(res.data.pagination.total);
    } catch {
      // Silent fail — campaign fetch will show error
    }
  }

  function startSSE() {
    eventSourceRef.current?.close();
    const token = localStorage.getItem('@DynamicShots:token');
    if (!token || !id) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const es = new EventSource(`${apiBase}/campaigns/${id}/progress?token=${token}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCampaign(prev => prev ? { ...prev, ...data } : prev);

        if (['COMPLETED', 'CANCELLED'].includes(data.status)) {
          es.close();
          fetchLeads();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
    };

    eventSourceRef.current = es;
  }

  async function handleStart() {
    setActionLoading(true);
    try {
      const res = await api.post(`/campaigns/${id}/start`);
      setCampaign(res.data);
      toast.success('Campanha iniciada!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    setActionLoading(true);
    try {
      const res = await api.post(`/campaigns/${id}/pause`);
      setCampaign(res.data);
      fetchLeads();
      toast.success('Campanha pausada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao pausar');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/campaigns/${id}/cancel`);
      setCampaign(res.data);
      fetchLeads();
      toast.success('Campanha cancelada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetry() {
    if (!confirm('Redisparar leads com falha? Eles voltarao para a fila.')) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/campaigns/${id}/retry`);
      setCampaign(res.data);
      fetchLeads();
      toast.success(`${res.data.resetCount} leads resetados, campanha reiniciada!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao redisparar');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResend() {
    if (!confirm('Redisparar TODOS os leads? A campanha sera reiniciada do zero.')) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/campaigns/${id}/resend`);
      setCampaign(res.data);
      fetchLeads();
      toast.success('Campanha reiniciada! Todos os leads serao reenviados.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao redisparar');
    } finally {
      setActionLoading(false);
    }
  }

  function openEdit() {
    if (!campaign) return;
    setEditForm({
      name: campaign.name,
      message: campaign.message,
      mediaType: campaign.mediaType,
      mediaUrl: campaign.mediaUrl || '',
      delayMin: campaign.delayMin,
      delayMax: campaign.delayMax,
    });
    setEditMediaFile(null);
    setEditAudioBlob(null);
    setEditAudioUrl(null);
    setIsEditOpen(true);
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
        setEditAudioBlob(blob);
        if (editAudioUrl) URL.revokeObjectURL(editAudioUrl);
        setEditAudioUrl(URL.createObjectURL(blob));
        setEditMediaFile(null);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error('Erro ao acessar microfone');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name || !editForm.message) {
      toast.error('Preencha nome e mensagem');
      return;
    }
    setIsSaving(true);
    try {
      // Upload media if needed
      let mediaUrl = editForm.mediaUrl;
      const fileToUpload = editAudioBlob
        ? new File([editAudioBlob], 'audio.webm', { type: 'audio/webm' })
        : editMediaFile;

      if (fileToUpload) {
        const uploadForm = new FormData();
        uploadForm.append('file', fileToUpload);
        const uploadRes = await api.post('/upload/media', uploadForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = uploadRes.data.url;
      }

      const fd = new FormData();
      fd.append('name', editForm.name);
      fd.append('message', editForm.message);
      fd.append('mediaType', editForm.mediaType);
      fd.append('mediaUrl', editForm.mediaType === 'text' ? '' : mediaUrl);
      fd.append('delayMin', String(editForm.delayMin));
      fd.append('delayMax', String(editForm.delayMax));

      const res = await api.put(`/campaigns/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCampaign(res.data);
      setIsEditOpen(false);
      toast.success('Campanha atualizada!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddLeadsCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLeadsCsv(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setAddLeadsVars(fields);
        setAddLeadsCsvData(results.data as any[]);
        const phoneKey = fields.find(f =>
          ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(k => f.toLowerCase().includes(k))
        ) || fields.find(f => {
          const val = String((results.data as any[])[0]?.[f] || '');
          return val.replace(/\D/g, '').length >= 10;
        }) || fields[0];
        if (phoneKey) {
          setAddLeadsNumbers((results.data as any[]).map((row: any) => row[phoneKey!]).filter(Boolean).join('\n'));
        }
        toast.success(`${results.data.length} contatos encontrados`);
      }
    });
  }

  async function handleAddLeadsSubmit() {
    const phoneList = addLeadsNumbers.split('\n').map(n => n.trim()).filter(n => n.replace(/\D/g, '').length >= 10);
    if (phoneList.length === 0) {
      toast.error('Adicione pelo menos um contato valido');
      return;
    }
    setIsAddingLeads(true);
    try {
      let leads: any[] = [];
      if (addLeadsCsvData.length > 0) {
        const keys = Object.keys(addLeadsCsvData[0]);
        const phoneKey = keys.find(k => ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'].some(term => k.toLowerCase().includes(term)))
          || keys.find(k => String(addLeadsCsvData[0][k] || '').replace(/\D/g, '').length >= 10)
          || keys[0];
        const csvMap = new Map<string, any>();
        if (phoneKey) addLeadsCsvData.forEach((row: any) => csvMap.set(String(row[phoneKey!] || '').replace(/\D/g, ''), row));
        leads = phoneList.map(phone => {
          const clean = phone.replace(/\D/g, '');
          const row = csvMap.get(clean);
          return row ? { ...row, phone: clean } : { phone: clean };
        });
      } else {
        leads = phoneList.map(phone => ({ phone: phone.replace(/\D/g, '') }));
      }

      const res = await api.post(`/campaigns/${id}/leads`, { leads });
      setCampaign(res.data);
      fetchLeads();
      const msg = res.data.duplicatesSkipped > 0
        ? `${res.data.addedCount} leads adicionados (${res.data.duplicatesSkipped} duplicados ignorados)`
        : `${res.data.addedCount} leads adicionados!`;
      toast.success(msg);
      setIsAddLeadsOpen(false);
      setAddLeadsCsv(null);
      setAddLeadsCsvData([]);
      setAddLeadsNumbers('');
      setAddLeadsVars([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar leads');
    } finally {
      setIsAddingLeads(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir esta campanha permanentemente? Todos os leads serao removidos.')) return;
    setActionLoading(true);
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campanha excluida');
      navigate('/campaigns');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !campaign) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  const progress = campaign.totalLeads > 0
    ? Math.round(((campaign.sentCount + campaign.errorCount) / campaign.totalLeads) * 100)
    : 0;

  const totalPages = Math.ceil(leadsTotal / 20);

  return (
    <>
      <LimitBanner />
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/campaigns')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-slate-400">
            {campaign.instance?.displayName || campaign.instance?.name} &middot; {campaign.mediaType}
          </p>
        </div>
        <div className="flex gap-2">
          {['IDLE', 'PAUSED'].includes(campaign.status) && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> Iniciar
            </button>
          )}
          {campaign.status === 'SENDING' && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="bg-yellow-600 hover:bg-yellow-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Pause className="w-4 h-4" /> Pausar
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(campaign.status) && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          )}
          {['COMPLETED', 'CANCELLED', 'PAUSED'].includes(campaign.status) && campaign.errorCount > 0 && (
            <button
              onClick={handleRetry}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Redisparar Falhas
            </button>
          )}
          {['COMPLETED', 'CANCELLED', 'PAUSED'].includes(campaign.status) && (
            <button
              onClick={handleResend}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Refazer Campanha
            </button>
          )}
          {campaign.status !== 'SENDING' && (
            <button
              onClick={() => setIsAddLeadsOpen(true)}
              disabled={actionLoading}
              className="bg-slate-800 hover:bg-green-600/30 text-slate-400 hover:text-green-400 px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
              title="Adicionar leads"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          {campaign.status !== 'SENDING' && (
            <button
              onClick={openEdit}
              disabled={actionLoading}
              className="bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-400 px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
              title="Editar campanha"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {campaign.status !== 'SENDING' && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-400 px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
              title="Excluir campanha"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Users className="w-4 h-4" /> Total
          </div>
          <p className="text-2xl font-bold">{campaign.totalLeads}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
            <CheckCircle2 className="w-4 h-4" /> Enviados
          </div>
          <p className="text-2xl font-bold text-green-400">{campaign.sentCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
            <AlertTriangle className="w-4 h-4" /> Erros
          </div>
          <p className="text-2xl font-bold text-red-400">{campaign.errorCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
            <Clock className="w-4 h-4" /> Pendentes
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {campaign.totalLeads - campaign.sentCount - campaign.errorCount}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">Progresso</span>
          <span className="text-sm text-slate-400">{progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              campaign.status === 'SENDING' ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {campaign.status === 'SENDING' && (
          <p className="text-xs text-slate-500 mt-2">
            Delay aleatorio: {campaign.delayMin}s - {campaign.delayMax}s entre mensagens
          </p>
        )}
      </div>

      {/* Message preview */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> Mensagem
        </h3>
        <p className="text-sm text-white whitespace-pre-wrap bg-slate-800 p-4 rounded-xl">{campaign.message}</p>
      </div>

      {/* Leads table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="font-bold">Leads ({leadsTotal})</h3>
          <div className="flex gap-2">
            {['', 'PENDING', 'SENT', 'FAILED'].map(filter => (
              <button
                key={filter}
                onClick={() => { setLeadsFilter(filter); setLeadsPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  leadsFilter === filter
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {filter || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left p-4">Telefone</th>
              <th className="text-left p-4">Nome</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Erro</th>
              <th className="text-left p-4">Enviado em</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => {
              const cfg = LEAD_STATUS_CONFIG[lead.status] || LEAD_STATUS_CONFIG.PENDING;
              return (
                <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 text-sm font-mono">{lead.phone}</td>
                  <td className="p-4 text-sm text-slate-400">{lead.name || '-'}</td>
                  <td className={`p-4 text-sm font-medium ${cfg.color}`}>{cfg.label}</td>
                  <td className="p-4 text-xs text-red-400 max-w-[200px] truncate">{lead.errorMsg || '-'}</td>
                  <td className="p-4 text-xs text-slate-500">
                    {lead.sentAt ? new Date(lead.sentAt).toLocaleString('pt-BR') : '-'}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum lead encontrado</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-800">
            <button
              onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
              disabled={leadsPage === 1}
              className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-400">
              {leadsPage} de {totalPages}
            </span>
            <button
              onClick={() => setLeadsPage(p => Math.min(totalPages, p + 1))}
              disabled={leadsPage === totalPages}
              className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm disabled:opacity-50"
            >
              Proximo
            </button>
          </div>
        )}
      </div>

      {/* Add Leads Modal */}
      {isAddLeadsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-xl w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Adicionar Leads</h2>
              <button onClick={() => { setIsAddLeadsOpen(false); setAddLeadsCsv(null); setAddLeadsCsvData([]); setAddLeadsNumbers(''); setAddLeadsVars([]); }} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* CSV */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Importar CSV</label>
                <input type="file" ref={addLeadsCsvRef} onChange={handleAddLeadsCsv} accept=".csv" className="hidden" />
                <button
                  type="button"
                  onClick={() => addLeadsCsvRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all"
                >
                  <Upload className="w-4 h-4" /> {addLeadsCsv ? addLeadsCsv.name : 'Selecionar CSV'}
                </button>
                {addLeadsCsvData.length > 0 && (
                  <p className="text-xs text-green-400 mt-1">{addLeadsCsvData.length} contatos carregados</p>
                )}
              </div>

              {/* Numbers */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Contatos (um por linha)</label>
                <textarea
                  className="w-full h-40 bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="5511999999999"
                  value={addLeadsNumbers}
                  onChange={e => setAddLeadsNumbers(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {addLeadsNumbers.split('\n').filter(n => n.trim().replace(/\D/g, '').length >= 10).length} contatos validos
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsAddLeadsOpen(false); setAddLeadsCsv(null); setAddLeadsCsvData([]); setAddLeadsNumbers(''); setAddLeadsVars([]); }} className="flex-1 py-3 text-slate-400">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddLeadsSubmit}
                  disabled={isAddingLeads}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAddingLeads ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Adicionar Leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-2xl w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Editar Campanha</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome da Campanha</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
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
                        setEditForm(f => ({ ...f, mediaType: mt.value, mediaUrl: '' }));
                        setEditMediaFile(null);
                        setEditAudioBlob(null);
                        if (editAudioUrl) { URL.revokeObjectURL(editAudioUrl); setEditAudioUrl(null); }
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        editForm.mediaType === mt.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Upload */}
              {editForm.mediaType !== 'text' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {editForm.mediaType === 'audio' ? 'Audio' : 'Arquivo de Midia'}
                  </label>

                  {editForm.mediaType === 'audio' ? (
                    <div className="space-y-3">
                      {!editAudioBlob && !editMediaFile && (
                        <div className="flex gap-2">
                          {!isRecording ? (
                            <button type="button" onClick={startRecording}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 py-3 rounded-xl transition-all">
                              <Mic className="w-4 h-4" /> Gravar Audio
                            </button>
                          ) : (
                            <button type="button" onClick={stopRecording}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition-all animate-pulse">
                              <Square className="w-4 h-4" /> Parar ({formatTime(recordingTime)})
                            </button>
                          )}
                          {!isRecording && (
                            <>
                              <input type="file" ref={mediaInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) { setEditMediaFile(f); setEditAudioBlob(null); if (editAudioUrl) { URL.revokeObjectURL(editAudioUrl); setEditAudioUrl(null); } } }} accept="audio/*" className="hidden" />
                              <button type="button" onClick={() => mediaInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all">
                                <Upload className="w-4 h-4" /> Enviar Arquivo
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {editAudioUrl && (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <audio src={editAudioUrl} controls className="flex-1 h-10" />
                          <button type="button" onClick={() => { setEditAudioBlob(null); if (editAudioUrl) { URL.revokeObjectURL(editAudioUrl); setEditAudioUrl(null); } }} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {editMediaFile && !editAudioBlob && (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <span className="text-sm text-slate-300 flex-1 truncate">{editMediaFile.name}</span>
                          <button type="button" onClick={() => setEditMediaFile(null)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {!editAudioBlob && !editMediaFile && editForm.mediaUrl && (
                        <p className="text-xs text-slate-500">Midia atual mantida. Grave ou envie para substituir.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input type="file" ref={mediaInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) setEditMediaFile(f); }} accept={MEDIA_ACCEPT[editForm.mediaType] || '*'} className="hidden" />
                      {!editMediaFile ? (
                        <button type="button" onClick={() => mediaInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 rounded-xl transition-all">
                          <Upload className="w-4 h-4" /> {editForm.mediaUrl ? 'Substituir Arquivo' : 'Selecionar Arquivo'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="text-sm text-slate-300 flex-1 truncate">{editMediaFile.name}</span>
                          <button type="button" onClick={() => setEditMediaFile(null)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {!editMediaFile && editForm.mediaUrl && (
                        <p className="text-xs text-slate-500">Midia atual mantida. Selecione para substituir.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
                <textarea
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={editForm.message}
                  onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              {/* Delay */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Delay Min (s)</label>
                  <input type="number" min={10} max={120}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editForm.delayMin}
                    onChange={e => setEditForm(f => ({ ...f, delayMin: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Delay Max (s)</label>
                  <input type="number" min={10} max={120}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editForm.delayMax}
                    onChange={e => setEditForm(f => ({ ...f, delayMax: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="flex-1 py-3 text-slate-400">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
