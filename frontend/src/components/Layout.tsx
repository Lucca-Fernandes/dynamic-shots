import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Send, Megaphone, ShieldCheck, LogOut, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Instancias', icon: Smartphone },
  { to: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { to: '/disparos', label: 'Disparo Rapido', icon: Send },
];

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 flex text-white font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 flex flex-col fixed h-full z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Dynamic Shots</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <Link
                to="/z-admin"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  location.pathname === '/z-admin'
                    ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-5 h-5 text-amber-500" /> Aprovacoes
              </Link>
              <Link
                to="/z-admin/users"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  location.pathname === '/z-admin/users'
                    ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 text-amber-500" /> Gestao Usuarios
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-slate-800 pt-4 mt-4">
          <p className="text-xs text-slate-500 mb-3 truncate">{user?.name}</p>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 transition-colors text-sm w-full"
          >
            <LogOut className="w-5 h-5" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-10">
        <Outlet />
      </main>
    </div>
  );
}
