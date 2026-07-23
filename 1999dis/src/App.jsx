import React, { useState, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { toPng } from 'html-to-image';
import { 
  UploadCloud, AlertTriangle, Check, Trash2, 
  Layers, Database, BarChart3, Map, MapPin, Camera, FileText
} from 'lucide-react';

// ==========================================
// 1. 核心邏輯與常數定義
// ==========================================

const extractDistrict = (address) => {
  if (typeof address !== 'string' || !address) return '未標明';
  let addrClean = address.normalize('NFKC');
  const match = addrClean.match(/(?:臺北市|台北市)?([\u4e00-\u9fa5]{2,3}區)/);
  return match ? match[1] : '未標明';
};

const extractRoadStreet = (address) => {
  if (typeof address !== 'string' || !address) return null;
  let addrClean = address.normalize('NFKC');
  addrClean = addrClean.replace(/\d+台灣/g, '');
  addrClean = addrClean.replace(/(臺北市|台北市)/g, '');
  addrClean = addrClean.replace(/[\u4e00-\u9fa5]{1,3}區/g, '');
  addrClean = addrClean.replace(/[\u4e00-\u9fa5]{1,3}里/g, '');
  addrClean = addrClean.replace(/\d{1,4}鄰/g, '');
  const match = addrClean.match(/([\u4e00-\u9fa5]{2,5}(?:路|街)(?:[一二三四五六七八九十]+段)?)/);
  return match ? match[1] : null;
};

const STYLE_POOL = [
  { id: 'teal', bg: 'bg-teal-600', lightBg: 'bg-teal-50', text: 'text-teal-700', fill: 'bg-teal-500', border: 'border-teal-200', textLight: 'text-teal-100' },
  { id: 'blue', bg: 'bg-blue-600', lightBg: 'bg-blue-50', text: 'text-blue-700', fill: 'bg-blue-500', border: 'border-blue-200', textLight: 'text-blue-100' },
  { id: 'purple', bg: 'bg-purple-600', lightBg: 'bg-purple-50', text: 'text-purple-700', fill: 'bg-purple-500', border: 'border-purple-200', textLight: 'text-purple-100' },
  { id: 'orange', bg: 'bg-orange-500', lightBg: 'bg-orange-50', text: 'text-orange-700', fill: 'bg-orange-400', border: 'border-orange-200', textLight: 'text-orange-100' },
  { id: 'rose', bg: 'bg-rose-600', lightBg: 'bg-rose-50', text: 'text-rose-700', fill: 'bg-rose-500', border: 'border-rose-200', textLight: 'text-rose-100' },
];

const getStyleForCategory = (categoryName) => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STYLE_POOL[Math.abs(hash) % STYLE_POOL.length];
};

