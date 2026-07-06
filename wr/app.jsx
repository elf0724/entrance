import React, { useState, useEffect } from 'react';
import { Sun, Moon, MapPin, CloudFog, Info, AlertCircle, ChevronRight, Activity, Droplets, Wind } from 'lucide-react';

// ==========================================
// 1. 靜態設定與資料
// ==========================================
const LOCATIONS = {
  '陽明山區': { lat: 25.1637, lon: 121.5407, alt: 800, county: '臺北市', town: '北投區' },
  '九份/不厭亭': { lat: 25.1097, lon: 121.8447, alt: 600, county: '新北市', town: '瑞芳區' },
};
const COUNTIES = [
  '臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','新竹縣',
  '苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣',
  '臺東縣','澎湖縣','金門縣','連江縣'
];
const TIME_OPTIONS = [
  { id: 'sunrise', label: '日出前一小時', icon: Sun },
  { id: 'sunset', label: '日落後一小時', icon: Moon },
  { id: 'both', label: '全天 (兩者皆列)', icon: Activity }
];

// 模擬工具函式 (省略部分複雜運算以精簡展示，保留核心骨架)
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ==========================================
// 2. 主應用程式元件
// ==========================================
export default function CloudSeaPredictor() {
  // --- 狀態管理 ---
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('sunrise');
  const [selectedLocs, setSelectedLocs] = useState(['陽明山區', '九份/不厭亭']);
  const [customLoc, setCustomLoc] = useState('');
  const [customCounty, setCustomCounty] = useState('');
  const [customTown, setCustomTown] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Toast 狀態
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setDate(fmtDate(new Date()));
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleLoc = (loc) => {
    setSelectedLocs(prev => 
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  // --- 模擬預測流程 ---
  const handlePredict = async () => {
    if (!date) return showToast('請選擇預測日期', 'error');
    if (selectedLocs.length === 0 && !customLoc) return showToast('請至少選擇一個觀測地點', 'error');

    setIsLoading(true);
    setResults(null);
    setLogs([]);
    
    const addLog = (msg, type = 'ok') => setLogs(prev => [...prev, { msg, type }]);
    
    try {
      setLoadingMsg('正在自動擷取氣象資料 (Open-Meteo + 中央氣象署)...');
      await delay(1200); // 模擬網路請求
      addLog('Open-Meteo 資料擷取成功');
      
      setLoadingMsg('正在比對逆溫層與水氣條件...');
      await delay(1000); // 模擬邏輯運算
      
      // 模擬 CWA 失敗退回的情境
      if (customLoc && (!customCounty || !customTown)) {
        addLog(`自訂地點「${customLoc}」未完整填寫縣市/鄉鎮，跳過中央氣象署資料`, 'warn');
        showToast('部分地點未填寫完整，已自動退回使用 Open-Meteo 資料', 'warn');
      }

      setLoadingMsg('正在請 AI 潤飾文字說明...');
      await delay(1500); // 模擬 AI 請求
      addLog('文字說明已由 AI 潤飾完成');

      // 模擬最終結果資料結構
      setResults({
        summary: `本次分析共比對多筆資料，機率最高為「陽明山區」日出前一小時（85%，雲海機制主導）。所有數據均來自即時擷取的氣象模型。`,
        data: selectedLocs.map(loc => ({
          location: loc,
          timeLabel: '2026-07-06 日出前一小時',
          probability: Math.floor(Math.random() * 40) + 50,
          dominantType: '雲海',
          rh: 88, windSpeed: 2.1, dewSpread: 1.5,
          inversion: '約 850m (差 50m)',
          diurnal: 12.5,
          source: 'Open-Meteo + CWA'
        }))
      });

    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      {/* 頂部導覽 */}
      <header className="bg-white border-b border-slate-200 px-6 py-5 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-wrap items-baseline gap-4">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight flex items-center gap-2">
            <CloudFog className="w-7 h-7" />
            雲海預測儀
          </h1>
          <span className="text-xs font-mono text-slate-400 tracking-widest uppercase">
            Weather · Photography · Auto-Data
          </span>
          <div className="ml-auto flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-mono text-green-700">自動資料擷取 · 就緒</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 relative">
        
        {/* 左側：控制面板 */}
        <div className="md:col-span-4 lg:col-span-3 space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xs font-mono text-slate-400 tracking-widest uppercase mb-5">預測條件</h2>
            
            {/* 日期選擇 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-600 mb-2">預測日期</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
              />
            </div>

            {/* 拍攝時段 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-600 mb-2">拍攝時段</label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTimeSlot(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      timeSlot === opt.id 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-600' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 觀測地點 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                預設地點 (可複選)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.keys(LOCATIONS).map(loc => (
                  <button
                    key={loc}
                    onClick={() => toggleLoc(loc)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      selectedLocs.includes(loc)
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>

              {/* 自訂地點 */}
              <input 
                type="text" 
                placeholder="自訂地點 (如: 阿里山)"
                value={customLoc}
                onChange={(e) => setCustomLoc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm mb-2"
              />
              
              {/* 自動展開 CWA 對應選單 */}
              {customLoc && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[11px] text-slate-500 leading-tight block">
                    選填：供中央氣象署資料比對使用
                  </label>
                  <select 
                    value={customCounty}
                    onChange={(e) => setCustomCounty(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                  >
                    <option value="">請選擇縣市</option>
                    {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder="鄉鎮區名稱 (例: 阿里山鄉)"
                    value={customTown}
                    onChange={(e) => setCustomTown(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>

            {/* 行動裝置 Sticky 按鈕處理 */}
            <div className="sticky bottom-4 z-30 md:static mt-6">
              <button 
                onClick={handlePredict}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>開始預測分析 <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
            
            <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed font-mono">
              中央氣象署與 Groq AI 設定<br/>已交由 cwa-config.js 自動處理
            </p>
          </div>
        </div>

        {/* 右側：分析結果區 */}
        <div className="md:col-span-8 lg:col-span-9">
          <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
            <h2 className="text-xs font-mono text-slate-400 tracking-widest uppercase mb-6 border-b border-slate-100 pb-4">
              氣象分析報告
            </h2>

            {/* 骨架屏載入狀態 (Skeleton) */}
            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-12 animate-in fade-in duration-300">
                <div className="relative">
                  <CloudFog className="w-16 h-16 text-blue-100 animate-pulse" />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 border-2 border-white border-t-blue-500 rounded-full animate-spin"></div>
                </div>
                <p className="text-sm font-mono text-blue-600 font-medium tracking-wide">
                  {loadingMsg}
                </p>
                <div className="w-full max-w-md space-y-3 mt-8">
                  <div className="h-24 bg-slate-100 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-3/4"></div>
                  <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-5/6"></div>
                </div>
              </div>
            )}

            {/* 初始佔位符 */}
            {!isLoading && !results && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <Info className="w-12 h-12 opacity-20" />
                <p className="text-sm text-center leading-relaxed">
                  選擇日期與地點<br/>按下「開始預測分析」<br/>系統將自動抓取資料並計算機率
                </p>
              </div>
            )}

            {/* 結果呈現 */}
            {!isLoading && results && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 執行 Log */}
                {logs.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 font-mono text-xs space-y-2">
                    {logs.map((log, i) => (
                      <div key={i} className={`flex items-start gap-2 ${log.type === 'warn' ? 'text-amber-600' : 'text-slate-500'}`}>
                        {log.type === 'warn' ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <span className="text-green-500">✓</span>}
                        <span>{log.msg}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI 潤飾總結摘要 */}
                <div className="bg-blue-50/50 border-l-4 border-blue-500 rounded-r-xl p-5 text-sm text-slate-700 leading-relaxed shadow-sm">
                  {results.summary}
                </div>

                {/* 機率卡片網格 */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> 深度氣象判讀
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.data.map((item, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-slate-800">{item.location}</h4>
                            <p className="text-xs text-slate-500 font-mono mt-1">{item.timeLabel}</p>
                          </div>
                          <div className={`text-2xl font-black font-mono ${item.probability >= 70 ? 'text-green-600' : item.probability >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                            {item.probability}%
                          </div>
                        </div>

                        {/* 進度條 */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-1000 ease-out ${item.probability >= 70 ? 'bg-green-500' : item.probability >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${item.probability}%` }}
                          ></div>
                        </div>

                        {/* 細部數據 */}
                        <div className="grid grid-cols-2 gap-y-3 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Droplets className="w-3.5 h-3.5 text-blue-400" />
                            濕度 <span className="font-mono font-medium text-slate-800 ml-auto">{item.rh}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600 pl-2 border-l border-slate-100">
                            <Wind className="w-3.5 h-3.5 text-teal-400" />
                            風速 <span className="font-mono font-medium text-slate-800 ml-auto">{item.windSpeed}m/s</span>
                          </div>
                          <div className="col-span-2 text-slate-500 flex justify-between bg-slate-50 p-2 rounded-lg mt-1">
                            <span>逆溫層底部</span>
                            <span className="font-mono text-slate-800">{item.inversion}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 
            toast.type === 'warn' ? 'bg-amber-50 border-amber-100 text-amber-700' : 
            'bg-slate-800 border-slate-700 text-white'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}