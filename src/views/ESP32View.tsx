import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Send, Volume2, History, Radio, Loader2, FileSpreadsheet, CheckCircle, AlertTriangle, Trash2, Link, Users, Target, Award, TrendingUp, Activity, Star } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend, PieChart, Pie } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { OperationType } from '../types';
import { playTts, initAudio } from '../lib/audio';
import { MOCK_SOLDIERS } from '../constants';

type ESPTab = 'POINTS' | 'AUDIO';

function parseCSV(text: string, delimiter: string = ','): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\n' || char === '\r') {
        row.push(currentVal.trim());
        currentVal = '';
        if (row.length > 0 || (char === '\n' && text[i-1] !== '\r')) {
          lines.push(row);
          row = [];
        }
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip the line feed
        }
      } else {
        currentVal += char;
      }
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  return lines;
}

export default function ESP32View() {
  const [activeTab, setActiveTab] = useState<ESPTab>('POINTS');
  const [results, setResults] = useState<any[]>([]);
  const [shootingQueue, setShootingQueue] = useState<any[]>([]);
  const [sessionResults, setSessionResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Google Sheets integration state
  const [sheetUrl, setSheetUrl] = useState('');
  const [importedData, setImportedData] = useState<any[] | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSuccess, setSheetSuccess] = useState(false);

  const handleSyncGoogleSheet = async () => {
    if (!sheetUrl) {
      setSheetError('Vui lòng nhập đường dẫn Google Sheet');
      return;
    }

    setIsSyncingSheet(true);
    setSheetError(null);
    setSheetSuccess(false);

    try {
      let csvUrl = '';
      if (sheetUrl.includes('/pub') || sheetUrl.includes('output=csv')) {
        csvUrl = sheetUrl;
      } else {
        const docIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!docIdMatch) {
          throw new Error('Đường dẫn Google Sheet không hợp lệ. Vui lòng định dạng đúng, ví dụ: https://docs.google.com/spreadsheets/d/.../edit');
        }

        const spreadsheetId = docIdMatch[1];
        const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : null;

        csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        if (gid) {
          csvUrl += `&gid=${gid}`;
        }
      }

      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error('Không thể tải dữ liệu từ Google Sheet. Hãy chắc chắn rằng trang tính đã được thiết lập quyền "Bất kỳ ai có liên kết đều có thể xem" (Anyone with link can view).');
      }

      const text = await res.text();
      if (!text || text.trim() === '') {
        throw new Error('Dữ liệu Google Sheet rỗng hoặc không đúng định dạng.');
      }

      // Detect separator
      let separator = ',';
      const sample = text.slice(0, 1000);
      const commaCount = (sample.match(/,/g) || []).length;
      const semicolonCount = (sample.match(/;/g) || []).length;
      if (semicolonCount > commaCount) {
        separator = ';';
      }

      const rows = parseCSV(text, separator);
      if (rows.length === 0) {
        throw new Error('Không có dòng dữ liệu nào được phát hiện trong Google Sheet.');
      }

      // Detect columns
      let startRowIdx = 0;
      let indexSTT = -1;
      let indexName = -1;
      let indexRank = -1;
      let indexPosition = -1;
      let indexUnit = -1;
      let indexLane = -1;
      let indexBia4 = -1;
      let indexBia7 = -1;
      let indexBia8 = -1;
      let indexTotal = -1;

      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r];
        const normalizedRow = row.map(c => c.toLowerCase().normalize("NFC").trim());
        const hasName = normalizedRow.some(c => 
          c.includes("họ") || 
          c.includes("tên") || 
          c.includes("vdv") || 
          c.includes("ho ten") || 
          c.includes("quân nhân") || 
          c.includes("quan nhan") || 
          c.includes("name")
        );
        if (hasName) {
          startRowIdx = r + 1;
          normalizedRow.forEach((col, cIdx) => {
            if (col === 'stt' || col.includes('số thứ tự') || col === 'no' || col === 'id') {
              indexSTT = cIdx;
            } else if (col.includes('họ') || col.includes('tên') || col === 'name' || col.includes('ho ten') || col.includes('quân nhân') || col.includes('quan nhan')) {
              indexName = cIdx;
            } else if (col.includes('cấp bậc') || col.includes('cap bac') || col === 'rank' || col.includes('cấp')) {
              indexRank = cIdx;
            } else if (col.includes('chức vụ') || col.includes('chuc vu') || col === 'position' || col.includes('vụ')) {
              indexPosition = cIdx;
            } else if (col.includes('đơn vị') || col.includes('don vi') || col === 'unit' || col.includes('bộ phận')) {
              indexUnit = cIdx;
            } else if (col.includes('dải') || col.includes('dai') || col === 'lane') {
              indexLane = cIdx;
            } else if (col.includes('bia 4') || col.includes('bia số 4') || col.includes('bia so 4') || col === 'b4' || col === 'target4' || col.includes('bia4')) {
              indexBia4 = cIdx;
            } else if (col.includes('bia 7') || col.includes('bia số 7') || col.includes('bia so 7') || col === 'b7' || col === 'target7' || col.includes('bia7')) {
              indexBia7 = cIdx;
            } else if (col.includes('bia 8') || col.includes('bia số 8') || col.includes('bia so 8') || col === 'b8' || col === 'target8' || col.includes('bia8')) {
              indexBia8 = cIdx;
            } else if (col.includes('tổng điểm') || col.includes('tong diem') || col === 'tong' || col.includes('tổng') || col === 'total' || col.includes('điểm')) {
              indexTotal = cIdx;
            }
          });
          break;
        }
      }

      const mappedEmployees: any[] = [];
      const parseNumValue = (val: string) => {
        if (!val) return 0;
        if (val.includes('/')) {
          return val.split('/').reduce((sum, v) => sum + (parseInt(v.trim()) || 0), 0);
        }
        return parseInt(val) || 0;
      };

      for (let r = startRowIdx; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const cleanedRow = row.map(v => v.trim());

        // Find STT or fallback to sequence number
        const sttValStr = indexSTT !== -1 && indexSTT < cleanedRow.length ? cleanedRow[indexSTT] : cleanedRow[0];
        const sttVal = parseInt(sttValStr) || (mappedEmployees.length + 1);

        const laneValStr = indexLane !== -1 && indexLane < cleanedRow.length ? cleanedRow[indexLane] : '';
        const laneVal = laneValStr ? (parseInt(laneValStr.replace(/[^0-9]/g, '')) || ((mappedEmployees.length % 8) + 1)) : ((mappedEmployees.length % 8) + 1);
        
        const b4Val = indexBia4 !== -1 && indexBia4 < cleanedRow.length ? cleanedRow[indexBia4] : '-/-/-';
        const b7Val = indexBia7 !== -1 && indexBia7 < cleanedRow.length ? cleanedRow[indexBia7] : '-/-/-';
        const b8Val = indexBia8 !== -1 && indexBia8 < cleanedRow.length ? cleanedRow[indexBia8] : '-/-/-';

        mappedEmployees.push({
          stt: sttVal,
          lane: laneVal,
          target4: b4Val,
          target7: b7Val,
          target8: b8Val,
        });
      }

      if (mappedEmployees.length === 0) {
        throw new Error('Không thể phân tích dữ liệu nào từ Google Sheet.');
      }

      // Map the imported scores onto the existing admin-entered queue:
      const mergedData = shootingQueue.map((soldier, idx) => {
        const targetSTT = idx + 1;
        // Search parsed Google Sheet rows for a matching STT, or fall back to sequence index idx
        const sheetMatch = mappedEmployees.find(e => e.stt === targetSTT) || mappedEmployees[idx];

        if (sheetMatch) {
          const t4 = parseNumValue(sheetMatch.target4);
          const t7 = parseNumValue(sheetMatch.target7);
          const t8 = parseNumValue(sheetMatch.target8);
          // Total is strictly calculated offline, NOT synchronized from the Google Sheet
          const totalVal = t4 + t7 + t8;
          // Classification is strictly computed based on calculated total
          const classificationVal = totalVal > 0 ? getClassification(totalVal) : '---';

          return {
            ...soldier,
            stt: targetSTT,
            lane: sheetMatch.lane || soldier.lane || ((idx % 8) + 1),
            target4: sheetMatch.target4 || '-/-/-',
            target7: sheetMatch.target7 || '-/-/-',
            target8: sheetMatch.target8 || '-/-/-',
            total: totalVal,
            classification: classificationVal
          };
        } else {
          // If no sheet matches, keep default/current scores
          const lane = soldier.lane || ((idx % 8) + 1);
          const turnIdx = Math.floor(idx / 8);
          const scores = getSoldierScores(soldier, lane, turnIdx);

          return {
            ...soldier,
            stt: targetSTT,
            lane: lane,
            target4: scores.target4,
            target7: scores.target7,
            target8: scores.target8,
            total: scores.total,
            classification: scores.classification
          };
        }
      });

      setImportedData(mergedData);
      setSheetSuccess(true);
    } catch (err: any) {
      console.error(err);
      setSheetError(err.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  useEffect(() => {
    // Synchronize with raw real-time target hits
    const qResults = query(collection(db, 'shooting_results'), orderBy('timestamp', 'desc'));
    const unsubscribeResults = onSnapshot(qResults, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_results');
    });

    // Synchronize with shooting queue list (active turns managed by clerk/admin)
    const qQueue = query(collection(db, 'shooting_queue'), orderBy('order', 'asc'));
    const unsubscribeQueue = onSnapshot(qQueue, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fallback to MOCK_SOLDIERS exactly like clerk/secretary view for consistent data
      setShootingQueue(data.length > 0 ? data : MOCK_SOLDIERS.map(s => ({ ...s, isMock: true })));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_queue');
      setIsLoading(false);
    });

    // Synchronize with current session results for completed/saved turns
    const qSession = query(collection(db, 'current_session_results'));
    const unsubscribeSession = onSnapshot(qSession, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessionResults(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'current_session_results');
    });

    return () => {
      unsubscribeResults();
      unsubscribeQueue();
      unsubscribeSession();
    };
  }, []);

  const handlePreviewTurn = async (turnIdx: number, chunk: any[]) => {
    initAudio();
    let phrase = `Lượt bắn thứ ${turnIdx + 1}. `;
    chunk.forEach((s, i) => {
      if (s && s.name) {
        phrase += `Dải ${i + 1}: ${s.name}. `;
      }
    });
    await playTts(phrase);
  };

  const getClassification = (total: number) => {
    if (total >= 72) return 'Giỏi';
    if (total >= 55) return 'Khá';
    if (total >= 45) return 'Đạt';
    return 'Không đạt';
  };

  // Determine which round index is currently active
  const getActiveRoundIdx = () => {
    for (let t = 0; t < Math.ceil(shootingQueue.length / 8); t++) {
      const chunk = shootingQueue.slice(t * 8, (t + 1) * 8);
      if (chunk.some(soldier => soldier.status !== 'Completed')) {
        return t;
      }
    }
    return 0;
  };

  const activeRoundIdx = getActiveRoundIdx();

  const getSummaryStats = () => {
    const list = importedData || shootingQueue;
    const totalSoldiers = list.length;
    let completedCount = 0;
    let totalPoints = 0;

    const parseScoreString = (scoreStr: any) => {
      if (scoreStr === undefined || scoreStr === null) return 0;
      if (typeof scoreStr === 'number') return scoreStr;
      const str = String(scoreStr).trim();
      if (!str || str === '-/-/-' || str === '---') return 0;
      if (str.includes('/')) {
        return str.split('/').reduce((acc, current) => {
          const parsed = parseInt(current.trim());
          return acc + (isNaN(parsed) ? 0 : parsed);
        }, 0);
      }
      return parseInt(str) || 0;
    };

    const processedList: any[] = [];
    list.forEach((soldier, idx) => {
      let lane = (idx % 8) + 1;
      let scoreObj;
      if (importedData) {
        const t4 = parseScoreString(soldier.target4);
        const t7 = parseScoreString(soldier.target7);
        const t8 = parseScoreString(soldier.target8);
        const total = soldier.total ?? (t4 + t7 + t8);
        const classification = soldier.classification || (total > 0 ? getClassification(total) : '---');
        const hasShot = total > 0;
        lane = Number(soldier.lane) || ((idx % 8) + 1);

        scoreObj = {
          total,
          classification,
          lane,
          hasShot
        };
      } else {
        lane = (idx % 8) + 1;
        const turnIdx = Math.floor(idx / 8);
        const fetchedScores = getSoldierScores(soldier, lane, turnIdx);

        scoreObj = {
          total: fetchedScores.total,
          classification: fetchedScores.classification,
          lane,
          hasShot: fetchedScores.total > 0 || fetchedScores.isSaved || fetchedScores.classification !== '---'
        };
      }
      processedList.push(scoreObj);
    });

    processedList.forEach(r => {
      if (r.hasShot) {
        completedCount++;
        totalPoints += r.total;
      }
    });

    const excellent = processedList.filter(r => r.hasShot && r.classification === 'Giỏi').length;
    const good = processedList.filter(r => r.hasShot && r.classification === 'Khá').length;
    const average = processedList.filter(r => r.hasShot && r.classification === 'Đạt').length;
    const fail = processedList.filter(r => r.hasShot && r.classification === 'Không đạt').length;

    const avgScore = completedCount > 0 ? (totalPoints / completedCount).toFixed(1) : '0';
    const qualifyCount = excellent + good + average;
    const qualifyRate = completedCount > 0 ? ((qualifyCount / completedCount) * 100).toFixed(0) : '0';

    const pieData = [
      { name: 'Giỏi', value: excellent },
      { name: 'Khá', value: good },
      { name: 'Đạt', value: average },
      { name: 'Không đạt', value: fail }
    ].filter(d => d.value > 0);

    const barData = [1, 2, 3, 4, 5, 6, 7, 8].map(l => {
      const laneResults = processedList.filter(r => r.hasShot && r.lane === l);
      const avg = laneResults.length > 0 
        ? laneResults.reduce((sum, r) => sum + r.total, 0) / laneResults.length 
        : 0;
      return { name: `Dải ${l}`, score: parseFloat(avg.toFixed(1)) };
    });

    return {
      totalSoldiers,
      completedCount,
      avgScore,
      qualifyRate,
      excellent,
      good,
      average,
      fail,
      pieData,
      barData
    };
  };

  const getSoldierScores = (s: any, lane: number, turnIdx: number) => {
    // 1. Check if there are saved results in current_session_results
    const saved = sessionResults.find(r => r.name === s.name);
    if (saved) {
      return {
        target4: saved.scores?.target4 || '-/-/-',
        target7: saved.scores?.target7 || '-/-/-',
        target8: saved.scores?.target8 || '-/-/-',
        total: saved.total ?? 0,
        classification: saved.classification || '---',
        isSaved: true
      };
    }

    // 2. Otherwise if this is the active turn, provide live scores from shooting_results
    if (turnIdx === activeRoundIdx) {
      const getLiveScore = (l: number, target: number) => {
        const laneResults = results.filter(r => r.lane === l && r.target === target);
        if (laneResults.length === 0) return '-/-/-';
        const latest = laneResults[0];
        return latest.scores.map((pt: any) => pt === null ? '-' : pt).join('/');
      };

      const getLiveSum = (l: number, target: number) => {
        const laneResults = results.filter(r => r.lane === l && r.target === target);
        if (laneResults.length === 0) return 0;
        return laneResults[0].scores.reduce((acc: number, pt: any) => acc + (pt || 0), 0);
      };

      const sum4 = getLiveSum(lane, 4);
      const sum7 = getLiveSum(lane, 7);
      const sum8 = getLiveSum(lane, 8);
      const total = sum4 + sum7 + sum8;

      return {
        target4: getLiveScore(lane, 4),
        target7: getLiveScore(lane, 7),
        target8: getLiveScore(lane, 8),
        total,
        classification: total > 0 ? getClassification(total) : '---',
        isSaved: false
      };
    }

    // 3. Otherwise, pending / not started yet
    return {
      target4: '-/-/-',
      target7: '-/-/-',
      target8: '-/-/-',
      total: 0,
      classification: '---',
      isSaved: false
    };
  };

  // Turn shootingQueue into chunks of 8 (8 lanes per round)
  const chunks = [];
  for (let i = 0; i < shootingQueue.length; i += 8) {
    chunks.push(shootingQueue.slice(i, i + 8));
  }

  const stats = activeTab === 'POINTS' ? getSummaryStats() : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-tactical-green/10 rounded-xl">
            <Cpu className="text-tactical-green w-6 h-6" />
          </div>
          <div>
            <h1 className="font-headline font-black text-xl text-gray-900 uppercase">Đối soát gửi điểm & gọi tên (ESP32)</h1>
            <p className="text-xs text-gray-500 font-medium">Bảng thông tin đồng bộ thời gian thực với trung tâm giám sát thư ký</p>
          </div>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-full max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('POINTS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'POINTS' ? 'bg-white shadow-sm text-tactical-green' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send className="w-4 h-4" />
          KẾT QUẢ BẮN
        </button>
        <button
          onClick={() => setActiveTab('AUDIO')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'AUDIO' ? 'bg-white shadow-sm text-tactical-green' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          GỌI TÊN
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'POINTS' ? (
          <motion.div
            key="points"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            className="space-y-6"
          >
            {/* Table of Shooting Participants */}
            {isLoading ? (
              <div className="p-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-gray-500 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-tactical-green" />
                <span className="text-xs font-bold uppercase tracking-wider">Đang đồng bộ danh sách trực tiếp...</span>
              </div>
            ) : shootingQueue.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl text-center text-gray-400 text-xs font-bold uppercase italic border border-gray-100">
                Không tìm thấy danh sách quân nhân trong lượt bắn
              </div>
            ) : (
              <>
                {/* BẢNG TỔNG HỢP KẾT QUẢ BẮN & BIỂU ĐỒ */}
                {stats && (
                  <div className="space-y-6">
                    {/* Summary Stats Bento Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Tổng quân số */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-green">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">TỔNG QUÂN SỐ</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-tactical-green font-headline">{stats.totalSoldiers}</span>
                          <span className="text-[10px] font-bold text-gray-400">NGƯỜI</span>
                        </div>
                      </div>
                      {/* Xếp loại Giỏi */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-accent">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">XẾP LOẠI GIỎI</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-tactical-green font-headline">{stats.excellent}</span>
                          <span className="text-[10px] font-bold text-gray-400">({stats.completedCount > 0 ? Math.round(stats.excellent/stats.completedCount*100) : 0}%)</span>
                        </div>
                      </div>
                      {/* Xếp loại Khá */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-blue">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">XẾP LOẠI KHÁ</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-tactical-green font-headline">{stats.good}</span>
                          <span className="text-[10px] font-bold text-gray-400">({stats.completedCount > 0 ? Math.round(stats.good/stats.completedCount*100) : 0}%)</span>
                        </div>
                      </div>
                      {/* Không đạt */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-danger">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">KHÔNG ĐẠT</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-tactical-danger font-headline">{stats.fail}</span>
                          <span className="text-[10px] font-bold text-gray-400">({stats.completedCount > 0 ? Math.round(stats.fail/stats.completedCount*100) : 0}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Biểu đồ phân tích */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Tỷ lệ phân loại (PieChart) */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-headline font-black text-xs tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          TỶ LỆ PHÂN LOẠI
                        </h3>
                        {stats.completedCount === 0 ? (
                          <div className="h-[250px] flex items-center justify-center text-xs text-gray-400 font-medium italic">
                            Chưa có dữ liệu để hiển thị biểu đồ tỷ lệ phân loại
                          </div>
                        ) : (
                          <>
                            <div className="h-[250px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={stats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {stats.pieData.map((entry: any, index: number) => {
                                      const colorMap: Record<string, string> = {
                                        'Giỏi': '#dfe8a6',
                                        'Khá': '#4a5d23',
                                        'Đạt': '#7a8d43',
                                        'Không đạt': '#ff4d4d'
                                      };
                                      return (
                                        <Cell key={`cell-${index}`} fill={colorMap[entry.name] || '#cbd5e1'} />
                                      );
                                    })}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                              {stats.pieData.map((entry: any, index: number) => {
                                const colorMap: Record<string, string> = {
                                  'Giỏi': '#dfe8a6',
                                  'Khá': '#4a5d23',
                                  'Đạt': '#7a8d43',
                                  'Không đạt': '#ff4d4d'
                                };
                                return (
                                  <div key={entry.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[entry.name] || '#cbd5e1' }}></div>
                                    <span className="text-[10px] font-bold text-gray-600 uppercase">{entry.name}: {entry.value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Điểm trung bình theo dải (BarChart, Dải 1 - 8) */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-headline font-black text-xs tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          ĐIỂM TRUNG BÌNH THEO DẢI
                        </h3>
                        {stats.completedCount === 0 ? (
                          <div className="h-[250px] flex items-center justify-center text-xs text-gray-400 font-medium italic">
                            Chưa có dữ liệu để hiển thị biểu đồ dải điểm
                          </div>
                        ) : (
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stats.barData}>
                                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                                <YAxis fontSize={10} fontWeight="bold" />
                                <Tooltip />
                                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                  {stats.barData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.score > 24 ? '#4a5d23' : '#7a8d43'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* DANH SÁCH BẮN */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-tactical-green uppercase tracking-wider">
                    Danh sách quân nhân đối soát điểm bắn
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">
                    Tổng số: {shootingQueue.length} quân nhân
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100/50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-100">
                        <th className="py-3 px-3 w-12 text-center">STT</th>
                        <th className="py-3 px-4">Họ và tên</th>
                        <th className="py-3 px-4">Cấp bậc</th>
                        <th className="py-3 px-4">Chức vụ</th>
                        <th className="py-3 px-4">Đơn vị</th>
                        <th className="py-3 px-3 text-center">Dải bắn</th>
                        <th className="py-3 px-3 text-center">Bia số 4</th>
                        <th className="py-3 px-3 text-center">Bia số 7</th>
                        <th className="py-3 px-3 text-center">Bia số 8</th>
                        <th className="py-3 px-3 text-center bg-tactical-green/5 text-tactical-green">Tổng điểm</th>
                        <th className="py-3 px-3 text-center">Xếp loại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(importedData || shootingQueue).map((soldier, idx) => {
                        const stt = idx + 1;

                        if (importedData) {
                          const item = soldier;
                          return (
                            <tr 
                              key={idx} 
                              className="hover:bg-gray-50/50 transition-colors bg-green-50/5"
                            >
                              <td className="py-3 px-3 text-center font-bold text-gray-400">
                                {item.stt || stt}
                              </td>
                              <td className="py-3 px-4 font-bold text-gray-950 uppercase">
                                {item.name}
                              </td>
                              <td className="py-3 px-4 text-gray-700">{item.rank || '---'}</td>
                              <td className="py-3 px-4 text-gray-700">{item.position || '---'}</td>
                              <td className="py-3 px-4 text-gray-700">{item.unit || '---'}</td>
                              <td className="py-3 px-3 text-center font-black text-tactical-green">
                                Dải {item.lane || ((idx % 8) + 1)}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-gray-800">{item.target4}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-gray-800">{item.target7}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-gray-800">{item.target8}</td>
                              <td className="py-3 px-3 text-center font-black text-tactical-green bg-tactical-green/5 text-sm">{item.total}</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-center ${
                                  item.classification === 'Giỏi' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                  item.classification === 'Khá' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  item.classification === 'Đạt' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  item.classification === 'Không đạt' ? 'bg-red-100 text-red-800 border border-red-200' :
                                  'bg-gray-100 text-gray-400'
                                }`}>
                                  {item.classification || '---'}
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        const lane = (idx % 8) + 1;
                        const turnIdx = Math.floor(idx / 8);
                        const scores = getSoldierScores(soldier, lane, turnIdx);
                        const isCurrentlyShooting = turnIdx === activeRoundIdx;

                        return (
                          <tr 
                            key={soldier.id || idx} 
                            className={`hover:bg-gray-50/50 transition-colors ${
                              isCurrentlyShooting ? 'bg-amber-50/40 relative font-medium' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-bold text-gray-400">
                              {stt}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-900 uppercase">
                              <div className="flex items-center gap-1.5">
                                {soldier.name}
                                {isCurrentlyShooting && (
                                  <span className="inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Đang bắn" />
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{soldier.rank || '---'}</td>
                            <td className="py-3 px-4 text-gray-600">{soldier.position || '---'}</td>
                            <td className="py-3 px-4 text-gray-600">{soldier.unit || '---'}</td>
                            <td className="py-3 px-3 text-center font-black text-tactical-green">Dải {lane}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">{scores.target4}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">{scores.target7}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">{scores.target8}</td>
                            <td className="py-3 px-3 text-center font-black text-tactical-green bg-tactical-green/5 text-sm">{scores.total}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-center ${
                                scores.classification === 'Giỏi' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                scores.classification === 'Khá' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                scores.classification === 'Đạt' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                scores.classification === 'Không đạt' ? 'bg-red-100 text-red-800 border border-red-200' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                                {scores.classification}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}

            {/* GOOGLE SHEETS INTEGRATION CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-50 rounded-xl text-tactical-green">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-sm text-gray-900 uppercase tracking-wide">Nhập kết quả từ Google Sheets</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Lấy kết quả dải bắn, bia số 4, 7, 8 và tổng điểm tự động vào danh sách theo số thứ tự</p>
                  </div>
                </div>
                {importedData && (
                  <button
                    onClick={() => {
                      setImportedData(null);
                      setSheetSuccess(false);
                      setSheetUrl('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase hover:bg-red-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    XÓA DỮ LIỆU NHẬP
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="Dán đường dẫn chia sẻ Google Sheet tại đây... (Ví dụ: https://docs.google.com/spreadsheets/d/...)"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-tactical-green focus:ring-2 focus:ring-tactical-green/10 rounded-xl text-xs text-gray-900 placeholder-gray-400 font-medium outline-none transition-all"
                    />
                  </div>
                  <button
                    disabled={isSyncingSheet}
                    onClick={handleSyncGoogleSheet}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-tactical-green hover:bg-tactical-green-light active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-tactical-green/10 disabled:opacity-60 cursor-pointer"
                  >
                    {isSyncingSheet ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        ĐANG ĐỒNG BỘ...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        ĐỒNG BỘ ĐIỂM
                      </>
                    )}
                  </button>
                </div>

                {/* Note & guide */}
                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Hướng dẫn chuẩn bị bảng tính:</h4>
                  <ul className="list-disc pl-4 text-[10px] text-gray-500 font-medium space-y-1">
                    <li>Bật chế độ chia sẻ Google Sheet: <strong>Bất kỳ ai có liên kết đều có thể xem (Anyone with the link can view)</strong>.</li>
                    <li>Hệ thống tự động nhận dạng tiêu đề cột: <strong>"Họ và tên"</strong>, <strong>"Cấp bậc"</strong>, <strong>"Dải bắn"</strong>, <strong>"Bia số 4"</strong>, <strong>"Bia số 7"</strong>, <strong>"Bia số 8"</strong>, <strong>"Tổng điểm"</strong>.</li>
                    <li>Sắp xếp đúng theo số thứ tự của quân nhân để đối soát chính xác nhất.</li>
                  </ul>
                </div>

                {sheetError && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl animate-fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{sheetError}</span>
                  </div>
                )}

                {sheetSuccess && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-green-50 border border-green-100 text-tactical-green text-xs font-semibold rounded-xl animate-fade-in">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Đồng bộ thành công! Đã tải và hiển thị dữ liệu đối soát của {importedData?.length} quân nhân từ Google Sheets lên danh sách theo đúng số thứ tự.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="audio"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="space-y-6"
          >
            {/* Audio Broadcast Control */}
            <div className="bg-[#1a1c1c] p-6 rounded-2xl border border-white/5 flex flex-col lg:flex-row items-center justify-between gap-6 text-white shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-tactical-green/20 rounded-2xl border border-tactical-green/30">
                  <Volume2 className="text-tactical-accent w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg uppercase leading-none">Hệ thống âm thanh gọi tên</h3>
                  <p className="text-xs font-semibold text-gray-400 mt-2">Dữ liệu âm thanh tên người bắn đã được đồng bộ với máy thư ký</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1c1c] rounded-2xl overflow-hidden border border-white/5 h-full flex flex-col text-white">
              <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-tactical-accent" />
                  <h3 className="font-headline font-bold text-xs tracking-widest uppercase">Danh sách âm thanh tên VĐV</h3>
                </div>
                <span className="text-[10px] text-tactical-green font-black uppercase tracking-tighter">
                  {shootingQueue.length} VĐV ĐÃ ĐỒNG BỘ
                </span>
              </div>
              
              <div className="p-4 space-y-6">
                {isLoading ? (
                  <div className="p-8 flex justify-center items-center text-gray-500 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-tactical-green" />
                    <span className="text-xs font-bold uppercase">Đang tải danh sách...</span>
                  </div>
                ) : chunks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs font-bold uppercase italic">
                    Chưa có danh sách quân nhân
                  </div>
                ) : (
                  chunks.map((chunk, turnIdx) => {
                    return (
                      <div key={turnIdx} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="h-px bg-white/10 flex-1" />
                            <span className="text-[10px] font-black text-tactical-accent uppercase tracking-[0.2em]">
                              Lượt bắn {turnIdx + 1}
                            </span>
                            <div className="h-px bg-white/10 flex-1" />
                          </div>
                          <button 
                            onClick={() => handlePreviewTurn(turnIdx, chunk)}
                            className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-tactical-accent/20 border border-tactical-accent/30 rounded text-[9px] font-black text-tactical-accent hover:bg-tactical-accent hover:text-black transition-all"
                          >
                            <Volume2 className="w-3 h-3" />
                            GỌI TÊN TOÀN LƯỢT ({turnIdx + 1}.mp3)
                          </button>
                        </div>
                        
                        <table className="w-full text-left text-[11px] border-collapse bg-white/[0.02] rounded-lg overflow-hidden border border-white/5">
                          <thead className="bg-white/5 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                            <tr>
                              <th className="px-3 py-2 w-14">Dải</th>
                              <th className="px-3 py-2">Họ và tên</th>
                              <th className="px-3 py-2 text-right">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((lane) => {
                              const s = chunk[lane - 1];
                              const absoluteIdx = turnIdx * 8 + (lane - 1);
                              
                              if (!s && absoluteIdx >= shootingQueue.length) return null;

                              return (
                                <tr key={lane} className="hover:bg-white/5 transition-colors group">
                                  <td className="px-3 py-3 text-tactical-accent font-black">Dải {lane}</td>
                                  <td className="px-3 py-3 text-white font-bold uppercase tracking-wide group-hover:text-tactical-accent transition-colors">
                                    {s ? s.name : <span className="opacity-20 italic">---</span>}
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    {s ? (
                                      <span className="px-2 py-0.5 bg-tactical-green/20 border border-tactical-green/30 text-tactical-green rounded text-[8px] font-black uppercase">
                                        Ready
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
