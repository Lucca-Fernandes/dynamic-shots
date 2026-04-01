import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, XCircle, Loader2, CheckCircle2,
  Clock, AlertTriangle, Users, Megaphone
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/api';

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
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  instance?: { displayName?: string; name: string; status: string };
}

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
    </>
  );
}
