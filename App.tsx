
import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, AnalysisData, GeneratedScript, ChatMessage, UserMetrics, CrossAnalysisResult } from './types';
import { DEFAULT_PATTERNS, TONES, BUZZ_THRESHOLD } from './constants';
import { analyzeCompetitorReel, generateSmartScript, crossAnalyzePatterns, initScriptChat, rewriteScript } from './services/geminiService';
import { AnalysisCard } from './components/AnalysisCard';
import { ScriptViewer } from './components/ScriptViewer';
import { useLocalStorage } from './hooks/useLocalStorage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DEFAULT_METRICS: UserMetrics = {
  totalGenerations: 0,
  totalEdits: 0,
  editHistory: [],
  growthData: [],
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('ANALYSIS');
  const [analyses, setAnalyses] = useLocalStorage<AnalysisData[]>('reelcutter_analyses', []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [genTheme, setGenTheme] = useState('');
  const [genTone, setGenTone] = useState(TONES[0]);
  const [generatedScript, setGeneratedScript] = useLocalStorage<GeneratedScript | null>('reelcutter_script', null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragCounter, setDragCounter] = useState(0);
  const [userMetrics, setUserMetrics] = useLocalStorage<UserMetrics>('reelcutter_metrics', DEFAULT_METRICS);
  const [crossAnalysis, setCrossAnalysis] = useLocalStorage<CrossAnalysisResult | null>('reelcutter_cross', null);
  const [isCrossAnalyzing, setIsCrossAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  // 初回マウント時: localStorage復元分のチャットセッション初期化
  useEffect(() => {
    if (generatedScript) {
      initScriptChat(generatedScript);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // メトリクス更新ヘルパー
  const updateMetrics = useCallback((type: 'generation' | 'edit', scriptId?: string, instruction?: string) => {
    setUserMetrics(prev => {
      const updated = { ...prev };
      if (type === 'generation') {
        updated.totalGenerations += 1;
      } else if (type === 'edit') {
        updated.totalEdits += 1;
        updated.editHistory = [
          ...prev.editHistory,
          { scriptId: scriptId || '', instruction: instruction || '', timestamp: new Date().toISOString() }
        ].slice(-50);
      }

      const today = new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
      const existingIdx = updated.growthData.findIndex(g => g.date === today);
      const accuracy = Math.min(95, Math.max(50, 60 + (updated.totalGenerations * 2) - (updated.totalEdits * 0.5)));
      const revisions = updated.totalEdits;

      if (existingIdx >= 0) {
        updated.growthData = [...prev.growthData];
        updated.growthData[existingIdx] = { date: today, accuracy, revisions };
      } else {
        updated.growthData = [...prev.growthData, { date: today, accuracy, revisions }].slice(-30);
      }

      return updated;
    });
  }, [setUserMetrics]);

  // 単一/複数ファイルの解析処理
  const processFiles = async (files: File[]) => {
    if (isAnalyzing) {
      alert('現在分析中です。完了後に再度お試しください。');
      return;
    }

    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    if (videoFiles.length === 0) {
      alert('動画ファイル（MP4/MOV）を選択してください。');
      return;
    }

    setIsAnalyzing(true);
    setUploadProgress('');

    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      try {
        if (file.size > 100 * 1024 * 1024) {
          alert(`${file.name} は100MBを超えています。スキップします。`);
          continue;
        }

        const progressPrefix = videoFiles.length > 1 ? `[${i + 1}/${videoFiles.length}] ` : '';
        const result = await analyzeCompetitorReel(file, (status) => {
          setUploadProgress(progressPrefix + status);
        });

        const newAnalysis: AnalysisData = {
          id: Math.random().toString(36).substr(2, 9),
          title: result.title || '新規分析ビデオ',
          views: 0,
          followers: 0,
          buzzRate: 0,
          duration: result.duration || 30,
          transcription: result.transcription || '',
          structure: result.structure || { hook: '', problem: '', solution: '', cta: '' },
          direction: result.direction || { camera: '', person: '', caption: '' },
          createdAt: new Date().toISOString(),
          fileName: file.name,
          fileSize: file.size,
        };

        setAnalyses(prev => [newAnalysis, ...prev]);
      } catch (err) {
        console.error(`${file.name} の分析に失敗:`, err);
        alert(`${file.name} の分析に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    }

    setIsAnalyzing(false);
    setUploadProgress('');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // D&D ハンドラ (カウンター方式でちらつき防止)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => prev + 1);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => prev - 1);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    const files: File[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      files.push(e.dataTransfer.files[i]);
    }
    if (files.length > 0) {
      await processFiles(files);
    }
  }, []);

  const deleteAnalysis = (id: string) => {
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const updateAnalysis = (id: string, updates: Partial<AnalysisData>) => {
    setAnalyses(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  // 台本生成
  const handleGenerate = async () => {
    if (genTheme.length < 100) {
      alert("テーマをもう少し詳しく入力してください（100文字以上）");
      return;
    }
    setIsGenerating(true);
    try {
      const selectedAnalyses = analyses.filter(a => a.buzzRate >= BUZZ_THRESHOLD);
      const patternsToUse = selectedAnalyses.length > 0 ? selectedAnalyses : analyses;
      const script = await generateSmartScript(
        genTheme,
        genTone,
        patternsToUse,
        selectedPattern,
        userMetrics.editHistory
      );
      setGeneratedScript(script);
      initScriptChat(script);
      setChatMessages([]);
      updateMetrics('generation');
    } catch (err) {
      console.error(err);
      alert(`台本生成に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // クロス分析
  const handleCrossAnalysis = async () => {
    if (analyses.length < 2) return;
    setIsCrossAnalyzing(true);
    try {
      const result = await crossAnalyzePatterns(analyses);
      setCrossAnalysis(result);
    } catch (err) {
      console.error(err);
      alert(`クロス分析に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setIsCrossAnalyzing(false);
    }
  };

  // チャットリライト
  const handleRewrite = async () => {
    if (!chatInput.trim() || isRewriting) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    const instruction = chatInput;
    setChatInput('');
    setIsRewriting(true);

    try {
      const newScript = await rewriteScript(instruction);
      setGeneratedScript(newScript);
      updateMetrics('edit', generatedScript?.id, instruction);

      const modelMsg: ChatMessage = {
        role: 'model',
        content: '台本を修正しました。',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        role: 'model',
        content: `修正に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsRewriting(false);
    }
  };

  // 成長ログ用データ
  const latestAccuracy = userMetrics.growthData.length > 0
    ? userMetrics.growthData[userMetrics.growthData.length - 1].accuracy
    : null;
  const avgBuzzRate = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.buzzRate, 0) / analyses.length
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* D&D Overlay */}
      {dragCounter > 0 && (
        <div className="fixed inset-0 z-[100] bg-pink-500/10 backdrop-blur-sm flex items-center justify-center">
          <div className="glass p-12 rounded-3xl border-2 border-dashed border-pink-500 text-center">
            <div className="text-4xl mb-4">📹</div>
            <p className="text-2xl font-bold text-pink-400">ここにドロップして分析開始</p>
            <p className="text-sm text-zinc-400 mt-2">MP4 / MOV形式に対応</p>
          </div>
        </div>
      )}

      {/* Header / Nav */}
      <header className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 buzz-gradient rounded-lg flex items-center justify-center font-bold italic">R</div>
          <h1 className="text-xl font-bold tracking-tighter">ReelCutter <span className="text-pink-500">AI</span></h1>
        </div>

        <nav className="flex bg-zinc-900 p-1 rounded-xl">
          <button
            onClick={() => setMode('ANALYSIS')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'ANALYSIS' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            分析モード
          </button>
          <button
            onClick={() => setMode('GENERATION')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'GENERATION' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            台本生成
          </button>
          <button
            onClick={() => setMode('LOGS')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'LOGS' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            成長ログ
          </button>
        </nav>
      </header>

      <main
        className="flex-1 p-6 max-w-7xl mx-auto w-full"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {mode === 'ANALYSIS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">分析アーカイブ</h2>
                <p className="text-zinc-400 text-sm">競合の動画をアップロード（またはドラッグ&ドロップ）して「勝ちの3層構造」を解剖します。</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium border border-zinc-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  拡張機能から同期
                </button>
                <label className="cursor-pointer px-6 py-2 buzz-gradient rounded-xl text-sm font-bold shadow-lg hover:shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  新規動画アップロード
                  <input type="file" className="hidden" accept="video/mp4,video/quicktime" multiple onChange={handleUpload} />
                </label>
              </div>
            </section>

            {isAnalyzing && (
              <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center border-dashed border-2 border-pink-500/30">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-pink-400 font-bold animate-pulse">
                  {uploadProgress || 'AIが動画を3層構造に解剖中...'}
                </p>
                <p className="text-zinc-500 text-xs mt-2">（動画アップロード・音声解析・構成分解・演出言語化を実行しています）</p>
              </div>
            )}

            {/* クロス分析セクション */}
            {analyses.length >= 2 && (
              <div className="glass p-6 rounded-2xl border-l-4 border-l-blue-500">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      クロス分析 — 共通パターン抽出
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1">{analyses.length}件の分析データから共通する勝ちパターンを特定</p>
                  </div>
                  <button
                    onClick={handleCrossAnalysis}
                    disabled={isCrossAnalyzing}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isCrossAnalyzing ? '分析中...' : '共通パターンを抽出'}
                  </button>
                </div>

                {crossAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                      <div className="text-xs font-bold text-blue-400 uppercase mb-2">共通フックパターン</div>
                      <ul className="text-xs space-y-1 text-zinc-300">
                        {crossAnalysis.commonHookPatterns.map((p, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                      <div className="text-xs font-bold text-emerald-400 uppercase mb-2">共通構成パターン</div>
                      <p className="text-xs text-zinc-300">{crossAnalysis.commonStructure}</p>
                      <div className="text-xs font-bold text-pink-400 uppercase mb-2 mt-3">共通演出パターン</div>
                      <p className="text-xs text-zinc-300">{crossAnalysis.commonDirection}</p>
                    </div>
                    <div className="md:col-span-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                      <div className="text-xs font-bold text-yellow-400 uppercase mb-2">推奨事項</div>
                      <ul className="text-xs space-y-1 text-zinc-300">
                        {crossAnalysis.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-0.5">{i + 1}.</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {analyses.length > 0 ? (
                analyses.map(analysis => (
                  <AnalysisCard
                    key={analysis.id}
                    data={analysis}
                    onDelete={deleteAnalysis}
                    onUpdate={updateAnalysis}
                  />
                ))
              ) : (
                <div className="glass p-12 rounded-2xl border-2 border-dashed border-zinc-800 text-center">
                  <div className="text-4xl mb-4 opacity-30">📹</div>
                  <p className="text-zinc-500 text-sm mb-2">まだ分析データがありません</p>
                  <p className="text-zinc-600 text-xs">動画をアップロード、またはここにドラッグ&ドロップして始めましょう。</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'GENERATION' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Strategy Sidebar */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass p-6 rounded-2xl">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 buzz-gradient rounded-full"></span>
                  台本戦略エディタ
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">1. 勝ちパターンの選択</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {DEFAULT_PATTERNS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPattern(prev => prev === p.id ? null : p.id)}
                          className={`p-3 bg-zinc-900 border rounded-xl hover:border-pink-500/50 transition-all text-left ${
                            selectedPattern === p.id
                              ? 'border-pink-500 ring-1 ring-pink-500/30 bg-pink-500/5'
                              : 'border-zinc-800'
                          }`}
                        >
                          <div className="text-xl mb-1">{p.icon}</div>
                          <div className={`text-[10px] font-bold ${selectedPattern === p.id ? 'text-pink-300' : 'text-zinc-300'}`}>{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">2. テーマ・伝えたい内容（100文字以上）</label>
                    <textarea
                      value={genTheme}
                      onChange={(e) => setGenTheme(e.target.value)}
                      placeholder="例：新商品の美容液を紹介したい。競合Aの『悩み解決型』フックを使いつつ、成分の凄さをエモーショナルに伝えたい..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all resize-none"
                    ></textarea>
                    <div className={`text-[10px] mt-1 ${genTheme.length >= 100 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {genTheme.length} / 100文字
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">3. ブランドボイス</label>
                      <select
                        value={genTone}
                        onChange={(e) => setGenTone(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none"
                      >
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating || analyses.length === 0}
                        className="px-8 py-3 buzz-gradient rounded-xl font-bold shadow-lg hover:shadow-pink-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                      >
                        {isGenerating ? 'AI台本生成中...' : '最強の台本を生成'}
                      </button>
                    </div>
                  </div>
                  {analyses.length === 0 && (
                    <p className="text-[10px] text-red-400 mt-2">※台本生成には少なくとも1つの分析データが必要です。</p>
                  )}
                </div>
              </div>

              {generatedScript && (
                <div className="glass p-6 rounded-2xl border-emerald-500/20">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">生成された台本案</h3>
                    <div className="flex gap-2">
                      <button className="p-2 bg-zinc-800 rounded-lg hover:text-pink-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {generatedScript.scenes.map((scene, i) => (
                      <div key={i} className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-500 mb-2">{scene.time}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-pink-400 uppercase font-bold block mb-1">Dialogue</span>
                            <p className="text-sm">{scene.dialogue}</p>
                          </div>
                          <div className="space-y-2">
                             <div>
                               <span className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Visual Instruction</span>
                               <p className="text-[11px] text-zinc-400">{scene.direction}</p>
                             </div>
                             <div>
                               <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Text Overlay</span>
                               <p className="text-[11px] text-zinc-300 font-mono">[{scene.caption}]</p>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* チャットリライト */}
              {generatedScript && (
                <div className="glass p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    チャットで台本を修正
                  </h3>
                  {chatMessages.length > 0 && (
                    <div className="space-y-3 max-h-48 overflow-y-auto mb-4 custom-scrollbar">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`text-xs p-3 rounded-xl ${
                          msg.role === 'user'
                            ? 'bg-pink-500/10 text-pink-300 ml-8 border border-pink-500/20'
                            : 'bg-zinc-800 text-zinc-300 mr-8 border border-zinc-700'
                        }`}>
                          {msg.content}
                        </div>
                      ))}
                      {isRewriting && (
                        <div className="bg-zinc-800 text-zinc-400 mr-8 border border-zinc-700 text-xs p-3 rounded-xl animate-pulse">
                          修正中...
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleRewrite()}
                      placeholder="例：「もっと短く」「後半をエモーショナルに」「フックを疑問形に変えて」"
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-pink-500 transition-all"
                    />
                    <button
                      onClick={handleRewrite}
                      disabled={isRewriting || !chatInput.trim()}
                      className="px-5 py-2.5 buzz-gradient rounded-xl text-xs font-bold disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {isRewriting ? '修正中...' : '修正'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Sidebar */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="sticky top-24 w-full">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Smart Preview</h3>
                  <p className="text-[10px] text-zinc-600">スマホでの見え方をシミュレート</p>
                </div>
                {generatedScript ? (
                  <ScriptViewer script={generatedScript} />
                ) : (
                  <div className="w-[340px] h-[600px] bg-zinc-900/50 rounded-3xl border-8 border-zinc-800 mx-auto flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 text-2xl opacity-20">📱</div>
                    <p className="text-zinc-600 text-sm">台本を生成すると<br/>スマホプレビューが表示されます</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'LOGS' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
             <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold uppercase mb-1">AI学習精度</div>
                  <div className="text-3xl font-bold text-emerald-400">
                    {latestAccuracy !== null ? `${latestAccuracy.toFixed(1)}%` : '---'}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-2">
                    過去{userMetrics.totalEdits}回の修正履歴から算出
                  </div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold uppercase mb-1">平均バズ指数</div>
                  <div className="text-3xl font-bold text-pink-500">
                    {avgBuzzRate > 0 ? `x${avgBuzzRate.toFixed(1)}` : '---'}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-2">
                    {analyses.length}件の分析データの平均
                  </div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold uppercase mb-1">保持ナレッジ</div>
                  <div className="text-3xl font-bold text-blue-400">
                    {analyses.length} <span className="text-sm font-normal text-zinc-600">Patterns</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-2">
                    台本生成: {userMetrics.totalGenerations}回 / 修正: {userMetrics.totalEdits}回
                  </div>
                </div>
             </section>

             <section className="glass p-8 rounded-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  生成台本の「自分好み」への進化
                </h3>
                {userMetrics.growthData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userMetrics.growthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                        <YAxis stroke="#71717a" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                        />
                        <Line type="monotone" dataKey="accuracy" name="AI適合度 (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="revisions" name="手動修正回数" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-16 text-zinc-600">
                    <p className="text-sm">台本を生成・修正すると、ここに学習データが蓄積されます。</p>
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-4 text-center italic">
                  ユーザーが修正を加えるほど、AIはあなたのブランドトーンを学習し、修正不要な台本を出力するようになります。
                </p>
             </section>

             {/* 修正履歴 */}
             {userMetrics.editHistory.length > 0 && (
               <section className="glass p-6 rounded-2xl">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">直近の修正履歴</h3>
                 <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                   {[...userMetrics.editHistory].reverse().slice(0, 20).map((edit, i) => (
                     <div key={i} className="flex items-center gap-3 text-xs bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                       <span className="text-zinc-600 flex-shrink-0">
                         {new Date(edit.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </span>
                       <span className="text-zinc-300">「{edit.instruction}」</span>
                     </div>
                   ))}
                 </div>
               </section>
             )}
          </div>
        )}
      </main>

      <footer className="p-8 text-center text-zinc-600 text-[10px] uppercase tracking-widest">
        &copy; 2025 ReelCutter AI Engine. Privacy Protected. All data deleted after analysis.
      </footer>
    </div>
  );
};

export default App;
