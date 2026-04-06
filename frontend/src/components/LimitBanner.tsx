import { useEffect, useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import api from '../api/api';

interface Limits {
  maxDailyShots: number;
  dailyShotsSent: number;
  totalShotsSent: number;
  dailyLimitReached: boolean;
  permissions: Record<string, boolean>;
  isSuspended: boolean;
}

export function LimitBanner() {
  const [limits, setLimits] = useState<Limits | null>(null);

  useEffect(() => {
    api.get('/auth/me/limits').then(res => setLimits(res.data)).catch(() => {});
  }, []);

  if (!limits) return null;

  if (limits.isSuspended) {
    return (
      <div className="bg-red-600/10 border border-red-600/30 text-red-400 p-4 rounded-2xl mb-6 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-bold text-sm">Conta Suspensa</p>
          <p className="text-xs text-red-400/70">Sua conta foi suspensa pelo administrador. Voce nao pode realizar disparos.</p>
        </div>
      </div>
    );
  }

  if (limits.dailyLimitReached) {
    return (
      <div className="bg-amber-600/10 border border-amber-600/30 text-amber-400 p-4 rounded-2xl mb-6 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-sm">Limite diario atingido</p>
          <p className="text-xs text-amber-400/70">
            Voce atingiu o limite de {limits.maxDailyShots} disparos hoje ({limits.dailyShotsSent}/{limits.maxDailyShots}).
            Novos disparos serao liberados amanha.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-600/20 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
          <Send className="w-3.5 h-3.5" />
          {limits.dailyShotsSent}/{limits.maxDailyShots}
        </div>
      </div>
    );
  }

  // Show a subtle counter when above 70%
  const percent = limits.maxDailyShots > 0 ? (limits.dailyShotsSent / limits.maxDailyShots) * 100 : 0;
  if (percent >= 70) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-400 p-3 rounded-2xl mb-6 flex items-center gap-3">
        <Send className="w-4 h-4 shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs">Disparos hoje</span>
            <span className={`text-xs font-bold ${percent >= 90 ? 'text-red-400' : 'text-amber-400'}`}>
              {limits.dailyShotsSent}/{limits.maxDailyShots}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${percent >= 90 ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
