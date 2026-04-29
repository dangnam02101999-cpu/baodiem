import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, Delete, ArrowRight, ListOrdered, Target as TargetIcon, Calculator, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError } from '../firebase';
import { collection, addDoc, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { OperationType } from '../types';

import { playSafeSound, playDangerSound, initAudio } from '../lib/audio';

export default function TargetReporterView() {
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scores, setScores] = useState<(number | null)[]>([null, null, null]);
  const [currentH, setCurrentH] = useState(0); // 0 for H1, 1 for H2, 2 for H3
  const [isSending, setIsSending] = useState(false);
  const [systemSignal, setSystemSignal] = useState<{ signal: string, timestamp: number, sender: string } | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const lastSignalTime = useRef<number>(0);

  useEffect(() => {
    // Real-time listener for system signals
    const unsubscribeSignal = onSnapshot(doc(db, 'system_status', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        
        // Use a more robust "recent" check by comparing with last processed timestamp
        // and allowing a small window for initial load
        const isNewSignal = data.timestamp > lastSignalTime.current;
        const isRecent = Date.now() - data.timestamp < 10000; // 10 second window
        
        if (isNewSignal && isRecent) {
          lastSignalTime.current = data.timestamp;
          setSystemSignal(data);
          
          // Only react if the signal is from the CLERK
          if (data.signal !== 'IDLE' && data.sender === 'CLERK') {
            setIsBlinking(true);
            if (data.signal === 'SAFE') playSafeSound();
            if (data.signal === 'DANGER') playDangerSound();
            
            // Auto-reset UI after 5 seconds
            setTimeout(() => setIsBlinking(false), 5000);
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_status/global');
    });

    return () => unsubscribeSignal();
  }, []);

  const sendSignal = async (signal: 'SAFE' | 'DANGER') => {
    initAudio(); // Unlock audio on user interaction
    const path = 'system_status/global';
    try {
      await setDoc(doc(db, 'system_status', 'global'), {
        signal,
        timestamp: Date.now(),
        sender: 'REPORTER'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const lanes = [1, 2, 3, 4, 5, 6, 7, 8];
  const targets = [4, 7, 8];
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const handleNumberClick = (num: number) => {
    if (selectedLane === null || selectedTarget === null) {
      alert('Vui lòng chọn dải và bia trước!');
      return;
    }
    const newScores = [...scores];
    const currentScore = newScores[currentH];
    
    let nextValue: number;
    // Logic: if current score is 1 and user presses 0, it becomes 10
    if (currentScore === 1 && num === 0) {
      nextValue = 10;
    } else {
      nextValue = num;
    }
    
    newScores[currentH] = nextValue;
    setScores(newScores);

    // Auto-advance logic: jumping to next slot
    // If nextValue is 0, 2-9, or 10 (anything but 1)
    if (nextValue !== 1) {
      if (currentH < 2) {
        setCurrentH(prev => prev + 1);
      }
    }
    // If nextValue is 1, we stay at current slot to allow potentially adding '0' for '10'
    // or requiring manual jump if the user actually meant '1'.
  };

  const handleNext = () => {
    if (currentH < 2) {
      setCurrentH(currentH + 1);
    } else {
      alert('Đã nhập đủ 3 điểm chạm. Vui lòng nhấn GỬI để lưu kết quả.');
    }
  };

  const handleClear = () => {
    const newScores = [...scores];
    newScores[currentH] = null;
    setScores(newScores);
  };

  const handleSend = async () => {
    if (scores.some(s => s === null)) {
      alert('Vui lòng nhập đủ 3 điểm chạm trước khi gửi!');
      return;
    }
    
    setIsSending(true);
    const path = 'shooting_results';
    try {
      const resultData = {
        lane: selectedLane,
        target: selectedTarget,
        scores: scores,
        timestamp: Date.now(),
        reporterId: auth.currentUser?.uid || 'anonymous'
      };
      
      await addDoc(collection(db, path), resultData);
      
      alert(`Đã gửi kết quả Dải ${selectedLane} - Bia ${selectedTarget}: ${scores.join('/')}`);
      
      // Reset for next
      setScores([null, null, null]);
      setCurrentH(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col px-3 py-1 gap-2 overflow-hidden relative">
      {/* Signal Overlay */}
      <AnimatePresence>
        {isBlinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, repeat: 5 }}
            className={cn(
              "fixed inset-0 z-[100] pointer-events-none",
              systemSignal?.signal === 'SAFE' ? "bg-tactical-green" : "bg-red-600"
            )}
          />
        )}
      </AnimatePresence>
      {/* Display Area */}
      <div className="p-2 bg-[#e2e2e2] rounded-lg border-l-4 border-tactical-green shadow-inner shrink-0 mt-1">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[7px] font-bold uppercase tracking-wider text-tactical-green opacity-70">
              {selectedTarget ? `BIA ${selectedTarget}` : 'CHƯA CHỌN BIA'} - {selectedLane ? `DẢI ${selectedLane}` : 'CHƯA CHỌN DẢI'}
            </span>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <React.Fragment key={i}>
                  <div 
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
                      currentH === i && "bg-tactical-green/10 ring-1 ring-tactical-green"
                    )}
                    onClick={() => setCurrentH(i)}
                  >
                    <span className="text-[10px] font-bold text-tactical-green/60">H{i + 1}:</span>
                    <span className={cn(
                      "text-xl font-black text-tactical-green font-headline min-w-[1.2rem] text-center",
                      currentH === i && "underline decoration-2 underline-offset-2"
                    )}>
                      {scores[i] !== null ? scores[i] : '-'}
                    </span>
                  </div>
                  {i < 2 && <div className="w-[1px] h-3 bg-gray-300"></div>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className={cn(
            "flex flex-col items-center justify-center p-1 px-2 rounded transition-all border",
            isBlinking && systemSignal?.signal === 'SAFE' ? "bg-tactical-green text-tactical-accent border-tactical-green" : "bg-white text-gray-300 border-gray-100",
            isBlinking && systemSignal?.signal === 'DANGER' ? "bg-red-600 text-white border-red-600" : ""
          )}>
            {isBlinking && systemSignal?.signal === 'DANGER' ? (
              <AlertTriangle className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Shield className="w-3.5 h-3.5 fill-current" />
            )}
            <p className="text-[7px] font-black leading-tight uppercase">
              {isBlinking ? (systemSignal?.signal === 'SAFE' ? 'AN TOÀN' : 'NGUY HIỂM') : 'SẴN SÀNG'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-1.5 min-h-0 overflow-y-auto no-scrollbar">
        {/* Bia Số Section */}
        <section className="bg-[#f3f3f3] p-1.5 rounded-lg shrink-0">
          <div className="flex items-center gap-2 mb-1 border-b border-gray-300 pb-0.5">
            <TargetIcon className="text-tactical-green w-3.5 h-3.5" />
            <h3 className="text-[9px] font-bold font-headline uppercase">BIA SỐ</h3>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {targets.map((target) => (
              <button
                key={target}
                onClick={() => setSelectedTarget(target)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 rounded-xl border transition-all shadow-sm active:scale-95",
                  selectedTarget === target
                    ? "bg-tactical-green text-tactical-accent border-tactical-green shadow-lg"
                    : "bg-white border-gray-200 text-gray-400"
                )}
              >
                <span className="text-[7px] font-black uppercase opacity-70 leading-none">
                  {selectedTarget === target ? 'ĐANG CHỌN' : 'SẴN SÀNG'}
                </span>
                <span className="text-xs font-black">Bia {target}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Dải Số Section */}
        <section className="bg-[#f3f3f3] p-1.5 rounded-lg shrink-0">
          <div className="flex items-center gap-2 mb-1 border-b border-gray-300 pb-0.5">
            <ListOrdered className="text-tactical-green w-3.5 h-3.5" />
            <h3 className="text-[9px] font-bold font-headline uppercase">DẢI SỐ</h3>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {lanes.map((lane) => (
              <button
                key={lane}
                onClick={() => setSelectedLane(lane)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95",
                  selectedLane === lane 
                    ? "bg-tactical-green text-tactical-accent shadow-lg" 
                    : "bg-white border border-gray-200 text-gray-400"
                )}
              >
                <span className="text-[7px] font-black opacity-70 leading-none">DẢI</span>
                <span className="text-sm font-black leading-none">{lane}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Numeric Keypad Section */}
        <section className="bg-[#f3f3f3] p-1.5 rounded-lg flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-1 border-b border-gray-300 pb-0.5">
            <Calculator className="text-tactical-green w-3.5 h-3.5" />
            <h3 className="text-[9px] font-bold font-headline uppercase">NHẬP ĐIỂM</h3>
          </div>
          <div className="grid grid-cols-5 gap-1.5 min-h-[100px]">
            {numbers.map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className={cn(
                  "bg-white border border-gray-200 rounded-xl font-black text-xl py-2 active:bg-tactical-green active:text-tactical-accent transition-all active:scale-95 shadow-sm",
                  scores[currentH] === num && "bg-tactical-green text-tactical-accent border-tactical-green shadow-lg",
                  scores[currentH] === 10 && (num === 1 || num === 0) && "bg-tactical-green/20 border-tactical-green"
                )}
              >
                {num}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Tactical Bottom Actions - Moved outside scrollable area */}
      <div className="grid grid-cols-4 gap-1 pb-2 shrink-0 border-t border-gray-100 pt-2 bg-white/50 backdrop-blur-sm -mx-3 px-3">
        <button 
          onClick={() => sendSignal('SAFE')}
          className={cn(
            "flex flex-col items-center justify-center py-2 rounded-lg shadow-sm active:scale-95 transition-all border",
            isBlinking && systemSignal?.signal === 'SAFE' ? "bg-tactical-green text-tactical-accent border-tactical-green animate-blink" : "bg-white text-gray-400 border-gray-100"
          )}
        >
          <Shield className="w-5 h-5 mb-0.5 fill-current" />
          <span className="text-[8px] font-black font-headline uppercase tracking-wider">AN TOÀN</span>
        </button>
        <button 
          onClick={() => sendSignal('DANGER')}
          className={cn(
            "flex flex-col items-center justify-center py-2 rounded-lg shadow-sm active:scale-95 transition-all border",
            isBlinking && systemSignal?.signal === 'DANGER' ? "bg-red-600 text-white border-red-600 animate-blink" : "bg-white text-gray-400 border-gray-100"
          )}
        >
          <AlertTriangle className="w-5 h-5 mb-0.5 fill-current" />
          <span className="text-[8px] font-black font-headline uppercase tracking-wider">NGUY HIỂM</span>
        </button>
        <button 
          onClick={handleSend}
          disabled={isSending}
          className="flex flex-col items-center justify-center py-2 bg-tactical-warning text-white rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 mb-0.5 animate-spin" />
          ) : (
            <Send className="w-5 h-5 mb-0.5 fill-current" />
          )}
          <span className="text-[8px] font-black font-headline uppercase tracking-wider">GỬI</span>
        </button>
        <button 
          onClick={handleClear}
          className="flex flex-col items-center justify-center py-2 bg-tactical-blue text-white rounded-lg shadow-sm active:scale-95 transition-all"
        >
          <Delete className="w-5 h-5 mb-0.5 fill-current" />
          <span className="text-[8px] font-black font-headline uppercase tracking-wider">XÓA</span>
        </button>
      </div>
    </div>
  );
}
