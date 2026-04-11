import React from 'react';
import { Terminal, LogIn, UserCircle2, Target, FileEdit, BarChart3, Settings, LogOut, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  showNav?: boolean;
  userRole?: 'ADMIN' | 'USER' | null;
  onLogout?: () => void;
}

export default function Layout({ children, title, activeTab, onTabChange, showNav = true, userRole, onLogout }: LayoutProps) {
  const allTabs = [
    { id: 'LOGIN', label: 'LOGIN', icon: LogIn, roles: [] },
    { id: 'ROLE', label: 'ROLE', icon: UserCircle2, roles: ['USER'] },
    { id: 'TARGET', label: 'TARGET', icon: Target, roles: ['USER'] },
    { id: 'CLERK', label: 'CLERK', icon: FileEdit, roles: ['USER'] },
    { id: 'RESULT', label: 'RESULT', icon: BarChart3, roles: ['ADMIN', 'USER'] },
    { id: 'MANAGE', label: 'MANAGE', icon: Settings, roles: ['ADMIN'] },
    { id: 'CALIBRATION', label: 'CALIB', icon: Settings2, roles: ['USER'] },
  ];

  const visibleTabs = allTabs.filter(tab => 
    tab.roles.length === 0 || (userRole && tab.roles.includes(userRole))
  ).filter(tab => tab.id !== 'LOGIN');

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9f9] text-[#1a1c1c] font-sans">
      {/* Header */}
      <header className="bg-tactical-green flex justify-between items-center px-4 py-3 w-full sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <Terminal className="text-tactical-accent w-5 h-5" />
          <h1 className="font-headline uppercase tracking-wider font-bold text-lg text-tactical-accent">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {showNav && (
            <button 
              onClick={onLogout}
              className="flex items-center gap-1 bg-tactical-danger/20 hover:bg-tactical-danger/40 text-tactical-accent px-2 py-1 rounded text-[10px] font-black transition-colors border border-tactical-danger/30"
            >
              <LogOut className="w-3 h-3" />
              ĐĂNG XUẤT
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-tactical-green-light overflow-hidden border border-tactical-accent/30">
            <img 
              alt="Profile" 
              className="w-full h-full object-cover" 
              src="https://picsum.photos/seed/soldier/100/100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col relative pb-32">
        <div className="absolute inset-0 military-grid pointer-events-none"></div>
        {children}
      </main>

      {/* Bottom Navigation */}
      {showNav && (
        <nav className="fixed bottom-10 left-0 w-full h-20 bg-[#f3f3f3] flex justify-around items-center px-4 shadow-[0_-4px_40px_rgba(0,0,0,0.05)] z-50">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center p-3 transition-all duration-300",
                activeTab === tab.id 
                  ? "bg-tactical-green-light text-tactical-accent rounded-md scale-110 shadow-md" 
                  : "text-tactical-green-light hover:bg-tactical-green/10"
              )}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase mt-1">{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
      
      {/* Tactical Status Bar */}
      <div className="fixed bottom-0 w-full bg-[#e8e8e8] h-10 border-t border-black/5 flex items-center px-4 justify-between z-[60]">
        <div className="flex gap-4 items-center">
          <span className="text-[8px] font-black tracking-widest text-gray-500">AUTH: READY</span>
          <div className="w-[1px] h-3 bg-black/10"></div>
          <span className="text-[8px] font-black tracking-widest text-gray-500">SEC: L4</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black tracking-widest text-tactical-green bg-tactical-accent px-1.5 py-0.5 rounded-sm">ENCRYPTED</span>
          <span className="text-[8px] font-bold text-gray-500">22:15 ZULU</span>
        </div>
      </div>
    </div>
  );
}
