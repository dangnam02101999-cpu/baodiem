import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, Star, TrendingUp, AlertTriangle, Download, Table as TableIcon, ChevronLeft, ChevronRight, Loader2, FileSpreadsheet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell as BarCell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { exportResultsToExcel } from '../lib/excelExport';
import { cn } from '../lib/utils';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { OperationType } from '../types';
import { Target4 } from '../components/Target4';
import { Target7 } from '../components/Target7';
import { Target8 } from '../components/Target8';

export default function ResultsView() {
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  useEffect(() => {
    // Listen to current_session_results for real-time updates of the ongoing session
    const q = query(collection(db, 'current_session_results'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedResults(results);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'current_session_results');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const COLORS = ['#dfe8a6', '#4a5d23', '#7a8d43', '#ff4d4d'];

  const [searchTerm, setSearchTerm] = useState('');

  const filteredResults = savedResults.filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.unit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: filteredResults.length,
    excellent: filteredResults.filter(r => r.classification === 'Giỏi').length,
    good: filteredResults.filter(r => r.classification === 'Khá').length,
    average: filteredResults.filter(r => r.classification === 'Đạt').length,
    fail: filteredResults.filter(r => r.classification === 'Không đạt').length,
  };

  const pieData = [
    { name: 'Giỏi', value: stats.excellent },
    { name: 'Khá', value: stats.good },
    { name: 'Đạt', value: stats.average },
    { name: 'Không đạt', value: stats.fail },
  ].filter(d => d.value > 0);

  const barData = [1, 2, 3, 4, 5, 6, 7, 8].map(lane => {
    const laneResults = savedResults.filter(r => r.lane === lane);
    const avg = laneResults.length > 0 
      ? laneResults.reduce((sum, r) => sum + r.total, 0) / laneResults.length 
      : 0;
    return { name: `Dải ${lane}`, score: parseFloat(avg.toFixed(1)) };
  });

  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tactical-green" />
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col p-4 md:p-8 space-y-6 overflow-y-auto no-scrollbar">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
          <button className="px-4 py-2 bg-tactical-green text-tactical-accent rounded-md text-xs font-black uppercase tracking-wider">Bài 1: Súng STV 380</button>
          <button className="px-4 py-2 text-gray-400 hover:text-tactical-green rounded-md text-xs font-black uppercase tracking-wider transition-colors">Bài 2: Nâng cao</button>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              if (savedResults.length === 0) return alert('Không có dữ liệu!');
              setIsExporting(true);
              try {
                await exportResultsToExcel(savedResults, 'Ket_qua_phien_ban_truc_tiep');
              } catch (error) {
                console.error('Export failed:', error);
                alert('Xuất file Excel thất bại!');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            XUẤT EXCEL
          </button>
        </div>
      </div>

      {/* Summary Stats Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-green">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">TỔNG QUÂN SỐ</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-tactical-green font-headline">{stats.total}</span>
            <span className="text-[10px] font-bold text-gray-400">NGƯỜI</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-accent">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">XẾP LOẠI GIỎI</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-tactical-green font-headline">{stats.excellent}</span>
            <span className="text-[10px] font-bold text-gray-400">({stats.total > 0 ? Math.round(stats.excellent/stats.total*100) : 0}%)</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-blue">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">XẾP LOẠI KHÁ</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-tactical-green font-headline">{stats.good}</span>
            <span className="text-[10px] font-bold text-gray-400">({stats.total > 0 ? Math.round(stats.good/stats.total*100) : 0}%)</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-tactical-danger">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">KHÔNG ĐẠT</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-tactical-danger font-headline">{stats.fail}</span>
            <span className="text-[10px] font-bold text-gray-400">({stats.total > 0 ? Math.round(stats.fail/stats.total*100) : 0}%)</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-headline font-black text-xs tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            TỶ LỆ PHÂN LOẠI
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-[10px] font-bold text-gray-600 uppercase">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-headline font-black text-xs tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
            <Star className="w-4 h-4" />
            ĐIỂM TRUNG BÌNH THEO DẢI
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                <YAxis fontSize={10} fontWeight="bold" />
                <Tooltip />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <BarCell key={`cell-${index}`} fill={entry.score > 24 ? '#4a5d23' : '#7a8d43'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Results Table */}
      <section className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-4 bg-[#e8e8e8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-headline font-black text-xs sm:text-sm tracking-widest text-tactical-green uppercase flex items-center gap-2">
            <TableIcon className="w-4 h-4" />
            BẢNG TÍNH CHI TIẾT
          </h3>
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              className="pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-[10px] sm:text-xs focus:ring-1 focus:ring-tactical-green focus:border-tactical-green outline-none w-full sm:w-48 md:w-64" 
              placeholder="Tìm kiếm quân nhân..." 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">STT</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">Họ và Tên</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">Cấp bậc</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">Chức vụ</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">Đơn vị</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase whitespace-nowrap">Dải</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Bia 4</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Bia 7</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Bia 8</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Tổng</th>
                <th className="px-4 py-3 font-headline text-[9px] font-black text-gray-500 uppercase text-center whitespace-nowrap">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    {searchTerm ? 'Không tìm thấy quân nhân phù hợp' : 'Chưa có kết quả trong phiên bắn hiện tại'}
                  </td>
                </tr>
              ) : (
                filteredResults.map((result, index) => (
                  <tr key={result.id} className="hover:bg-[#f3f3f3] transition-colors">
                    <td className="px-4 py-4 font-mono text-[10px] font-bold text-gray-400">{index + 1}</td>
                    <td className="px-4 py-4 font-bold text-sm text-[#1a1c1c]">{result.name}</td>
                    <td className="px-4 py-4 text-xs text-gray-600">{result.rank}</td>
                    <td className="px-4 py-4 text-xs text-gray-600">{result.position}</td>
                    <td className="px-4 py-4 text-xs text-gray-600">{result.unit}</td>
                    <td className="px-4 py-4 font-headline font-black text-tactical-green text-xs">DẢI {result.lane}</td>
                    <td 
                      className="px-4 py-4 text-center font-headline font-bold text-xs cursor-pointer hover:text-tactical-green hover:font-black"
                      onClick={() => setSelectedResult({ hits: result.hits?.target4, target: 4, name: result.name, lane: result.lane, scores: result.scores.target4.split('/') })}
                    >
                      {result.scores.target4}
                    </td>
                    <td 
                      className="px-4 py-4 text-center font-headline font-bold text-xs cursor-pointer hover:text-tactical-green hover:font-black"
                      onClick={() => setSelectedResult({ hits: result.hits?.target7, target: 7, name: result.name, lane: result.lane, scores: result.scores.target7.split('/') })}
                    >
                      {result.scores.target7}
                    </td>
                    <td 
                      className="px-4 py-4 text-center font-headline font-bold text-xs cursor-pointer hover:text-tactical-green hover:font-black"
                      onClick={() => setSelectedResult({ hits: result.hits?.target8, target: 8, name: result.name, lane: result.lane, scores: result.scores.target8.split('/') })}
                    >
                      {result.scores.target8}
                    </td>
                    <td className="px-4 py-4 text-center font-headline font-black text-tactical-green text-sm">{result.total}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={cn(
                        "px-2 py-1 text-[9px] font-black rounded-md uppercase tracking-tighter",
                        result.classification === 'Giỏi' ? "bg-tactical-accent text-tactical-green" :
                        result.classification === 'Khá' ? "bg-tactical-blue text-white" :
                        result.classification === 'Đạt' ? "bg-tactical-green-light text-tactical-accent" :
                        "bg-tactical-danger text-white"
                      )}>
                        {result.classification}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Result Visualization Modal */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-tactical-green p-4 text-tactical-accent flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-headline font-black text-lg uppercase tracking-tight">KẾT QUẢ BIA SỐ {selectedResult.target}</h3>
                  <p className="text-[10px] font-bold opacity-80 uppercase">
                    {selectedResult.name} — DẢI {selectedResult.lane}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </button>
              </div>
              
              <div className="flex-grow overflow-y-auto p-6 flex flex-col items-center gap-6">
                <div className="grid grid-cols-3 gap-4 w-full">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase mb-1">PHÁT BẮN {i+1}</span>
                      <span className="text-2xl font-black text-tactical-green">
                        {selectedResult.scores?.[i] ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={cn(
                  "relative w-full border-4 border-gray-100 rounded-2xl overflow-hidden bg-white shadow-inner mx-auto",
                  selectedResult.target === 4 ? "max-w-[400px] aspect-[636/572]" : 
                  selectedResult.target === 7 ? "max-w-[300px] aspect-[600/900]" : 
                  "max-w-[300px] aspect-[600/1200]"
                )}>
                  {selectedResult.target === 4 && <Target4 className="w-full h-full" />}
                  {selectedResult.target === 7 && <Target7 className="w-full h-full" />}
                  {selectedResult.target === 8 && <Target8 className="w-full h-full" />}
                  
                  {/* Hit Markers */}
                  {(selectedResult.hits || []).map((hit: any, i: number) => hit && (
                    <div 
                      key={i}
                      className={cn(
                        "absolute w-6 h-6 sm:w-8 sm:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] sm:text-xs shadow-xl z-30",
                        "bg-tactical-green text-tactical-accent"
                      )}
                      style={{ 
                        left: `${50 + hit.x}%`, 
                        top: `${(selectedResult.target === 4 ? 52.45 : selectedResult.target === 7 ? 27.78 : 29.17) + hit.y}%` 
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                  
                  {(!selectedResult.hits || selectedResult.hits.every((h: any) => !h)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-[2px]">
                      <p className="text-gray-400 font-headline font-black text-[10px] uppercase tracking-widest bg-white/80 px-4 py-2 rounded-full shadow-sm border border-gray-100">
                        KHÔNG CÓ DỮ LIỆU ĐIỂM CHẠM
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="px-6 py-2 bg-tactical-green text-tactical-accent rounded-xl font-headline font-black text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                  ĐÓNG
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
