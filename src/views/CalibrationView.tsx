import React, { useState, useEffect } from 'react';
import { Settings2, Target, ShieldCheck, User, ChevronRight, ArrowLeft, Crosshair, Calculator, ListOrdered, Send, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError } from '../firebase';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { OperationType } from '../types';

import { Target10 } from '../components/Target10';

type CalibrationMode = 'SELECT' | 'REPORTER' | 'SHOOTER';

interface HitCoord {
  x: number;
  y: number;
}

export default function CalibrationView() {
  const [mode, setMode] = useState<CalibrationMode>('SELECT');
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [scores, setScores] = useState<(number | null)[]>([null, null, null]);
  const [hitCoords, setHitCoords] = useState<(HitCoord | null)[]>([null, null, null]);
  const [currentH, setCurrentH] = useState(0);
  const [calibrationResults, setCalibrationResults] = useState<Record<number, any>>({});
  const [isSending, setIsSending] = useState(false);
  const [systemSignal, setSystemSignal] = useState<{ signal: string, timestamp: number, sender: string } | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);

  // Sound effects
  const playSafeSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Tinh tinh (Double high beep)
    const playBeep = (time: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, time);
      gainNode.gain.setValueAtTime(0.2, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      oscillator.start(time);
      oscillator.stop(time + 0.1);
    };

    playBeep(audioCtx.currentTime);
    playBeep(audioCtx.currentTime + 0.2);
    playBeep(audioCtx.currentTime + 0.4);
  };

  const playDangerSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Tè (Low buzz)
    const playBuzz = (time: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, time);
      gainNode.gain.setValueAtTime(0.2, time);
      gainNode.gain.linearRampToValueAtTime(0.01, time + 0.8);
      oscillator.start(time);
      oscillator.stop(time + 0.8);
    };

    playBuzz(audioCtx.currentTime);
    playBuzz(audioCtx.currentTime + 1.0);
    playBuzz(audioCtx.currentTime + 2.0);
  };

  useEffect(() => {
    // Real-time listener for ALL calibration results
    const unsubscribe = onSnapshot(collection(db, 'calibration_results'), (snapshot) => {
      const results: Record<number, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        results[data.lane] = data;
      });
      setCalibrationResults(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calibration_results');
    });

    // Real-time listener for system signals
    const unsubscribeSignal = onSnapshot(doc(db, 'system_status', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setSystemSignal(data);
        
        const isRecent = Date.now() - data.timestamp < 5000;
        
        // Only react if the signal is from the CLERK
        if (data.signal !== 'IDLE' && isRecent && data.sender === 'CLERK') {
          setIsBlinking(true);
          if (data.signal === 'SAFE') playSafeSound();
          if (data.signal === 'DANGER') playDangerSound();
          
          // Auto-reset UI after 5 seconds
          setTimeout(() => setIsBlinking(false), 5000);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_status/global');
    });

    return () => {
      unsubscribe();
      unsubscribeSignal();
    };
  }, []);

  const sendSignal = async (signal: 'SAFE' | 'DANGER') => {
    const path = 'system_status/global';
    try {
      await setDoc(doc(db, 'system_status', 'global'), {
        signal,
        timestamp: Date.now(),
        sender: 'REPORTER_CALIB'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const targetRef = React.useRef<HTMLDivElement>(null);
  const lanes = [1, 2, 3, 4, 5, 6, 7, 8];
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const handleNumberClick = (num: number) => {
    if (selectedLane === null) {
      alert('Vui lòng chọn dải trước!');
      return;
    }
    const newScores = [...scores];
    const currentScore = newScores[currentH];
    
    // Logic: if current score is 1 and user presses 0, it becomes 10
    if (currentScore === 1 && num === 0) {
      newScores[currentH] = 10;
    } else {
      newScores[currentH] = num;
    }
    setScores(newScores);
  };

  const handleTargetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedLane === null) {
      alert('Vui lòng chọn dải trước!');
      return;
    }
    
    // Enforce all scores entered first
    if (scores.some(s => s === null)) {
      alert('Vui lòng nhập đủ điểm số cho H1, H2, H3 trước khi chấm điểm chạm!');
      return;
    }

    // Find the first empty hit coordinate
    const emptyIndex = hitCoords.findIndex(c => c === null);
    if (emptyIndex === -1) return; // All 3 hits already marked

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100 - 50;
    const y = ((e.clientY - rect.top) / rect.height) * 100 - 52.45;
    
    const newCoords = [...hitCoords];
    newCoords[emptyIndex] = { x, y };
    setHitCoords(newCoords);
    
    // Auto-advance currentH to show which one is being edited/dragged
    if (emptyIndex < 2) setCurrentH(emptyIndex + 1);
  };

  const handleSendCalibration = async () => {
    if (selectedLane === null) return;
    if (scores.some(s => s === null) || hitCoords.some(c => c === null)) {
      alert('Vui lòng nhập đủ điểm số và chấm đủ 3 điểm chạm trên mặt bia!');
      return;
    }
    
    setIsSending(true);
    const path = `calibration_results/${selectedLane}`;
    try {
      const calibrationData = {
        lane: selectedLane,
        scores: scores,
        hits: hitCoords,
        timestamp: Date.now(),
        reporterId: auth.currentUser?.uid || 'anonymous'
      };
      
      // Use lane as document ID for easy lookup
      await setDoc(doc(db, 'calibration_results', selectedLane.toString()), calibrationData);

      alert(`Đã gửi kết quả hiệu chỉnh Dải ${selectedLane} thành công!`);
      setScores([null, null, null]);
      setHitCoords([null, null, null]);
      setCurrentH(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSending(false);
    }
  };

  const renderSelection = () => (
    <div className="max-w-md mx-auto w-full space-y-6">
      <div className="text-center mb-10">
        <span className="font-sans text-[10px] font-black text-tactical-green bg-tactical-accent px-3 py-1 rounded-sm uppercase tracking-widest">Technical Mode</span>
        <h2 className="font-headline text-3xl font-bold mt-4 text-[#1a1c1c] uppercase tracking-tight">BẮN HIỆU CHỈNH</h2>
        <p className="text-gray-400 text-xs mt-2 font-medium uppercase tracking-wider">Vui lòng chọn chế độ làm việc</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('REPORTER')}
          className="group flex items-center justify-between p-6 bg-white border-2 border-gray-100 rounded-xl shadow-sm hover:border-tactical-green transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-tactical-green/10 text-tactical-green rounded-full flex items-center justify-center group-hover:bg-tactical-green group-hover:text-tactical-accent transition-colors">
              <Target className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-headline font-black text-lg uppercase">BÁO BIA</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Ghi nhận điểm chạm hiệu chỉnh</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-tactical-green transition-colors" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('SHOOTER')}
          className="group flex items-center justify-between p-6 bg-white border-2 border-gray-100 rounded-xl shadow-sm hover:border-tactical-blue transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-tactical-blue/10 text-tactical-blue rounded-full flex items-center justify-center group-hover:bg-tactical-blue group-hover:text-white transition-colors">
              <User className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-headline font-black text-lg uppercase">NGƯỜI BẮN</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Theo dõi kết quả hiệu chỉnh</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-tactical-blue transition-colors" />
        </motion.button>
      </div>

      <div className="pt-8 border-t border-gray-200">
        <div className="bg-[#1a1c1c] text-white p-4 rounded-lg flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-tactical-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest">Hệ thống: Sẵn sàng</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500">v1.0.4-CAL</span>
        </div>
      </div>
    </div>
  );

  const handleMarkerDragEnd = (index: number, info: any, containerRect: DOMRect) => {
    const x = ((info.point.x - containerRect.left) / containerRect.width) * 100 - 50;
    const y = ((info.point.y - containerRect.top) / containerRect.height) * 100 - 52.45;
    
    // Clamp values to stay within bounds
    const clampedX = Math.max(-50, Math.min(50, x));
    const clampedY = Math.max(-52.45, Math.min(47.55, y));
    
    const newCoords = [...hitCoords];
    newCoords[index] = { x: clampedX, y: clampedY };
    setHitCoords(newCoords);
    setCurrentH(index); // Focus on the marker being moved
  };

  const renderReporter = () => {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <button onClick={() => setMode('SELECT')} className="flex items-center gap-2 text-gray-400 hover:text-tactical-green transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Quay lại</span>
          </button>
          <h2 className="font-headline text-lg font-bold text-tactical-green uppercase">BÁO BIA HIỆU CHỈNH (BIA SỐ 10)</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-4 space-y-4">
            {/* Display */}
            <div className="p-4 bg-[#e2e2e2] rounded-xl border-l-4 border-tactical-green shadow-inner">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      onClick={() => setCurrentH(i)}
                      className={cn(
                        "flex flex-col items-center p-2 rounded cursor-pointer transition-all",
                        currentH === i ? "bg-tactical-green/10 ring-1 ring-tactical-green" : ""
                      )}
                    >
                      <span className="text-[8px] font-bold text-gray-400 uppercase">H{i+1}</span>
                      <span className="text-2xl font-black text-tactical-green font-headline">
                        {scores[i] !== null ? scores[i] : '-'}
                      </span>
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1",
                        hitCoords[i] ? "bg-tactical-green" : "bg-gray-300"
                      )}></div>
                    </div>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-gray-400 uppercase">Dải: {selectedLane || '--'}</p>
                  <p className="text-[10px] font-black text-tactical-green uppercase">BIA SỐ 10</p>
                </div>
              </div>
            </div>

            {/* Lane Selection */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ListOrdered className="w-4 h-4 text-tactical-green" />
                <span className="text-[10px] font-black uppercase tracking-widest">Chọn dải bắn</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {lanes.map(l => (
                  <button 
                    key={l} 
                    onClick={() => setSelectedLane(l)}
                    className={cn(
                      "py-2 rounded font-headline font-black text-sm transition-all",
                      selectedLane === l ? "bg-tactical-green text-tactical-accent" : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-tactical-green" />
                <span className="text-[10px] font-black uppercase tracking-widest">Nhập điểm</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {numbers.map(n => (
                  <button 
                    key={n} 
                    onClick={() => handleNumberClick(n)}
                    className={cn(
                      "aspect-square flex items-center justify-center bg-gray-100 rounded-lg font-headline font-black text-xl hover:bg-tactical-green hover:text-tactical-accent transition-all",
                      scores[currentH] === n && "bg-tactical-green text-tactical-accent",
                      // Special highlight for 10
                      scores[currentH] === 10 && (n === 1 || n === 0) && "bg-tactical-green/20"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => sendSignal('SAFE')}
                className={cn(
                  "py-3 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-95 group border-2",
                  isBlinking && systemSignal?.signal === 'SAFE' 
                    ? "bg-tactical-green text-tactical-accent border-tactical-green animate-blink" 
                    : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
                )}
              >
                <ShieldCheck className={cn(
                  "w-5 h-5 group-hover:scale-110 transition-transform fill-current",
                  isBlinking && systemSignal?.signal === 'SAFE' ? "text-tactical-accent" : "text-gray-300"
                )} />
                <span className="font-headline text-[9px] font-black tracking-widest uppercase">AN TOÀN</span>
              </button>
              <button 
                onClick={() => sendSignal('DANGER')}
                className={cn(
                  "py-3 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-95 group border-2",
                  isBlinking && systemSignal?.signal === 'DANGER' 
                    ? "bg-red-600 text-white border-red-600 animate-blink" 
                    : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
                )}
              >
                <Target className={cn(
                  "w-5 h-5 group-hover:scale-110 transition-transform fill-current",
                  isBlinking && systemSignal?.signal === 'DANGER' ? "text-white" : "text-gray-300"
                )} />
                <span className="font-headline text-[9px] font-black tracking-widest uppercase">NGUY HIỂM</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => { setScores([null, null, null]); setHitCoords([null, null, null]); setCurrentH(0); }}
                className="py-4 bg-gray-200 text-gray-500 rounded-xl font-headline font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                XÓA
              </button>
              <button 
                onClick={handleSendCalibration}
                disabled={isSending}
                className="py-4 bg-tactical-green text-tactical-accent rounded-xl font-headline font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    GỬI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Target Image */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="mb-4 text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {scores.some(s => s === null) 
                  ? "Vui lòng nhập đủ 3 điểm số phía trên trước" 
                  : "Chạm vào mặt bia để báo 3 điểm chạm. Nhấn giữ để di chuyển."}
              </p>
            </div>
            <div 
              ref={targetRef}
              className="relative w-full max-w-[400px] aspect-[3/4] cursor-crosshair overflow-hidden rounded-lg border-4 border-[#f3f3f3] bg-white shadow-inner"
              onClick={handleTargetClick}
            >
              <Target10 className="w-full h-full" />
              
              {/* Hit Markers */}
              {hitCoords.map((hit, i) => hit && (
                <motion.div 
                  key={i}
                  drag
                  dragMomentum={false}
                  dragConstraints={targetRef}
                  dragElastic={0}
                  onDragEnd={(_, info) => targetRef.current && handleMarkerDragEnd(i, info, targetRef.current.getBoundingClientRect())}
                  whileDrag={{ scale: 1.3, zIndex: 50, cursor: 'grabbing' }}
                  className={cn(
                    "absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center font-black text-xs shadow-xl cursor-grab z-30 touch-none",
                    currentH === i ? "bg-tactical-green text-tactical-accent border-white scale-110" : "bg-white text-tactical-green border-tactical-green opacity-90"
                  )}
                  style={{ left: `${50 + hit.x}%`, top: `${52.45 + hit.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentH(i);
                  }}
                >
                  H{i + 1}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderShooter = () => {
    const myData = selectedLane ? calibrationResults[selectedLane] : null;

    return (
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <button onClick={() => { setMode('SELECT'); setSelectedLane(null); }} className="flex items-center gap-2 text-gray-400 hover:text-tactical-blue transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Quay lại</span>
          </button>
          <h2 className="font-headline text-xl font-bold text-tactical-blue uppercase">NGƯỜI BẮN HIỆU CHỈNH</h2>
        </div>

        {!selectedLane ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center space-y-8">
            <div className="space-y-2">
              <h3 className="font-headline text-2xl font-black text-tactical-blue uppercase">Chọn dải bắn của bạn</h3>
              <p className="text-gray-400 text-sm font-medium">Vui lòng chọn dải số bạn đang thực hiện hiệu chỉnh</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lanes.map(l => (
                <button 
                  key={l} 
                  onClick={() => setSelectedLane(l)}
                  className="h-24 bg-[#f3f3f3] hover:bg-tactical-blue hover:text-white rounded-xl font-headline font-black text-3xl transition-all active:scale-95"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-tactical-blue text-white rounded-xl flex items-center justify-center font-headline font-black text-2xl">
                  {selectedLane}
                </div>
                <div>
                  <h3 className="font-headline font-black text-lg uppercase leading-none">DẢI SỐ {selectedLane}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Đang theo dõi hiệu chỉnh</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLane(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[10px] font-black uppercase transition-colors"
              >
                Đổi dải bắn
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Target View */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center"
              >
                <h4 className="font-headline text-xs font-black text-gray-400 uppercase tracking-widest mb-6 self-start flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  HÌNH ẢNH ĐIỂM CHẠM
                </h4>
                
                <div className="relative w-full max-w-[350px] aspect-[636/572] bg-white rounded-lg overflow-hidden border-4 border-[#f3f3f3] shadow-inner">
                  <Target10 className="w-full h-full" />
                  
                  <AnimatePresence>
                    {myData?.hits.map((hit: any, i: number) => hit && (
                      <motion.div
                        key={`${myData.timestamp}-${i}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 bg-tactical-accent rounded-full shadow-[0_0_15px_#dfe8a6] flex flex-col items-center justify-center border-2 border-white z-20"
                        style={{ 
                          left: `${50 + hit.x}%`, 
                          top: `${52.45 + hit.y}%` 
                        }}
                      >
                        <span className="text-[8px] font-black text-tactical-green leading-none">H{i+1}</span>
                        <span className="text-[14px] font-black text-tactical-green leading-none">{myData.scores[i]}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {!myData && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] z-10">
                      <Crosshair className="w-16 h-16 text-gray-200 animate-pulse mb-4" />
                      <p className="font-headline font-bold text-xs text-gray-400 uppercase tracking-widest">Chờ báo bia...</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Score View */}
              <div className="space-y-6">
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                >
                  <h4 className="font-headline text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    ĐIỂM SỐ CHI TIẾT
                  </h4>

                  {myData ? (
                    <div className="space-y-8">
                      <div className="flex justify-around">
                        {myData.scores.map((score: number, i: number) => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">H{i+1}</span>
                            <div className="w-16 h-16 bg-[#f3f3f3] rounded-xl flex items-center justify-center border-b-4 border-tactical-blue">
                              <span className="text-3xl font-black font-headline text-tactical-blue">{score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TỔNG ĐIỂM</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-black text-tactical-blue font-headline">
                              {myData.scores.reduce((a: number, b: number) => a + (b || 0), 0)}
                            </span>
                            <span className="text-sm font-bold text-gray-400">ĐIỂM</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">THỜI GIAN</p>
                          <span className="text-xs font-bold text-gray-500">
                            {new Date(myData.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-gray-300 font-headline font-bold uppercase tracking-widest">Chưa có dữ liệu</p>
                    </div>
                  )}
                </motion.div>

                <div className={cn(
                  "p-6 rounded-2xl shadow-lg transition-all border-2",
                  isBlinking && systemSignal?.signal === 'SAFE' ? "bg-tactical-green text-tactical-accent border-tactical-green" : "",
                  isBlinking && systemSignal?.signal === 'DANGER' ? "bg-red-600 text-white border-red-600" : "",
                  !isBlinking ? "bg-white text-gray-400 border-gray-100" : ""
                )}>
                  <h4 className="font-headline text-xs font-black opacity-40 uppercase tracking-widest mb-4 flex items-center gap-2">
                    {isBlinking && systemSignal?.signal === 'DANGER' ? <Target className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    {isBlinking ? `TÍN HIỆU: ${systemSignal?.signal}` : 'TRẠNG THÁI HỆ THỐNG'}
                  </h4>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isBlinking ? "bg-white animate-pulse" : "bg-gray-300"
                    )}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {isBlinking ? 'ĐANG NHẬN TÍN HIỆU...' : 'SẴN SÀNG'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-grow flex flex-col p-2 sm:p-4 md:p-8 space-y-8 overflow-y-auto no-scrollbar relative">
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
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {mode === 'SELECT' && renderSelection()}
          {mode === 'REPORTER' && renderReporter()}
          {mode === 'SHOOTER' && renderShooter()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
