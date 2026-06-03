import React from 'react';
import { FileEdit, Target, BarChart3, ChevronRight, Settings2, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { Role } from '../types';
import { initAudio } from '../lib/audio';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const getDeviceId = () => {
  let devId = localStorage.getItem('device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('device_id', devId);
  }
  return devId;
};

interface RoleSelectionViewProps {
  onSelectRole: (role: Role) => void;
}

export default function RoleSelectionView({ onSelectRole }: RoleSelectionViewProps) {
  const [activeDevices, setActiveDevices] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Read the active devices list in real-time
    const unsubscribe = onSnapshot(collection(db, 'active_roles'), (snapshot) => {
      const list: any[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const updatedAt = data.updatedAt || 0;
        // Keep only sessions that have been updated within the last 30 seconds
        if (now - updatedAt < 30000) {
          list.push({
            id: docSnap.id,
            ...data
          });
        }
      });
      setActiveDevices(list);
    }, (error) => {
      console.error("Lỗi khi tải trạng thái vai trò từ Firestore:", error);
    });

    return () => unsubscribe();
  }, []);

  const devId = getDeviceId();
  const secretaryCount = activeDevices.filter(d => d.role === 'SECRETARY' && d.id !== devId).length;
  const reporterCount = activeDevices.filter(d => d.role === 'REPORTER' && d.id !== devId).length;

  const handleSelectRole = (role: Role) => {
    initAudio();
    onSelectRole(role);
  };

  const roles = [
    { 
      id: 'SECRETARY' as Role, 
      title: 'THƯ KÝ', 
      level: 'Mức truy cập: Cao', 
      icon: FileEdit,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'REPORTER' as Role, 
      title: 'BÁO BIA', 
      level: 'Mức truy cập: Hiện trường', 
      icon: Target,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'VIEWER' as Role, 
      title: 'XEM KẾT QUẢ', 
      level: 'Mức truy cập: Chỉ xem', 
      icon: BarChart3,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'CALIBRATION' as Role, 
      title: 'BẮN HIỆU CHỈNH', 
      level: 'Mức truy cập: Kỹ thuật', 
      icon: Settings2,
      gradient: 'from-tactical-green to-tactical-green-light'
    },
    { 
      id: 'ESP32' as Role, 
      title: 'THIẾT BỊ ESP32', 
      level: 'Mức truy cập: Phần cứng', 
      icon: Cpu,
      gradient: 'from-tactical-green to-tactical-green-light'
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
            ĐỔI MỚI - SÁNG TẠO
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
          {roles.map((role, index) => {
            const isLimitReached = (role.id === 'SECRETARY' && secretaryCount >= 1) || (role.id === 'REPORTER' && reporterCount >= 3);
            const currentRoleCount = role.id === 'SECRETARY' ? secretaryCount : role.id === 'REPORTER' ? reporterCount : 0;
            const maxRoleCount = role.id === 'SECRETARY' ? 1 : role.id === 'REPORTER' ? 3 : null;

            return (
              <motion.button
                key={role.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                onClick={() => {
                  if (isLimitReached) {
                    if (role.id === 'SECRETARY') {
                      toast.error('Đã có thư ký, mời bạn vào xem kết quả.');
                      alert('Đã có thư ký, mời bạn vào xem kết quả.');
                    } else if (role.id === 'REPORTER') {
                      toast.error('Đã đủ số lượng 3 máy báo bia, mời bạn vào xem kết quả.');
                      alert('Đã đủ số lượng 3 máy báo bia, mời bạn vào xem kết quả.');
                    }
                    return;
                  }
                  handleSelectRole(role.id);
                }}
                className={isLimitReached
                  ? "group relative flex items-center justify-between w-full h-24 px-8 bg-white border border-gray-300 text-gray-800 rounded-md shadow-sm active:scale-95 transition-all duration-75 overflow-hidden"
                  : `group relative flex items-center justify-between w-full h-24 px-8 bg-gradient-to-r ${role.gradient} text-tactical-accent rounded-md shadow-lg active:scale-95 transition-all duration-75 overflow-hidden`
                }
              >
                <div className="relative z-10 flex flex-col items-start text-left">
                  <span className={isLimitReached
                    ? "font-sans text-[10px] tracking-[0.2em] font-black text-gray-400 uppercase"
                    : "font-sans text-[10px] tracking-[0.2em] font-black text-tactical-accent/80 uppercase"
                  }>
                    {isLimitReached ? `Đầy (${currentRoleCount}/${maxRoleCount})` : role.level}
                  </span>
                  <span className={`font-headline text-2xl font-black tracking-wider uppercase ${isLimitReached ? 'text-gray-400' : ''}`}>
                    {role.title}
                  </span>
                </div>
                <div className="relative z-10 flex items-center gap-4">
                  <role.icon className={`w-10 h-10 ${isLimitReached ? 'text-gray-300' : 'text-current'}`} />
                  <ChevronRight className={`w-5 h-5 opacity-40 group-hover:translate-x-2 transition-transform ${isLimitReached ? 'text-gray-300' : 'text-current'}`} />
                </div>
                
                {/* Aesthetic Detail */}
                {!isLimitReached && (
                  <div className="absolute right-0 top-0 h-full w-32 bg-white/5 skew-x-[-20deg] translate-x-16"></div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Technical Manual Footnote */}
        <div className="pt-8 border-t border-gray-200 text-left flex flex-col gap-1 items-start">
          <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Bản quyền: Nguyễn Đặng Phương Nam
          </span>
          <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Địa chỉ Email: <span className="normal-case">dangnam02101999@gmail.com</span>
          </span>
          <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Số điện thoại: 0367789970
          </span>
        </div>
      </div>
    </div>
  );
}
