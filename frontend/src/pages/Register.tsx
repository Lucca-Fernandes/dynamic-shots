import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import api from '../api/api';

export function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ type: '', message: '' });

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      await api.post('/auth/register', formData);
      setStatus({ 
        type: 'success', 
        message: 'Conta criada! Aguarde a aprovação do administrador para fazer login.' 
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.error || 'Erro ao registrar' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-md w-full space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h2>
          <p className="mt-2 text-slate-400">Junte-se ao Dynamic Shots</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleRegister}>
          {status.message && (
            <div className={`p-3 rounded-lg text-sm border ${
              status.type === 'success' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'
            }`}>
              {status.message}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input type="text" required placeholder="Nome Completo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 text-white focus:ring-2 focus:ring-indigo-500"
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input type="email" required placeholder="Seu melhor e-mail"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 text-white focus:ring-2 focus:ring-indigo-500"
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input type="password" required placeholder="Sua senha"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 text-white focus:ring-2 focus:ring-indigo-500"
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <button type="submit" disabled={loading || status.type === 'success'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar'}
          </button>

          <p className="text-center text-slate-400 text-sm">
            Já tem uma conta? <Link to="/login" className="text-indigo-400 hover:underline">Entre aqui</Link>
          </p>
        </form>
      </div>
    </div>
  );
}