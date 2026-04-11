import React, { useState } from 'react';
import { ShieldCheck, User, Lock, QrCode, Fingerprint, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginViewProps {
  onLogin: (role: 'ADMIN' | 'USER') => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Map username to a mock email for Firebase Auth
      // In a real app, users would enter their actual email
      const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@tactical.app`;
      await signInWithEmailAndPassword(auth, email, cleanPassword);
      
      // Determine role after successful login
      const role = cleanUsername === 'admin' ? 'ADMIN' : 'USER';
      onLogin(role);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/invalid-email') {
        setError('Tên đăng nhập không hợp lệ (không được chứa khoảng trắng hoặc ký tự đặc biệt)!');
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không đúng!');
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col h-full">
      {/* Branding Section */}
      <div className="bg-tactical-green p-6 pb-10 text-tactical-accent relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          <span className="font-headline font-bold text-tactical-accent/80 tracking-[0.2em] text-[10px] uppercase">
            Trạm Điều Khiển Trung Tâm
          </span>
          <h2 className="font-headline font-black text-3xl leading-tight text-tactical-accent">
            VẬN HÀNH<br />HỆ THỐNG
          </h2>
        </motion.div>

        {/* Quick Features */}
        <div className="mt-6 flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg border border-white/5 min-w-[140px]">
            <ShieldCheck className="text-tactical-accent w-4 h-4" />
            <span className="text-[10px] font-bold text-tactical-accent uppercase leading-none">Mã hóa AES</span>
          </div>
          <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg border border-white/5 min-w-[140px]">
            <div className="w-4 h-4 border-2 border-tactical-accent rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-tactical-accent rounded-full"></div>
            </div>
            <span className="text-[10px] font-bold text-tactical-accent uppercase leading-none">Chính xác 0.1s</span>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-grow -mt-4 bg-[#f9f9f9] rounded-t-[24px] relative z-20 px-6 pt-8 pb-12 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-headline font-black text-2xl text-[#1a1c1c] tracking-tight">ĐĂNG NHẬP</h3>
            <div className="h-1 w-8 bg-tactical-green mt-1 rounded-full"></div>
          </div>
          <span className="text-[9px] font-black text-gray-500 bg-[#e8e8e8] px-2 py-1 rounded-full border border-gray-300">
            VER 4.2.0-SEC
          </span>
        </div>

        <form 
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <p className="text-xs font-bold text-red-600 uppercase">{error}</p>
            </div>
          )}
          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-tactical-green/70 uppercase tracking-wider ml-1">
              Tên đăng nhập (admin / user)
            </label>
            <div className="relative flex items-center bg-[#f3f3f3] rounded-xl border-2 border-transparent focus-within:border-tactical-blue/30 focus-within:bg-white transition-all">
              <User className="text-gray-400 ml-4 mr-2 w-5 h-5" />
              <input 
                className="w-full bg-transparent border-none focus:ring-0 py-3.5 pr-4 text-[#1a1c1c] font-semibold placeholder:text-gray-400/60 placeholder:font-normal text-base" 
                placeholder="Nhập định danh..." 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-tactical-green/70 uppercase tracking-wider ml-1">
              Mật khẩu (123456)
            </label>
            <div className="relative flex items-center bg-[#f3f3f3] rounded-xl border-2 border-transparent focus-within:border-tactical-blue/30 focus-within:bg-white transition-all">
              <Lock className="text-gray-400 ml-4 mr-2 w-5 h-5" />
              <input 
                className="w-full bg-transparent border-none focus:ring-0 py-3.5 pr-4 text-[#1a1c1c] font-semibold placeholder:text-gray-400/60 text-base" 
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform">
              <input className="w-5 h-5 border-2 border-gray-300 text-tactical-green focus:ring-tactical-green rounded-md" type="checkbox" />
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tighter">Ghi nhớ</span>
            </label>
            <a className="text-[11px] font-black text-tactical-blue hover:underline uppercase tracking-tighter" href="#">Quên mật mã?</a>
          </div>

          {/* Action Button */}
          <button 
            className="w-full h-14 bg-tactical-green text-tactical-accent font-headline font-black text-lg tracking-[0.15em] flex items-center justify-center gap-3 rounded-xl transition-all active:scale-[0.97] mt-8 shadow-lg shadow-tactical-green/20 disabled:opacity-70" 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                XÁC THỰC
                <ShieldCheck className="w-6 h-6" />
              </>
            )}
          </button>
        </form>

        {/* Footer Status */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tactical-accent animate-pulse shadow-[0_0_8px_#dfe8a6]"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hệ thống: Trực tuyến</span>
          </div>
          <div className="flex gap-3">
            <div className="p-2 bg-[#eeeeee] rounded-lg opacity-60">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="p-2 bg-[#eeeeee] rounded-lg opacity-60">
              <Fingerprint className="w-5 h-5" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
