import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, Battery, Activity, HardDrive, RefreshCw, Send, Volume2, History, Radio, Loader2, Download, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { OperationType } from '../types';
import { playTts, initAudio, fetchTtsUrl } from '../lib/audio';
import { uploadAudioToSupabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type ESPTab = 'POINTS' | 'AUDIO';

export default function ESP32View() {
  const [activeTab, setActiveTab] = useState<ESPTab>('POINTS');
  const [results, setResults] = useState<any[]>([]);
  const [shootingQueue, setShootingQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState<number | null>(null);

  const espCode = `// Logic: Đồng bộ âm thanh từ Supabase Storage về thẻ nhớ SD (Phát ngoại tuyến)
// URL_DU_AN: https://[ID_DU_AN].supabase.co
// MA_API: sb_publishable_kS9DsldrjUUrcDrCiQEbig_k2WHVBoe

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SD.h>
#include <FS.h>
#include "Audio.h"

Audio audio;

void syncAudioFromCloud(String downloadUrl, int turnIdx) {
  String fileName = "/" + String(turnIdx) + ".mp3";
  WiFiClientSecure client;
  client.setInsecure(); 
  
  HTTPClient http;
  if (http.begin(client, downloadUrl)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      File file = SD.open(fileName, FILE_WRITE);
      if (!file) return;

      WiFiClient* stream = http.getStreamPtr();
      uint8_t buffer[1024];
      int downloaded = 0;
      int totalSize = http.getSize();

      while (http.connected() && (downloaded < totalSize || totalSize == -1)) {
        size_t availableSize = stream->available();
        if (availableSize) {
          int readSize = stream->readBytes(buffer, ((availableSize > sizeof(buffer)) ? sizeof(buffer) : availableSize));
          file.write(buffer, readSize);
          downloaded += readSize;
        }
        delay(1);
      }
      file.close();
      Serial.printf("Lượt %d đã được cập nhật từ Supabase!\\n", turnIdx);
    }
    http.end();
  }
}

void playCurrentTurn(int turnIdx) {
  String path = "/" + String(turnIdx) + ".mp3";
  if (SD.exists(path)) {
    audio.connecttoFS(SD, path.c_str());
    Serial.printf("Đang phát ngoại tuyến: %s\\n", path.c_str());
  } else {
    Serial.println("Không tìm thấy file trên SD. Vui lòng đồng bộ trước!");
  }
}

void setup() {
  Serial.begin(115200);
  if(!SD.begin(5)) Serial.println("Gắn thẻ SD thất bại!");
  audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
}

void loop() {
  // Nhận lệnh CMD_SYNC_AUDIO và receivedUrl từ Dashboard
  if (receivedCmd == CMD_SYNC_AUDIO) {
    syncAudioFromCloud(receivedUrl, targetTurnIdx);
  }
  
  if (receivedCmd == CMD_PLAY_TURN) {
    playCurrentTurn(targetTurnIdx);
  }
  
  audio.loop(); 
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(espCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // Synchronize with the shooting results for the POINTS tab
    const qResults = query(collection(db, 'shooting_results'), orderBy('timestamp', 'desc'));
    const unsubscribeResults = onSnapshot(qResults, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_results');
    });

    // Synchronize with the shooting queue (admin managed list) for the AUDIO tab
    const qQueue = query(collection(db, 'shooting_queue'), orderBy('order', 'asc'));
    const unsubscribeQueue = onSnapshot(qQueue, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShootingQueue(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shooting_queue');
      setIsLoading(false);
    });

    return () => {
      unsubscribeResults();
      unsubscribeQueue();
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

  const handleDownloadTurn = async (turnIdx: number, chunk: any[]) => {
    const phrase = `Lượt bắn thứ ${turnIdx + 1}. ` + chunk
      .map((s, i) => s && s.name ? `Dải ${i + 1}: ${s.name}. ` : '')
      .join('');
    
    const url = await fetchTtsUrl(phrase);

    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error("Không thể tạo file âm thanh!");
    }
  };

  const handleSyncToSupabase = async (turnIdx: number, chunk: any[]) => {
    setIsSyncing(turnIdx);
    const phrase = `Lượt bắn thứ ${turnIdx + 1}. ` + chunk
      .map((s, i) => s && s.name ? `Dải ${i + 1}: ${s.name}. ` : '')
      .join('');
    
    try {
      const url = await fetchTtsUrl(phrase);
      if (!url) throw new Error("Không thể lấy URL từ FPT AI");

      const fileName = `${turnIdx + 1}.mp3`;
      const publicUrl = await uploadAudioToSupabase(url, fileName);

      if (publicUrl) {
        toast.success(`Đã đồng bộ Lượt ${turnIdx + 1}`);
        console.log("Supabase URL:", publicUrl);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi đồng bộ không xác định!");
    } finally {
      setIsSyncing(null);
    }
  };

  const sensors = [
    { id: 'S1', name: 'MẶT BIA 1', status: 'Online', battery: '92%', signal: 'Strong', load: '12%', lastPoint: 'X: 12.4, Y: -5.2' },
    { id: 'S2', name: 'MẶT BIA 2', status: 'Online', battery: '88%', signal: 'Good', load: '8%', lastPoint: 'X: 0.0, Y: 15.1' },
    { id: 'S3', name: 'MẶT BIA 3', status: 'Online', battery: '95%', signal: 'Excellent', load: '15%', lastPoint: 'X: -8.2, Y: -2.3' },
    { id: 'S4', name: 'MẶT BIA 4', status: 'Offline', battery: '0%', signal: 'None', load: '0%', lastPoint: '---' },
  ];

  const recentPackets = results.slice(0, 5).map(r => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString('vi-VN') : '---',
    device: `S${r.lane || '?'}`,
    type: 'COORDINATE',
    data: `Total: ${r.total || 0} (${r.classification || '---'})`,
    rssi: '-64dBm'
  }));

  const audioStatus = [
    { device: 'S1', status: 'Sync', currentTrack: 'Phát kết quả: Bia 1', latency: '12ms' },
    { device: 'S2', status: 'Ready', currentTrack: 'Idle', latency: '15ms' },
    { device: 'S3', status: 'Playing', currentTrack: 'Đọc tên: Nguyễn Văn A', latency: '10ms' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* System Status Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4"
        >
          <div className="p-3 bg-blue-50 rounded-lg">
            <Cpu className="text-blue-600 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hệ thống ESP32</p>
            <p className="text-base font-black text-gray-900 leading-none mt-1 uppercase">Lora Mesh v2.0</p>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4"
        >
          <div className="p-3 bg-green-50 rounded-lg">
            <Radio className="text-green-600 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Truyền tải</p>
            <p className="text-base font-black text-gray-900 leading-none mt-1">SẴN SÀNG</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4"
        >
          <div className="p-3 bg-orange-50 rounded-lg">
            <RefreshCw className="text-orange-600 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trυng tâm xử lý</p>
            <p className="text-base font-black text-gray-900 leading-none mt-1">MASTER NODE</p>
          </div>
        </motion.div>
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
          ESP GỬI ĐIỂM
        </button>
        <button
          onClick={() => setActiveTab('AUDIO')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${
            activeTab === 'AUDIO' ? 'bg-white shadow-sm text-tactical-green' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          ESP NHẬN ÂM THANH
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'POINTS' ? (
          <motion.div
            key="points"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Live Data Packets */}
            <div className="bg-[#1a1c1c] rounded-2xl overflow-hidden border border-white/5">
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-tactical-accent" />
                  <h3 className="font-headline font-bold text-white text-sm tracking-widest uppercase">Gói tin điểm chạm gần nhất</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">MODE: REAL-TIME</span>
                </div>
              </div>
              <div className="p-0 overflow-x-auto min-h-[100px]">
                {isLoading ? (
                  <div className="p-8 flex justify-center items-center text-gray-500 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold uppercase">Đang đồng bộ dữ liệu...</span>
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-8 text-center text-gray-600 text-xs font-bold uppercase italic">
                    Chưa có gói tin nào được gửi lên
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/5 text-gray-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Thời gian</th>
                        <th className="px-4 py-3">Thiết bị</th>
                        <th className="px-4 py-3">Dữ liệu tọa độ</th>
                        <th className="px-4 py-3">Tín hiệu (RSSI)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentPackets.map((p, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors text-white font-mono">
                          <td className="px-4 py-3 text-gray-400 font-mono">{p.time}</td>
                          <td className="px-4 py-3">
                            <span className="bg-tactical-accent/10 text-tactical-accent px-2 py-1 rounded font-black">{p.device}</span>
                          </td>
                          <td className="px-4 py-3 text-white font-bold">{p.data}</td>
                          <td className="px-4 py-3 text-tactical-green font-bold">{p.rssi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Device List for Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sensors.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-tactical-green transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center font-black text-xs ${s.status === 'Online' ? 'bg-tactical-green text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {s.id}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{s.name}</h4>
                        <p className={`text-[10px] font-black uppercase ${s.status === 'Online' ? 'text-tactical-green' : 'text-red-500'}`}>{s.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Tọa độ cuối</p>
                      <p className="text-xs font-black text-gray-900 font-mono">{s.lastPoint}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Pin</p>
                      <p className="text-xs font-black text-gray-900">{s.battery}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Sóng</p>
                      <p className="text-xs font-black text-gray-900">{s.signal}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="audio"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Audio Broadcast Control */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-tactical-green/10 rounded-2xl">
                  <Volume2 className="text-tactical-green w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-gray-900 text-lg uppercase leading-none">Hệ thống âm thanh đọc tên</h3>
                  <p className="text-xs font-medium text-gray-500 mt-2">Dữ liệu âm thanh tên người bắn đã được đồng bộ với máy thư ký</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-6 py-3 bg-tactical-accent text-[#1a1c1c] rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-tactical-accent/20">
                  Đồng bộ bộ nhớ (SD)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ready Audio Files List - SYNCED WITH ADMIN SHOOTING QUEUE */}
              <div className="bg-[#1a1c1c] rounded-2xl overflow-hidden border border-white/5 h-full flex flex-col">
                <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <History className="w-4 h-4 text-tactical-accent" />
                    <h3 className="font-headline font-bold text-xs tracking-widest uppercase">Danh sách âm thanh tên VĐV</h3>
                  </div>
                  <span className="text-[10px] text-tactical-green font-black uppercase tracking-tighter">
                    {shootingQueue.length} VĐV ĐÃ ĐỒNG BỘ
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[500px]">
                  <div className="p-3 space-y-6">
                    {isLoading ? (
                      <div className="p-8 flex justify-center items-center text-gray-500 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-tight">Đang tải danh sách từ Admin...</span>
                      </div>
                    ) : shootingQueue.length === 0 ? (
                      <div className="p-8 text-center text-gray-600 text-xs font-bold uppercase italic">
                        Admin chưa thêm quân nhân vào danh sách
                      </div>
                    ) : (
                      (() => {
                        const chunks = [];
                        for (let i = 0; i < shootingQueue.length; i += 8) {
                          chunks.push(shootingQueue.slice(i, i + 8));
                        }
                        
                        return chunks.map((chunk, turnIdx) => {
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
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handlePreviewTurn(turnIdx, chunk)}
                                      className="flex items-center gap-1.5 px-3 py-1 bg-tactical-accent/20 border border-tactical-accent/30 rounded text-[9px] font-black text-tactical-accent hover:bg-tactical-accent hover:text-black transition-all"
                                    >
                                      <Volume2 className="w-3 h-3" />
                                      PHÁT THỬ LƯỢT ({turnIdx + 1}.mp3)
                                    </button>
                                    <button 
                                      onClick={() => handleSyncToSupabase(turnIdx, chunk)}
                                      disabled={isSyncing === turnIdx}
                                      className="p-1 px-2 bg-tactical-accent/10 border border-tactical-accent/30 rounded text-tactical-accent hover:bg-tactical-accent hover:text-[#1a1c1c] transition-all disabled:opacity-50"
                                      title="Đồng bộ lên Cloud Supabase"
                                    >
                                      {isSyncing === turnIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadTurn(turnIdx, chunk)}
                                      className="p-1 px-2 bg-white/5 border border-white/10 rounded text-gray-400 hover:text-tactical-accent hover:border-tactical-accent transition-all"
                                      title="Tải về máy"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
                                  </div>
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
                                              ĐÃ LƯU
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
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Source Code for ESP32 */}
              <div className="bg-[#1a1c1c] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full">
                <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Radio className="w-4 h-4 text-tactical-accent" />
                    <h3 className="font-headline font-bold text-xs tracking-widest uppercase">Mã nguồn ESP32 (Đồng bộ SD Card)</h3>
                  </div>
                  <button 
                    onClick={handleCopyCode}
                    className={`text-[10px] font-black uppercase transition-colors ${copied ? 'text-tactical-green' : 'text-tactical-accent hover:underline'}`}
                  >
                    {copied ? 'ĐÃ SAO CHÉP!' : 'SAO CHÉP MÃ'}
                  </button>
                </div>
                <div className="flex-1 bg-black p-4 overflow-x-auto">
                  <pre className="text-[10px] font-mono text-gray-400 leading-relaxed">
                    <code className="block">
                      {espCode}
                    </code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Audio Device Groups */}
            <div className="bg-[#1a1c1c] rounded-2xl overflow-hidden border border-white/5">
              <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-2 text-white">
                <History className="w-4 h-4 text-tactical-accent" />
                <h3 className="font-headline font-bold text-sm tracking-widest uppercase">Trạng thái phản hồi âm thanh</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {audioStatus.map((a, idx) => (
                    <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-white/10 text-white px-2 py-1 rounded text-[10px] font-black">{a.device}</span>
                        <span className={`text-[10px] font-black uppercase ${a.status === 'Sync' ? 'text-tactical-green' : a.status === 'Playing' ? 'text-tactical-accent' : 'text-gray-400'}`}>
                          {a.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Đang phát:</p>
                      <p className="text-xs font-bold text-white mb-3 line-clamp-1">{a.currentTrack}</p>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Độ trễ:</span>
                        <span className="text-[10px] text-tactical-green font-black">{a.latency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-room config */}
            <div className="bg-white p-4 rounded-xl border border-dashed border-gray-200 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase italic">Tự động đồng bộ với cơ sở dữ liệu kết quả bắn dải 1-8</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs/Technical Info */}
      <div className="bg-black p-4 rounded-xl border border-white/5 font-mono">
        <div className="flex items-center gap-2 mb-3 text-tactical-accent">
          <Activity className="w-3 h-3 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-widest">ESP-MESH INTERFACE [STABLE]</p>
        </div>
        <div className="space-y-1 text-[10px]">
          <p className="text-gray-500">[17:38:05] DATA_SYNC: Loaded {results.length} entries from Firebase</p>
          <p className="text-gray-400">[17:38:07] DB_WATCH: Listening for new results...</p>
          <p className="text-gray-400">[17:38:08] SYNC_CMD: Timing sync offset derived (4.2ms)</p>
          <p className="text-tactical-green">[17:38:10] SYSTEM: All nodes operational</p>
        </div>
      </div>
    </div>
  );
}
