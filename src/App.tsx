import { useState, useEffect } from 'react';
import { Sun, LogOut, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { User } from './types';
import { getSessionAsync, logoutAsync, isBackendActive, initBackendMode } from './store';
import { LoginPage } from './components/LoginPage';
import { SellingDashboard } from './components/SellingDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { PlanningDashboard } from './components/PlanningDashboard';
import { TeamLeaderDashboard } from './components/TeamLeaderDashboard';

const roleLabels: Record<string, string> = {
  selling: 'Selling Department',
  superadmin: 'Super Admin',
  planning: 'Planning Team',
  teamleader: 'Team Leader',
};

const roleColors: Record<string, string> = {
  selling: 'from-blue-500 to-blue-600',
  superadmin: 'from-red-500 to-red-600',
  planning: 'from-purple-500 to-purple-600',
  teamleader: 'from-amber-500 to-amber-600',
};

const roleEmojis: Record<string, string> = {
  selling: '🏢',
  superadmin: '👑',
  planning: '📋',
  teamleader: '👷',
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    const init = async () => {
      const backend = await initBackendMode();
      setBackendConnected(backend);
      const session = await getSessionAsync();
      if (session) setUser(session);
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await logoutAsync();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-200 mx-auto animate-pulse">
            <Sun className="w-9 h-9 text-white" />
          </div>
          <p className="text-slate-500 font-medium">Connecting to server...</p>
          <p className="text-xs text-slate-400">Checking PHP/MySQL backend...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 hover:bg-slate-100 rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
                <Sun className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Solar Project Tracker</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500 leading-tight">Management System v2.0</p>
                  {isBackendActive() || backendConnected ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      <Wifi className="w-3 h-3" /> MySQL
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <WifiOff className="w-3 h-3" /> Local
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">{roleEmojis[user.role]} {user.name}</p>
                <p className={`text-xs font-medium bg-gradient-to-r ${roleColors[user.role]} bg-clip-text text-transparent`}>
                  {roleLabels[user.role]}
                </p>
              </div>
              <div className={`w-10 h-10 bg-gradient-to-br ${roleColors[user.role]} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                {user.name.charAt(0)}
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="sm:hidden mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${roleColors[user.role]} text-white rounded-full text-xs font-semibold`}>
            {roleEmojis[user.role]} {roleLabels[user.role]}
          </div>
        </div>

        {user.role === 'selling' && <SellingDashboard user={user} />}
        {user.role === 'superadmin' && <SuperAdminDashboard user={user} />}
        {user.role === 'planning' && <PlanningDashboard user={user} />}
        {user.role === 'teamleader' && <TeamLeaderDashboard user={user} />}
      </main>

      <footer className="border-t border-slate-100 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-400">© 2024 Solar Project Tracking System. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-400">Session: <span className="font-medium text-slate-600">{user.email}</span></p>
            {isBackendActive() ? (
              <span className="text-xs text-green-600 flex items-center gap-1"><Wifi className="w-3 h-3" /> PHP/MySQL Connected</span>
            ) : (
              <span className="text-xs text-amber-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> localStorage Mode</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
