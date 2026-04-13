import React, { useState, useEffect } from 'react';
import { Play, Shield, AlertTriangle, ChevronLeft, ChevronRight, Loader2, Save, FileSpreadsheet, Trash2, FolderOpen, Edit, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { MOCK_SOLDIERS } from '../constants';
import { cn } from '../lib/utils';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { OperationType } from '../types';

export default function ClerkView() {
  const lanes = [1, 2, 3, 4, 5, 6, 7, 8];
  const [results, setResults] = useState<any[]>([]);
  const [shootingQueue, setShootingQueue] = useState<any[]>([]);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
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
    // Real-time listener for shooting results
    const q = query(collection(db, 'shooting_results'), orderBy('timestamp', 'desc'));
    const unsubscribeResults = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_results');
    });

    // Real-time listener for shooting queue
    const qQueue = query(collection(db, 'shooting_queue'), orderBy('order', 'asc'));
    const unsubscribeQueue = onSnapshot(qQueue, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Mark mock soldiers so we don't try to update them in Firestore
      setShootingQueue(data.length > 0 ? data : MOCK_SOLDIERS.map(s => ({ ...s, isMock: true })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_queue');
    });

    // Real-time listener for saved sessions
    const qSessions = query(collection(db, 'shooting_history'), orderBy('timestamp', 'desc'));
    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedSessions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_history');
    });

    // Real-time listener for system signals
    const unsubscribeSignal = onSnapshot(doc(db, 'system_status', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setSystemSignal(data);
        
        const isRecent = Date.now() - data.timestamp < 5000;
        
        // Only react if the signal is from a REPORTER
        if (data.signal !== 'IDLE' && isRecent && (data.sender === 'REPORTER' || data.sender === 'REPORTER_CALIB')) {
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
      unsubscribeResults();
      unsubscribeQueue();
      unsubscribeSessions();
      unsubscribeSignal();
    };
  }, []);

  const sendSignal = async (signal: 'SAFE' | 'DANGER') => {
    const path = 'system_status/global';
    try {
      await setDoc(doc(db, 'system_status', 'global'), {
        signal,
        timestamp: Date.now(),
        sender: 'CLERK'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getScoreForLaneAndTarget = (lane: number, target: number) => {
    // Filter results for this lane and target from the current round's timeframe
    // For simplicity in this demo, we'll just show the latest result for that lane/target
    const laneResults = results.filter(r => r.lane === lane && r.target === target);
    if (laneResults.length === 0) return '- / - / -';
    const latest = laneResults[0]; // results is ordered by timestamp desc
    return latest.scores.map((s: any) => s === null ? '-' : s).join(' / ');
  };

  const getSumForLaneAndTarget = (lane: number, target: number) => {
    const laneResults = results.filter(r => r.lane === lane && r.target === target);
    if (laneResults.length === 0) return 0;
    const latest = laneResults[0];
    return latest.scores.reduce((sum: number, s: any) => sum + (s || 0), 0);
  };

  const getTotalForLane = (lane: number) => {
    return getSumForLaneAndTarget(lane, 4) + getSumForLaneAndTarget(lane, 7) + getSumForLaneAndTarget(lane, 8);
  };

  const getClassification = (total: number) => {
    if (total >= 27) return 'Giỏi';
    if (total >= 24) return 'Khá';
    if (total >= 18) return 'Đạt';
    return 'Không đạt';
  };

  const handleSaveRound = async () => {
    const currentSoldiers = shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8);
    if (currentSoldiers.length === 0 && results.length === 0) {
      alert('Không có dữ liệu để lưu!');
      return;
    }

    setIsSaving(true);
    try {
      // Get existing session results from localStorage (or Firestore)
      const savedResults = JSON.parse(localStorage.getItem('session_temp_results') || '[]');
      
      const newResults = lanes.map((lane, index) => {
        const soldier = currentSoldiers[index];
        const t4 = getSumForLaneAndTarget(lane, 4);
        const t7 = getSumForLaneAndTarget(lane, 7);
        const t8 = getSumForLaneAndTarget(lane, 8);
        const total = t4 + t7 + t8;
        
        return {
          id: soldier?.id || `placeholder-${Date.now()}-${lane}`,
          name: soldier?.name || `Quân nhân Dải ${lane}`,
          rank: soldier?.rank || '---',
          position: soldier?.position || '---',
          unit: soldier?.unit || '---',
          lane,
          scores: { target4: t4, target7: t7, target8: t8 },
          total,
          classification: getClassification(total),
          timestamp: new Date().toISOString()
        };
      });

      localStorage.setItem('session_temp_results', JSON.stringify([...savedResults, ...newResults]));
      
      // Update soldiers status in Firestore queue instead of deleting
      if (currentSoldiers.length > 0) {
        const queueBatch = writeBatch(db);
        let hasUpdates = false;
        currentSoldiers.forEach(s => {
          // Only update if it's a real Firestore document (not mock and not placeholder)
          if (s.id && !s.id.startsWith('placeholder') && !s.isMock) {
            queueBatch.update(doc(db, 'shooting_queue', s.id), {
              status: 'Completed'
            });
            hasUpdates = true;
          }
        });
        if (hasUpdates) {
          await queueBatch.commit();
        }
      }
      
      // Clear Firestore results for the next round
      const batch = writeBatch(db);
      results.forEach(res => {
        batch.delete(doc(db, 'shooting_results', res.id));
      });
      await batch.commit();
      
      alert('Đã lưu kết quả lượt bắn!');
      
      // Auto-advance to next round if available
      if (currentRound < totalRounds - 1) {
        setCurrentRound(prev => prev + 1);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch_operation');
    } finally {
      setIsSaving(false);
    }
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data.map((r, idx) => ({
      'STT': idx + 1,
      'Họ và Tên': r.name,
      'Cấp bậc': r.rank,
      'Chức vụ': r.position,
      'Đơn vị': r.unit,
      'Dải': r.lane,
      'Bia 4': r.scores.target4,
      'Bia 7': r.scores.target7,
      'Bia 8': r.scores.target8,
      'Tổng điểm': r.total,
      'Xếp loại': r.classification,
      'Thời gian': new Date(r.timestamp).toLocaleString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết quả");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleFinalSave = async () => {
    if (!sessionName.trim()) {
      alert('Vui lòng nhập tên phiên bắn!');
      return;
    }

    const tempResults = JSON.parse(localStorage.getItem('session_temp_results') || '[]');
    if (tempResults.length === 0) {
      alert('Không có kết quả nào để lưu vào lịch sử!');
      return;
    }

    setIsSaving(true);
    try {
      // Save to Firestore history
      await addDoc(collection(db, 'shooting_history'), {
        name: sessionName,
        results: tempResults,
        timestamp: Date.now(),
        totalSoldiers: tempResults.length,
        averageScore: (tempResults.reduce((acc: number, r: any) => acc + r.total, 0) / tempResults.length).toFixed(2)
      });

      // Reset everything
      localStorage.removeItem('session_temp_results');
      
      // Reset statuses in queue instead of deleting the whole queue
      const queueSnapshot = await getDocs(collection(db, 'shooting_queue'));
      const batch = writeBatch(db);
      queueSnapshot.docs.forEach(d => {
        batch.update(d.ref, { status: 'Pending' });
      });
      await batch.commit();

      // Clear remaining results if any
      const resultsSnapshot = await getDocs(collection(db, 'shooting_results'));
      const resBatch = writeBatch(db);
      resultsSnapshot.docs.forEach(d => resBatch.delete(d.ref));
      await resBatch.commit();

      setSessionName('');
      setShowSaveModal(false);
      setCurrentRound(0);
      alert('Đã lưu phiên bắn vào lịch sử và đặt lại hệ thống!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'final_save_operation');
    } finally {
      setIsSaving(false);
    }
  };

  const updateHistoryName = async (id: string) => {
    if (!newSessionName.trim()) return;
    setIsUpdatingName(true);
    try {
      await setDoc(doc(db, 'shooting_history', id), { name: newSessionName }, { merge: true });
      setEditingSessionId(null);
      setNewSessionName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shooting_history/${id}`);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const deleteHistorySession = async (id: string) => {
    const path = `shooting_history/${id}`;
    try {
      await deleteDoc(doc(db, 'shooting_history', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const currentSoldiers = shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8);
  const totalRounds = Math.ceil(shootingQueue.length / 8);

  return (
    <div className="max-w-[1400px] mx-auto p-2 sm:p-4 md:p-8 space-y-6 relative">
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
      {/* Score Dashboard */}
      <section className="bg-white p-3 sm:p-4 md:p-6 rounded-xl space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="font-headline text-sm font-bold tracking-widest text-tactical-green opacity-60 uppercase">
            Bảng Nhận Điểm Trực Tiếp
          </h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                if (results.length === 0) return alert('Không có dữ liệu trực tiếp!');
                // Format live results for export
                const liveData = lanes.map(lane => ({
                  name: shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8)[lane - 1]?.name || `Dải ${lane}`,
                  rank: shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8)[lane - 1]?.rank || '---',
                  position: shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8)[lane - 1]?.position || '---',
                  unit: shootingQueue.slice(currentRound * 8, (currentRound + 1) * 8)[lane - 1]?.unit || '---',
                  lane,
                  scores: {
                    target4: getSumForLaneAndTarget(lane, 4),
                    target7: getSumForLaneAndTarget(lane, 7),
                    target8: getSumForLaneAndTarget(lane, 8)
                  },
                  total: getTotalForLane(lane),
                  classification: getClassification(getTotalForLane(lane)),
                  timestamp: new Date().toISOString()
                }));
                exportToExcel(liveData, 'Ket_qua_truc_tiep_luot_ban');
              }}
              className="flex-1 sm:flex-none px-3 py-2 bg-white border border-tactical-green text-tactical-green rounded-lg font-headline font-bold text-[9px] flex items-center justify-center gap-2 hover:bg-tactical-green hover:text-white transition-all"
            >
              <FileSpreadsheet className="w-3 h-3" />
              XUẤT EXCEL
            </button>
            <button 
              onClick={handleSaveRound}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-tactical-green to-tactical-green-light text-tactical-accent rounded-lg font-headline font-bold text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              LƯU KẾT QUẢ
            </button>
          </div>
        </div>

        {/* Grid for Lane Scores */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg scrollbar-thin scrollbar-thumb-tactical-green/20">
          <table className="w-full text-center border-collapse min-w-[450px]">
            <thead>
              <tr className="bg-[#e8e8e8] text-[10px] font-black font-headline uppercase text-gray-500">
                <th className="py-3 px-2 border-b border-gray-200 text-left pl-4 whitespace-nowrap">DẢI</th>
                <th className="py-3 px-2 border-b border-gray-200 whitespace-nowrap">BIA 4</th>
                <th className="py-3 px-2 border-b border-gray-200 whitespace-nowrap">BIA 7</th>
                <th className="py-3 px-2 border-b border-gray-200 whitespace-nowrap">BIA 8</th>
                <th className="py-3 px-2 border-b border-gray-200 bg-tactical-green-light/10 text-tactical-green whitespace-nowrap">TỔNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lanes.map((lane) => (
                <tr key={lane} className="hover:bg-[#f3f3f3] transition-colors">
                  <td className="py-3 px-2 text-left pl-4 font-headline font-black text-tactical-green">DẢI {lane}</td>
                  <td className="py-3 px-2 font-headline font-bold text-xs tracking-tighter">{getScoreForLaneAndTarget(lane, 4)}</td>
                  <td className="py-3 px-2 font-headline font-bold text-xs tracking-tighter">{getScoreForLaneAndTarget(lane, 7)}</td>
                  <td className="py-3 px-2 font-headline font-bold text-xs tracking-tighter">{getScoreForLaneAndTarget(lane, 8)}</td>
                  <td className="py-3 px-2 font-headline font-black text-tactical-green-light">{getTotalForLane(lane)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Status Buttons */}
      <section className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button 
          onClick={() => sendSignal('SAFE')}
          className={cn(
            "flex-1 py-3 sm:py-4 rounded-xl flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 shadow-sm transition-all active:scale-95 group border-2",
            isBlinking && systemSignal?.signal === 'SAFE' 
              ? "bg-tactical-green text-tactical-accent border-tactical-green animate-blink" 
              : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
          )}
        >
          <Shield className={cn(
            "w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform fill-current",
            isBlinking && systemSignal?.signal === 'SAFE' ? "text-tactical-accent" : "text-gray-300"
          )} />
          <span className="font-headline text-sm sm:text-lg font-black tracking-widest uppercase">AN TOÀN</span>
        </button>
        <button 
          onClick={() => sendSignal('DANGER')}
          className={cn(
            "flex-1 py-3 sm:py-4 rounded-xl flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 shadow-sm transition-all active:scale-95 group border-2",
            isBlinking && systemSignal?.signal === 'DANGER' 
              ? "bg-red-600 text-white border-red-600 animate-blink" 
              : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
          )}
        >
          <AlertTriangle className={cn(
            "w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform fill-current",
            isBlinking && systemSignal?.signal === 'DANGER' ? "text-white" : "text-gray-300"
          )} />
          <span className="font-headline text-sm sm:text-lg font-black tracking-widest uppercase">NGUY HIỂM</span>
        </button>
      </section>

      {/* Shooting List Table */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-4 bg-[#e8e8e8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-headline font-black text-xs sm:text-sm tracking-widest text-tactical-green uppercase">
              Danh sách gọi tên - Lượt {currentRound + 1}
            </h3>
            <div className="flex gap-1">
              <button 
                disabled={currentRound === 0}
                onClick={() => setCurrentRound(prev => prev - 1)}
                className="p-1.5 bg-white hover:bg-gray-100 transition-colors rounded border border-gray-300 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center px-3 bg-white border border-gray-300 rounded font-headline font-bold text-[10px]">
                {currentRound + 1} / {totalRounds || 1}
              </div>
              <button 
                disabled={currentRound >= totalRounds - 1}
                onClick={() => setCurrentRound(prev => prev + 1)}
                className="p-1.5 bg-white hover:bg-gray-100 transition-colors rounded border border-gray-300 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <span className="px-3 py-1.5 bg-tactical-green text-tactical-accent font-headline text-[9px] font-black uppercase rounded">
              {currentSoldiers.length} NGƯỜI
            </span>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-tactical-green/20">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="px-4 py-3 font-headline text-[10px] font-black text-gray-500 uppercase whitespace-nowrap">Dải</th>
                <th className="px-4 py-3 font-headline text-[10px] font-black text-gray-500 uppercase whitespace-nowrap">Họ và Tên</th>
                <th className="px-4 py-3 font-headline text-[10px] font-black text-gray-500 uppercase whitespace-nowrap">Đơn vị</th>
                <th className="px-4 py-3 font-headline text-[10px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lanes.map((lane, index) => {
                const soldier = currentSoldiers[index];
                return (
                  <tr key={lane} className="hover:bg-[#f3f3f3] transition-colors">
                    <td className="px-4 py-3 font-headline font-bold text-tactical-green">DẢI {lane}</td>
                    <td className="px-4 py-3 font-sans font-semibold">{soldier ? soldier.name : '---'}</td>
                    <td className="px-4 py-3 font-sans text-xs text-gray-500">{soldier ? soldier.unit : '---'}</td>
                    <td className="px-4 py-3 text-center">
                      {soldier ? (
                        <span className={cn(
                          "px-2 py-0.5 text-[9px] font-black rounded-full",
                          soldier.status === 'Completed' 
                            ? "bg-gray-400 text-white" 
                            : "bg-tactical-blue text-white"
                        )}>
                          {soldier.status === 'Completed' ? 'ĐÃ BẮN' : 'SẴN SÀNG'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-gray-200 text-gray-400">
                          TRỐNG
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Current Session Results */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm border border-tactical-green/20">
        <div className="px-6 py-4 bg-tactical-green/5 flex justify-between items-center border-b border-tactical-green/10">
          <div className="flex items-center gap-3">
            <FolderOpen className="text-tactical-green w-5 h-5" />
            <h3 className="font-headline font-black text-sm tracking-widest text-tactical-green uppercase">
              Kết quả phiên bắn hiện tại
            </h3>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const tempResults = JSON.parse(localStorage.getItem('session_temp_results') || '[]');
                if (tempResults.length === 0) return alert('Không có dữ liệu!');
                exportToExcel(tempResults, 'Ket_qua_phien_ban_hien_tai');
              }}
              className="px-4 py-2 bg-white border border-tactical-green text-tactical-green rounded-lg font-headline font-bold text-[10px] flex items-center gap-2 hover:bg-tactical-green hover:text-white transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              XUẤT EXCEL
            </button>
            <button 
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 bg-tactical-green text-tactical-accent rounded-lg font-headline font-bold text-[10px] flex items-center gap-2 hover:opacity-90 transition-all"
            >
              <Save className="w-4 h-4" />
              LƯU PHIÊN BẮN
            </button>
          </div>
        </div>
        <div className="p-6">
          {JSON.parse(localStorage.getItem('session_temp_results') || '[]').length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-headline font-bold text-xs uppercase tracking-widest">
              Chưa có kết quả nào được lưu trong phiên này
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black font-headline uppercase text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-4">Họ và Tên</th>
                    <th className="py-2 px-4">Dải</th>
                    <th className="py-2 px-4 text-center">Bia 4</th>
                    <th className="py-2 px-4 text-center">Bia 7</th>
                    <th className="py-2 px-4 text-center">Bia 8</th>
                    <th className="py-2 px-4 text-center">Tổng</th>
                    <th className="py-2 px-4 text-center">Xếp loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {JSON.parse(localStorage.getItem('session_temp_results') || '[]').map((r: any, i: number) => (
                    <tr key={i} className="text-xs hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-4 font-semibold">{r.name}</td>
                      <td className="py-2 px-4 text-tactical-green font-bold">Dải {r.lane}</td>
                      <td className="py-2 px-4 text-center">{r.scores.target4}</td>
                      <td className="py-2 px-4 text-center">{r.scores.target7}</td>
                      <td className="py-2 px-4 text-center">{r.scores.target8}</td>
                      <td className="py-2 px-4 text-center font-black text-tactical-green">{r.total}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black",
                          r.classification === 'Giỏi' ? "bg-tactical-green text-tactical-accent" :
                          r.classification === 'Khá' ? "bg-tactical-blue text-white" :
                          r.classification === 'Đạt' ? "bg-tactical-warning text-white" :
                          "bg-tactical-danger text-white"
                        )}>
                          {r.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Session History */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-[#1a1c1c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FolderOpen className="text-tactical-accent w-5 h-5" />
            <h3 className="font-headline font-black text-sm tracking-widest text-tactical-accent uppercase">
              Lịch sử phiên bắn
            </h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {savedSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-headline font-bold text-xs uppercase tracking-widest">
              Chưa có phiên bắn nào trong lịch sử
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedSessions.map((session) => (
                <div key={session.id} className="border border-gray-100 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow bg-gray-50/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      {editingSessionId === session.id ? (
                        <div className="flex gap-2 mb-2">
                          <input 
                            type="text"
                            value={newSessionName}
                            onChange={(e) => setNewSessionName(e.target.value)}
                            className="flex-grow px-2 py-1 text-xs border rounded outline-none focus:ring-1 focus:ring-tactical-green"
                            autoFocus
                          />
                          <button 
                            onClick={() => updateHistoryName(session.id)}
                            disabled={isUpdatingName}
                            className="p-1 text-tactical-green hover:bg-tactical-green/10 rounded"
                          >
                            {isUpdatingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          </button>
                          <button 
                            onClick={() => setEditingSessionId(null)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <Play className="w-3 h-3 rotate-45" />
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-headline font-black text-tactical-green uppercase text-sm line-clamp-1">{session.name}</h4>
                      )}
                      <p className="text-[10px] text-gray-400 font-bold">{new Date(session.timestamp).toLocaleString()}</p>
                    </div>
                    <FolderOpen className="w-4 h-4 text-tactical-green/30 flex-shrink-0 ml-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <span className="text-gray-400 block">Quân nhân</span>
                      <span className="text-tactical-green">{session.totalSoldiers} người</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <span className="text-gray-400 block">Điểm TB</span>
                      <span className="text-tactical-green">{session.averageScore}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => exportToExcel(session.results, `Ket_qua_${session.name}`)}
                      className="flex-1 py-2 bg-white border border-tactical-green text-tactical-green rounded-lg font-headline font-black text-[9px] flex items-center justify-center gap-2 hover:bg-tactical-green hover:text-white transition-all active:scale-95"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      XUẤT EXCEL
                    </button>
                    <button 
                      onClick={() => {
                        setEditingSessionId(session.id);
                        setNewSessionName(session.name);
                      }}
                      className="flex-1 py-2 bg-white border border-tactical-blue text-tactical-blue rounded-lg font-headline font-black text-[9px] flex items-center justify-center gap-2 hover:bg-tactical-blue hover:text-white transition-all active:scale-95"
                      title="Sửa tên"
                    >
                      <Edit className="w-3 h-3" />
                      SỬA TÊN
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmId(session.id)}
                      className="px-3 py-2 bg-white border border-red-500 text-red-500 rounded-lg font-headline font-black text-[9px] flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                      title="Xóa phiên"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Save Session Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-4 bg-tactical-green text-tactical-accent flex justify-between items-center">
                <h3 className="font-headline font-black text-sm uppercase tracking-widest">Lưu phiên bắn</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-white/60 hover:text-white">
                  <Play className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tên phiên bắn / Bài bắn</label>
                  <input 
                    type="text" 
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="VD: Kiểm tra bắn đợt 1 - 2024"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-tactical-green outline-none font-sans font-semibold"
                  />
                </div>
                <div className="bg-tactical-green/5 p-4 rounded-xl border border-tactical-green/10">
                  <p className="text-[10px] text-tactical-green font-bold leading-relaxed">
                    * Lưu ý: Sau khi lưu phiên bắn, toàn bộ dữ liệu tạm thời và danh sách gọi tên hiện tại sẽ được xóa sạch để chuẩn bị cho phiên mới.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-headline font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleFinalSave}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-tactical-green text-tactical-accent rounded-xl font-headline font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Xác nhận lưu
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-headline font-black text-lg uppercase tracking-tight">XÁC NHẬN XÓA</h3>
              </div>
              
              <p className="text-gray-600 text-sm mb-6 font-medium">
                Bạn có chắc chắn muốn xóa phiên bắn này? Hành động này không thể hoàn tác.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-headline font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  HỦY BỎ
                </button>
                <button 
                  onClick={() => deleteHistorySession(deleteConfirmId)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-headline font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  XÁC NHẬN XÓA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