// ==========================================
// 2. 主元件 App
// ==========================================
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [filesInfo, setFilesInfo] = useState([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  
  const [selectedDistrict, setSelectedDistrict] = useState("全部");
  const [isExporting, setIsExporting] = useState(false);
  
  const exportRef = useRef(null); 

  const dashboardTitle = useMemo(() => {
    if (filesInfo.length === 0) return "派工項目別熱點路段排名分析";
    const districtSuffix = selectedDistrict === "全部" ? "" : ` (${selectedDistrict})`;
    if (filesInfo.length === 1) {
      const match = filesInfo[0].name.match(/(\d{4})(\d{2})/);
      return match ? `派工項目熱點路段分析 — ${match[1]} 年 ${match[2]} 月${districtSuffix}` : `派工項目熱點路段分析${districtSuffix}`;
    }
    return `派工項目熱點跨期排行總覽${districtSuffix}`;
  }, [filesInfo, selectedDistrict]);

  const availableDistrictsList = useMemo(() => {
    const districts = new Set();
    rawData.forEach(row => {
      const d = extractDistrict(row['案件地址']);
      if (d !== '未標明') districts.add(d);
    });
    return Array.from(districts).sort();
  }, [rawData]);

  const readCsvWithEncoding = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const attemptParse = (encoding) => {
          return new Promise((res) => {
            const text = new TextDecoder(encoding).decode(buffer);
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (h) => h.trim().replace(/^\ufeff/g, '').replace(/^"|"$/g, ''),
              complete: (results) => res(results.data)
            });
          });
        };

        attemptParse('utf-8').then(utf8Data => {
          if (utf8Data.length > 0 && utf8Data[0]['派工項目'] !== undefined) {
            resolve({ name: file.name, data: utf8Data });
          } else {
            attemptParse('big5').then(big5Data => {
              if (big5Data.length > 0 && big5Data[0]['派工項目'] !== undefined) {
                resolve({ name: file.name, data: big5Data });
              } else {
                resolve({ name: file.name, data: utf8Data });
              }
            });
          }
        });
      };
      reader.onerror = () => reject(new Error("檔案讀取失敗"));
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setErrorMsg("");

    const validFiles = Array.from(files).filter(f => f.type === "text/csv" || f.name.endsWith('.csv'));
    if (validFiles.length === 0) {
      setErrorMsg("請上傳副檔名為 .csv 的檔案！");
      setIsProcessing(false);
      return;
    }

    try {
      const parsePromises = validFiles.map(file => readCsvWithEncoding(file));
      const parsedResults = await Promise.all(parsePromises);
      
      let newMergedData = [...rawData];
      let newFilesInfo = [...filesInfo];
      let hasValidData = false;
      let failedFiles = [];

      parsedResults.forEach(res => {
        if (res.data.length > 0 && res.data[0]['派工項目'] === undefined) {
            failedFiles.push(res.name);
            return;
        }
        if (!newFilesInfo.some(f => f.name === res.name)) {
          newMergedData = newMergedData.concat(res.data);
          newFilesInfo.push({ name: res.name, count: res.data.length });
          hasValidData = true;
        }
      });

      if (failedFiles.length > 0) {
          setErrorMsg(`解析失敗：在 ${failedFiles.join(', ')} 中找不到「派工項目」欄位。`);
          if (!hasValidData) { setIsProcessing(false); return; }
      }

      if (!hasValidData && parsedResults.length > 0 && failedFiles.length === 0) {
        setIsProcessing(false); return; 
      }

      const catCounts = {};
      newMergedData.forEach(row => {
        const cat = row['派工項目'];
        if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
      });

      const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(entry => entry[0]);

      if (sortedCats.length === 0 && failedFiles.length === 0) {
        setErrorMsg("解析失敗：找不到任何派工資料。");
        setIsProcessing(false); return;
      }

      setRawData(newMergedData);
      setFilesInfo(newFilesInfo);
      setAvailableCategories(sortedCats);
      
      if (selectedCategories.size === 0) {
        setSelectedCategories(new Set(sortedCats.slice(0, 5)));
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("檔案解析發生未知的錯誤。");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files);
  }, [rawData, filesInfo, selectedCategories]);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cat)) newSet.delete(cat);
      else newSet.add(cat);
      return newSet;
    });
  };

  const handleExportImage = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150)); 
      
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f1f5f9',
        style: { overflow: 'hidden' }
      });
      
      const link = document.createElement('a');
      link.download = `1999開放資料圖表_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("匯出失敗:", error);
      alert(`報表匯出失敗，錯誤代碼：${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const dashboardData = useMemo(() => {
    if (rawData.length === 0 || selectedCategories.size === 0) return [];
    const results = {};
    Array.from(selectedCategories).forEach(cat => { 
      results[cat] = { totalCases: 0, streets: {}, districts: {} }; 
    });

    rawData.forEach(row => {
      const cat = row['派工項目'];
      if (selectedCategories.has(cat)) {
        const district = extractDistrict(row['案件地址']);
        
        if (selectedDistrict !== '全部' && district !== selectedDistrict) return;

        results[cat].totalCases += 1;
        
        const street = extractRoadStreet(row['案件地址']);
        if (street) results[cat].streets[street] = (results[cat].streets[street] || 0) + 1;
        
        if (district !== '未標明') {
            results[cat].districts[district] = (results[cat].districts[district] || 0) + 1;
        }
      }
    });

    return Array.from(selectedCategories).map(cat => {
      const sortedStreets = Object.entries(results[cat].streets)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      const sortedDistricts = Object.entries(results[cat].districts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const maxDistrictCount = sortedDistricts.length > 0 ? sortedDistricts[0].count : 1;

      return { 
        categoryName: cat, totalCases: results[cat].totalCases,
        topStreets: sortedStreets, districts: sortedDistricts,
        maxDistrictCount, style: getStyleForCategory(cat) 
      };
    });
  }, [rawData, selectedCategories, selectedDistrict]);

  // ==========================================
  // 3. UI 渲染
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      <header className="bg-slate-900 text-white shadow-md z-10">
        <div className="px-6 py-4">
          <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-bold tracking-wider text-slate-50">1999 派工開放資料圖表化小工具</h1>
            </div>
            
            {rawData.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm"
                >
                  {isExporting ? <span className="animate-pulse">圖表生成中...</span> : <><Camera className="w-4 h-4" /> 匯出為圖檔</>}
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1"></div>

                <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg cursor-pointer transition-colors border border-slate-700 text-sm font-medium shadow-sm">
                  <UploadCloud className="w-4 h-4" /> 加入更多資料
                  <input type="file" accept=".csv" multiple className="hidden" onChange={(e) => processFiles(e.target.files)} />
                </label>
                
                <button 
                  onClick={() => { if(window.confirm("確定清除資料？")) { setRawData([]); setFilesInfo([]); setSelectedCategories(new Set()); setErrorMsg(""); setSelectedDistrict("全部"); } }}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="清除所有資料"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 匯出截圖時，整個 main 區塊會被擷取 */}
      <main ref={exportRef} className="flex-1 w-full max-w-[1920px] mx-auto px-4 md:px-6 py-6 overflow-hidden flex flex-col bg-slate-100">
        
        {rawData.length > 0 && (
          <div className="mb-8 mt-2 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{dashboardTitle}</h2>
            
            <div className="mt-3 flex flex-col md:items-start items-center gap-1.5">
              <p className="text-slate-500 text-sm flex items-center justify-center gap-2 font-medium">
                <Database className="w-4 h-4" />
                已載入 {filesInfo.length} 個資料集，過濾後共計 {dashboardData.reduce((acc, curr) => acc + curr.totalCases, 0).toLocaleString()} 筆案件
              </p>
              
              {/* ★ 新增：明確列出已上傳的檔案名稱 */}
              <p className="text-slate-400 text-xs flex items-start gap-1.5 max-w-4xl text-left">
                <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">資料來源：{filesInfo.map(f => f.name).join('、')}</span>
              </p>
            </div>
          </div>
        )}

        {errorMsg && !isExporting && (
          <div className="mb-6 max-w-2xl mx-auto w-full bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">解析發生問題</h3>
              <p className="text-sm mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {rawData.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-500">
            <label 
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              className={`flex flex-col items-center justify-center w-full max-w-2xl h-80 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ease-in-out ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/20 shadow-sm'}`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600 mb-4"></div>
                    <p className="text-lg font-bold text-blue-700 tracking-wide">資料解碼與分析中...</p>
                  </div>
                ) : (
                  <>
                    <div className={`p-5 rounded-full mb-6 transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <UploadCloud className={`w-14 h-14 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                    <p className="mb-2 text-2xl font-bold text-slate-700 tracking-wide">拖曳 1999 派工開放資料 CSV 至此</p>
                    <p className="text-slate-500 font-medium text-sm">支援單檔或跨期合併</p>
                  </>
                )}
              </div>
              <input type="file" accept=".csv" multiple className="hidden" onChange={(e) => processFiles(e.target.files)} disabled={isProcessing} />
            </label>
          </div>
        )}

        {rawData.length > 0 && (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 duration-700">
            
            <div className={`mb-6 flex flex-col lg:flex-row lg:items-start gap-4 ${isExporting ? 'bg-transparent border-transparent' : 'bg-white border-slate-200 shadow-sm'} p-4 rounded-xl border transition-colors`}>
              
              <div className={`flex items-center gap-2 ${isExporting ? 'bg-transparent' : 'bg-slate-50 border border-slate-200'} rounded-lg px-3 py-2 flex-shrink-0 mt-1`}>
                <MapPin className="w-5 h-5 text-indigo-500" />
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors pr-2 appearance-none"
                  style={isExporting ? { WebkitAppearance: 'none', MozAppearance: 'none' } : {}}
                >
                  <option value="全部">全台北市 (所有行政區)</option>
                  {availableDistrictsList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {!isExporting && <div className="hidden lg:block w-px min-h-[40px] h-full bg-slate-200 self-stretch mx-1"></div>}

              {/* ★ 修正標籤排列：改用 flex-wrap，允許多行延展，解決遮擋問題 */}
              <div className="flex-1 flex flex-col sm:flex-row sm:items-start gap-3 min-w-0 w-full">
                <div className="text-sm font-bold text-slate-500 flex-shrink-0 flex items-center mt-2">
                  <Layers className="w-4 h-4 mr-1.5" /> 顯示項目 ({selectedCategories.size})：
                </div>
                <div className="flex-1 flex flex-wrap gap-2 pt-1 pb-1">
                  {availableCategories.map((cat) => {
                    const isSelected = selectedCategories.has(cat);
                    const style = getStyleForCategory(cat);
                    return (
                      <button
                        key={cat} onClick={() => toggleCategory(cat)}
                        className={`
                          px-4 py-1.5 rounded-md text-sm font-bold transition-all duration-200 flex items-center gap-1.5 border
                          ${isSelected ? `${style.bg} border-transparent text-white shadow-md transform -translate-y-px` : `bg-white ${style.border} text-slate-500 hover:bg-slate-50`}
                        `}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 items-start pb-10">
              {dashboardData.map((item) => (
                <div key={item.categoryName} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col transition-all">
                  
                  <div className={`${item.style.bg} px-4 py-4 text-center`}>
                    <h2 className={`text-lg font-bold ${item.style.textLight} tracking-wide truncate`} title={item.categoryName}>
                      {item.categoryName}
                    </h2>
                  </div>
                  
                  <div className={`${item.style.lightBg} py-2 text-center border-b border-slate-100`}>
                    <span className={`text-sm font-bold ${item.style.text}`}>
                      符合條件案件：<span className="text-xl">{item.totalCases.toLocaleString()}</span> 筆
                    </span>
                  </div>

                  <div className="p-4 flex flex-col gap-6">
                    <div>
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b-2 border-slate-200 text-slate-500">
                            <th className="pb-2 font-bold w-12 text-center">排</th>
                            <th className="pb-2 font-bold">路段名稱</th>
                            <th className="pb-2 font-bold text-right">次數</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.topStreets.length > 0 ? item.topStreets.map((rank, index) => (
                            <tr key={rank.name} className="border-b border-slate-100 even:bg-slate-50/70 hover:bg-slate-100 transition-colors">
                              <td className="py-2 text-center">
                                <span className={`inline-block w-6 h-6 rounded text-xs font-bold leading-6 text-white ${item.style.bg} shadow-sm`}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="py-2 font-medium text-slate-700 truncate max-w-[120px]" title={rank.name}>{rank.name}</td>
                              <td className="py-2 text-right font-bold text-slate-600">{rank.count}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan="3" className="py-6 text-center text-slate-400">此區域無路段資料</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* ★ 修正行政區列表：移除限制高度的 class，讓容器自然撐開完整顯示所有區域 */}
                    {selectedDistrict === '全部' && item.districts.length > 0 && (
                      <div className="pt-4 border-t border-slate-200">
                        <h3 className="text-center text-sm font-bold text-slate-600 mb-4 flex items-center justify-center gap-1.5">
                          <Map className="w-4 h-4" /> 跨區分布對比 (全數展開)
                        </h3>
                        <div className="space-y-2">
                          {item.districts.map((d) => {
                            const widthPct = Math.max((d.count / item.maxDistrictCount) * 100, 2);
                            return (
                              <div key={d.name} className="flex items-center text-xs group">
                                <span className="w-12 text-right mr-3 text-slate-600 font-bold group-hover:text-slate-900">{d.name}</span>
                                <div className="flex-1 h-3.5 bg-slate-100 rounded-sm overflow-hidden">
                                  <div 
                                    className={`h-full ${item.style.fill} transition-all duration-1000 ease-out`} 
                                    style={{ width: `${widthPct}%` }}
                                  ></div>
                                </div>
                                <span className="w-8 text-right ml-3 font-bold text-slate-500">{d.count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {selectedCategories.size === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 font-bold">
                  請選擇上方標籤以顯示圖表資料
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}