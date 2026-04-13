import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, UploadCloud, Save, Edit, Trash2, Printer, ChevronDown, Verified, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { MOCK_SOLDIERS, RANKS } from '../constants';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { OperationType } from '../types';

export default function ManagementView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [rank, setRank] = useState(RANKS[0]);
  const [position, setPosition] = useState('');
  const [unit, setUnit] = useState('');
  const [soldiers, setSoldiers] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    // Real-time listener for shooting queue in Firestore, ordered by 'order'
    const q = query(collection(db, 'shooting_queue'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSoldiers(data);
      setIsSyncing(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_queue');
    });

    return () => unsubscribe();
  }, []);

  const handleAddSoldier = async () => {
    if (!name || !position || !unit) {
      alert('Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    const id = Date.now().toString();
    
    // Calculate next order
    const maxOrder = soldiers.length > 0 
      ? Math.max(...soldiers.map(s => s.order || 0)) 
      : 0;

    const newSoldier = {
      id,
      name,
      rank,
      position,
      unit,
      status: 'Pending' as const,
      shootingId: `S${Math.floor(Math.random() * 10000)}`,
      order: editingId ? (soldiers.find(s => s.id === editingId)?.order || maxOrder + 1) : maxOrder + 1
    };
    
    try {
      if (editingId) {
        const path = `shooting_queue/${editingId}`;
        await setDoc(doc(db, 'shooting_queue', editingId), {
          ...newSoldier,
          id: editingId // Keep original ID
        });
        alert('Đã cập nhật thông tin quân nhân!');
        setEditingId(null);
      } else {
        const path = `shooting_queue/${id}`;
        await setDoc(doc(db, 'shooting_queue', id), newSoldier);
        alert('Đã thêm quân nhân mới!');
      }
      setName('');
      setPosition('');
      setUnit('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'shooting_queue');
    }
  };

  const handleEditSoldier = (soldier: any) => {
    setEditingId(soldier.id);
    setName(soldier.name);
    setRank(soldier.rank);
    setPosition(soldier.position);
    setUnit(soldier.unit);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSoldier = async (id: string) => {
    const path = `shooting_queue/${id}`;
    try {
      await deleteDoc(doc(db, 'shooting_queue', id));
      // No alert needed for delete to keep it fast, or use a non-blocking UI
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const batch = writeBatch(db);
      soldiers.forEach(s => {
        batch.delete(doc(db, 'shooting_queue', s.id));
      });
      await batch.commit();
      setShowDeleteAllConfirm(false);
      alert('Đã xóa toàn bộ danh sách quân nhân!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'shooting_queue_all');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const processExcelFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      const batch = writeBatch(db);
      let count = 0;
      
      // Calculate starting order for new batch
      const currentMaxOrder = soldiers.length > 0 
        ? Math.max(...soldiers.map(s => s.order || 0)) 
        : 0;

      // Sort JSON by STT if provided
      const sortedJson = [...json].sort((a: any, b: any) => {
        const sttA = parseInt(a['STT'] || a['stt'] || 0);
        const sttB = parseInt(b['STT'] || b['stt'] || 0);
        return sttA - sttB;
      });

      sortedJson.forEach((row: any, index: number) => {
        const name = row['họ và tên'] || row['Họ và Tên'] || row['Name'] || row['Họ tên'];
        const rank = row['cấp bậc'] || row['Cấp bậc'] || row['Rank'];
        const position = row['chức vụ'] || row['Chức vụ'] || row['Position'];
        const unit = row['đơn vị'] || row['Đơn vị'] || row['Unit'];
        const excelStt = parseInt(row['STT'] || row['stt'] || 0);

        if (name) {
          const id = `${Date.now()}-${Math.random()}`;
          const soldier = {
            id,
            name,
            rank: rank || 'Binh nhì',
            position: position || 'Chiến sĩ',
            unit: unit || '---',
            status: 'Pending',
            shootingId: `S${Math.floor(Math.random() * 10000)}`,
            order: currentMaxOrder + (excelStt || (index + 1))
          };
          batch.set(doc(db, 'shooting_queue', id), soldier);
          count++;
        }
      });

      if (count > 0) {
        try {
          await batch.commit();
          alert(`Đã nhập thành công ${count} quân nhân!`);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'shooting_queue_batch');
        }
      } else {
        alert('Không tìm thấy dữ liệu hợp lệ trong file Excel.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processExcelFile(file);
  };

  const handleExcelImportClick = () => {
    fileInputRef.current?.click();
  };

  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('shooting_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('shooting_history', JSON.stringify(history));
  }, [history]);

  const handleSaveDatabase = () => {
    const savedResults = JSON.parse(localStorage.getItem('saved_results') || '[]');
    if (savedResults.length === 0) {
      alert('Không có kết quả bắn nào để lưu!');
      return;
    }

    const sessionName = prompt('Nhập tên đợt bắn để lưu (ví dụ: Kiểm tra đợt 1 - 2024):');
    if (!sessionName) return;

    // 1. Export to Excel
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Detailed Results
    const wsData = savedResults.map((r: any, index: number) => ({
      'STT': index + 1,
      'Họ và Tên': r.name,
      'Cấp bậc': r.rank,
      'Chức vụ': r.position,
      'Đơn vị': r.unit,
      'Dải': r.lane,
      'Bia 4': r.scores.target4,
      'Bia 7': r.scores.target7,
      'Bia 8': r.scores.target8,
      'Tổng điểm': r.total,
      'Xếp loại': r.classification
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Kết quả chi tiết");

    // Sheet 2: Statistics
    const stats = {
      'Tổng quân số': savedResults.length,
      'Giỏi': savedResults.filter((r: any) => r.classification === 'Giỏi').length,
      'Khá': savedResults.filter((r: any) => r.classification === 'Khá').length,
      'Đạt': savedResults.filter((r: any) => r.classification === 'Đạt').length,
      'Không đạt': savedResults.filter((r: any) => r.classification === 'Không đạt').length,
    };
    const wsStats = XLSX.utils.json_to_sheet([stats]);
    XLSX.utils.book_append_sheet(wb, wsStats, "Thống kê chung");

    XLSX.writeFile(wb, `${sessionName}.xlsx`);

    // 2. Save to History
    const newHistoryItem = {
      id: Date.now().toString(),
      name: sessionName,
      date: new Date().toLocaleString('vi-VN'),
      totalCount: savedResults.length,
      data: savedResults
    };
    setHistory([newHistoryItem, ...history]);

    // 3. Reset System
    const resetSystem = async () => {
      try {
        const batch = writeBatch(db);
        soldiers.forEach(s => {
          batch.delete(doc(db, 'shooting_queue', s.id));
        });
        await batch.commit();
        
        localStorage.removeItem('shooting_results');
        localStorage.removeItem('saved_results');
        alert('Đã lưu cơ sở dữ liệu, xuất file Excel và reset hệ thống thành công!');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'reset_system_batch');
      }
    };
    resetSystem();
  };

  const downloadHistoryExcel = (item: any) => {
    const wb = XLSX.utils.book_new();
    const wsData = item.data.map((r: any, index: number) => ({
      'STT': index + 1,
      'Họ và Tên': r.name,
      'Cấp bậc': r.rank,
      'Chức vụ': r.position,
      'Đơn vị': r.unit,
      'Dải': r.lane,
      'Bia 4': r.scores.target4,
      'Bia 7': r.scores.target7,
      'Bia 8': r.scores.target8,
      'Tổng điểm': r.total,
      'Xếp loại': r.classification
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Kết quả");
    XLSX.writeFile(wb, `${item.name}.xlsx`);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'STT': 1,
        'Họ và Tên': 'Nguyễn Văn A',
        'Cấp bậc': 'Thiếu úy',
        'Chức vụ': 'Trung đội trưởng',
        'Đơn vị': 'Đại đội 1'
      },
      {
        'STT': 2,
        'Họ và Tên': 'Trần Văn B',
        'Cấp bậc': 'Thượng sĩ',
        'Chức vụ': 'Tiểu đội trưởng',
        'Đơn vị': 'Đại đội 2'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Mau_Danh_Sach_Quan_Nhan.xlsx");
  };

  return (
    <div className="px-2 sm:px-4 max-w-5xl mx-auto py-8">
      {/* Status Display */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 bg-[#f3f3f3] p-4 sm:p-6 rounded-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-tactical-green mb-1">QUÂN SỐ HIỆN TẠI</p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-4xl sm:text-6xl font-bold leading-none tracking-tighter text-tactical-green">{soldiers.length}</span>
              <span className="font-headline text-lg sm:text-xl font-bold text-tactical-green/50">/ 50</span>
            </div>
          </div>
          <div className="relative z-10 flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 sm:gap-0">
            <span className="bg-tactical-accent text-tactical-green px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:mb-2">
              <Verified className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
              SẴN SÀNG
            </span>
            <p className="text-[9px] sm:text-[10px] font-mono text-gray-500 uppercase tracking-tight">Cập nhật: 14:30:05</p>
          </div>
        </div>
      </section>

      {/* Fast Entry Form */}
      <section className="mb-8">
        <div className="bg-white p-5 rounded-xl border-l-4 border-tactical-green shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-tactical-green flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              NHẬP LIỆU NHANH
            </h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowDeleteAllConfirm(true)}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                XÓA TẤT CẢ
              </button>
              <button 
                onClick={downloadTemplate}
                className="text-[10px] font-bold text-tactical-blue hover:underline uppercase flex items-center gap-1"
              >
                <UploadCloud className="w-3 h-3" />
                TẢI FILE MẪU
              </button>
            </div>
          </div>

          {/* Import from Excel Area */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <div 
            onClick={handleExcelImportClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="mb-8 p-6 bg-[#f3f3f3] rounded-lg border-2 border-dashed border-gray-300 hover:border-tactical-green transition-all group cursor-pointer"
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-tactical-green-light text-tactical-accent rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="font-headline font-bold text-sm uppercase tracking-wider text-[#1a1c1c] mb-1">NHẬP TỪ EXCEL</p>
              <p className="text-[10px] text-gray-400 font-medium">Kéo thả hoặc Chọn file danh sách (.xlsx, .csv)</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <hr className="flex-1 border-gray-200" />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">HOẶC NHẬP THỦ CÔNG</span>
            <hr className="flex-1 border-gray-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Họ và Tên</label>
              <input 
                className="w-full bg-[#f3f3f3] border-0 border-b-2 border-gray-300 focus:border-tactical-blue focus:ring-0 text-[#1a1c1c] font-medium px-2 py-3 transition-all" 
                placeholder="Nguyễn Văn A" 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Cấp bậc</label>
              <select 
                className="w-full bg-[#f3f3f3] border-0 border-b-2 border-gray-300 focus:border-tactical-blue focus:ring-0 text-[#1a1c1c] font-medium px-2 py-3 transition-all"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
              >
                {RANKS.map(rank => <option key={rank}>{rank}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Chức vụ</label>
              <input 
                className="w-full bg-[#f3f3f3] border-0 border-b-2 border-gray-300 focus:border-tactical-blue focus:ring-0 text-[#1a1c1c] font-medium px-2 py-3 transition-all" 
                placeholder="Đại đội trưởng" 
                type="text" 
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Đơn vị</label>
              <input 
                className="w-full bg-[#f3f3f3] border-0 border-b-2 border-gray-300 focus:border-tactical-blue focus:ring-0 text-[#1a1c1c] font-medium px-2 py-3 transition-all" 
                placeholder="C1 / D4" 
                type="text" 
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleAddSoldier}
              className="flex-1 h-14 border-2 border-tactical-green-light text-tactical-green font-headline font-bold uppercase tracking-widest rounded-xl hover:bg-tactical-green-light hover:text-tactical-accent transition-colors flex items-center justify-center gap-2 active:scale-95 duration-100"
            >
              {editingId ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {editingId ? 'CẬP NHẬT' : 'THÊM MỚI'}
            </button>
            {editingId && (
              <button 
                onClick={() => {
                  setEditingId(null);
                  setName('');
                  setPosition('');
                  setUnit('');
                }}
                className="px-6 h-14 border-2 border-gray-300 text-gray-500 font-headline font-bold uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-colors active:scale-95 duration-100"
              >
                HỦY
              </button>
            )}
            <button 
              onClick={handleSaveDatabase}
              className="px-8 h-14 bg-tactical-blue text-white font-headline font-bold uppercase tracking-widest rounded-xl hover:brightness-110 transition-colors flex items-center justify-center gap-2 active:scale-95 duration-100"
            >
              <Save className="w-5 h-5" />
              LƯU CSDL
            </button>
          </div>
        </div>
      </section>

      {/* History Section */}
      {history.length > 0 && (
        <section className="mb-8">
          <div className="bg-white p-5 rounded-xl border-l-4 border-tactical-accent shadow-sm">
            <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-tactical-green flex items-center gap-2 mb-6">
              <Save className="w-4 h-4" />
              LỊCH SỬ LƯU TRỮ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map(item => (
                <div key={item.id} className="bg-[#f3f3f3] p-4 rounded-lg flex justify-between items-center group">
                  <div>
                    <p className="font-headline font-bold text-xs uppercase text-tactical-green">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{item.date} • {item.totalCount} người</p>
                  </div>
                  <button 
                    onClick={() => downloadHistoryExcel(item)}
                    className="p-2 bg-tactical-accent text-tactical-green rounded-md hover:bg-tactical-green hover:text-tactical-accent transition-all"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Data Table */}
      <section className="bg-white rounded-xl overflow-hidden mb-12 shadow-sm border border-gray-200">
        <div className="p-4 bg-[#e8e8e8] flex justify-between items-center border-b border-gray-200">
          <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-tactical-green">DANH SÁCH CHI TIẾT</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-500">LỌC THEO:</span>
            <button className="text-[10px] font-black bg-tactical-green text-tactical-accent px-3 py-1 rounded">TẤT CẢ</button>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-[#f3f3f3]">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">STT</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">Họ và Tên</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">Cấp bậc</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">Chức vụ</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 whitespace-nowrap">Đơn vị</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 text-center whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {soldiers.map((soldier, index) => (
                <tr key={soldier.id} className={cn(
                  "hover:bg-[#f3f3f3] transition-colors group",
                  editingId === soldier.id && "bg-tactical-blue/5"
                )}>
                  <td className="px-4 py-5 font-mono text-xs text-tactical-green font-bold">{index + 1 < 10 ? `0${index + 1}` : index + 1}</td>
                  <td className="px-4 py-5 font-bold text-[#1a1c1c] cursor-pointer hover:text-tactical-green transition-colors underline decoration-dotted decoration-tactical-green/30">
                    {soldier.name}
                  </td>
                  <td className="px-4 py-5 text-sm text-gray-600 font-medium">{soldier.rank}</td>
                  <td className="px-4 py-5 text-sm text-gray-600">{soldier.position}</td>
                  <td className="px-4 py-5 text-sm text-gray-600">{soldier.unit}</td>
                  <td className="px-4 py-5 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-black rounded-full",
                      soldier.status === 'Completed' 
                        ? "bg-gray-400 text-white" 
                        : "bg-tactical-blue text-white"
                    )}>
                      {soldier.status === 'Completed' ? 'ĐÃ BẮN' : 'CHỜ BẮN'}
                    </span>
                  </td>
                  <td className="px-4 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEditSoldier(soldier)}
                        className={cn(
                          "p-2 rounded-md transition-all shadow-sm",
                          editingId === soldier.id 
                            ? "bg-tactical-green text-tactical-accent" 
                            : "text-tactical-green bg-tactical-accent hover:bg-tactical-green hover:text-tactical-accent"
                        )}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteSoldier(soldier.id)}
                        className="p-2 text-gray-400 hover:text-tactical-danger hover:bg-red-50 rounded-md transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-[#f3f3f3] flex justify-center border-t border-gray-200">
          <button className="text-[10px] font-black text-tactical-green uppercase tracking-widest hover:underline flex items-center gap-1">
            XEM TOÀN BỘ DANH SÁCH
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </section>

      {/* FAB */}
      <div className="fixed bottom-24 right-4 z-40">
        <button className="w-16 h-16 bg-tactical-green text-tactical-accent rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">
          <Printer className="w-8 h-8" />
        </button>
      </div>
      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border-t-8 border-red-600"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="font-headline text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">XÓA TOÀN BỘ DANH SÁCH?</h3>
                <p className="text-gray-500 text-sm mb-8">Hành động này không thể hoàn tác. Tất cả quân nhân trong danh sách sẽ bị xóa vĩnh viễn.</p>
                
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowDeleteAllConfirm(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    HỦY BỎ
                  </button>
                  <button 
                    onClick={handleDeleteAll}
                    disabled={isDeletingAll}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                  >
                    {isDeletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : 'XÁC NHẬN XÓA'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
