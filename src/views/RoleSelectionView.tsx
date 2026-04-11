import React from 'react';
import { FileEdit, Target, BarChart3, ChevronRight, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Role } from '../types';

interface RoleSelectionViewProps {
  onSelectRole: (role: Role) => void;
}

export default function RoleSelectionView({ onSelectRole }: RoleSelectionViewProps) {
  const roles = [
    { 
      id: 'SECRETARY' as Role, 
      title: 'THƯ KÝ', 
      level: 'Access Level: High', 
      icon: FileEdit,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'REPORTER' as Role, 
      title: 'BÁO BIA', 
      level: 'Access Level: Field', 
      icon: Target,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'VIEWER' as Role, 
      title: 'XEM KẾT QUẢ', 
      level: 'Access Level: Read-Only', 
      icon: BarChart3,
      variant: 'outline'
    },
    { 
      id: 'CALIBRATION' as Role, 
      title: 'BẮN HIỆU CHỈNH', 
      level: 'Access Level: Technical', 
      icon: Settings2,
      variant: 'outline'
    },
  ];

  return (
    <div className="flex-grow flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Hero Context */}
        <div className="text-center mb-10">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-headline text-tactical-green font-black tracking-widest text-sm bg-tactical-accent px-3 py-1 rounded-sm uppercase"
          >
            Command Post Alpha
          </motion.span>
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-headline text-4xl font-bold mt-4 tracking-tight leading-none text-[#1a1c1c] uppercase"
          >
            Xác thực <br /> Quyền truy cập
          </motion.h2>
          <div className="mt-4 h-1 w-20 bg-tactical-green mx-auto"></div>
        </div>

        {/* Role Selection Buttons */}
        <div className="flex flex-col gap-4">
          {roles.map((role, index) => (
            <motion.button
              key={role.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => onSelectRole(role.id)}
              className={role.variant === 'outline' 
                ? "group relative flex items-center justify-between w-full h-24 px-8 bg-[#e8e8e8] border-2 border-tactical-green/10 text-tactical-green rounded-md active:scale-95 transition-all duration-75 overflow-hidden"
                : `group relative flex items-center justify-between w-full h-24 px-8 bg-gradient-to-r ${role.gradient} text-tactical-accent rounded-md shadow-lg active:scale-95 transition-all duration-75 overflow-hidden`
              }
            >
              <div className="relative z-10 flex flex-col items-start text-left">
                <span className={role.variant === 'outline' 
                  ? "font-sans text-[10px] tracking-[0.2em] font-black text-tactical-green/60 uppercase"
                  : "font-sans text-[10px] tracking-[0.2em] font-black text-tactical-accent/80 uppercase"
                }>
                  {role.level}
                </span>
                <span className="font-headline text-2xl font-black tracking-wider uppercase">
                  {role.title}
                </span>
              </div>
              <div className="relative z-10 flex items-center gap-4">
                <role.icon className="w-10 h-10" />
                <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-2 transition-transform" />
              </div>
              
              {/* Aesthetic Detail */}
              {role.variant !== 'outline' && (
                <div className="absolute right-0 top-0 h-full w-32 bg-white/5 skew-x-[-20deg] translate-x-16"></div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Technical Manual Footnote */}
        <div className="pt-8 border-t border-gray-200 flex justify-between items-end">
          <div className="flex flex-col">
            <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-widest">Protocol ID</span>
            <span className="font-headline font-medium text-xs">V.04-DELTA-2024</span>
          </div>
          <div className="text-right">
            <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
            <span className="font-headline font-bold text-xs text-tactical-green flex items-center gap-1">
              <div className="w-2 h-2 bg-tactical-green rounded-full"></div>
              SECURE LINE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
