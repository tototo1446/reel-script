
import React, { useState, useEffect } from 'react';
import { AppMode, AnalysisData, GeneratedScript } from './types';
import { DEFAULT_PATTERNS, TONES, BUZZ_THRESHOLD } from './constants';
import { analyzeCompetitorReel, generateSmartScript } from './services/geminiService';
import { AnalysisCard } from './components/AnalysisCard';
import { ScriptViewer } from './components/ScriptViewer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('ANALYSIS');
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [genTheme, setGenTheme] = useState('');
  const [genTone, setGenTone] = useState(TONES[0]);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initial Mock Data
  useEffect(() => {
    const mockAnalyses: AnalysisData[] = [
      {
        id: '1',
        title: '時短料理系・爆伸びリール',
        views: 1200000,
        followers: 150000,
        buzzRate: 8.0,
        duration: 45,
        transcription: 'こんにちは！今日は10分で作れる絶品パスタをご紹介します。まずはお湯を沸かして...',
        structure: {
          hook: '「まだお湯沸かしてるの？」と問いかける冒頭3秒',
          problem: '帰宅後の疲労感と空腹',
          solution: '電子レンジだけで完結するレシピ提示',
          cta: '保存して週末作ってみてね'
        },
        direction: {
          camera: '手元アップ中心',
          person: '顔出しなし、エプロンのみ',
          caption: '黄色背景に黒文字の太字テロップ'
        },
        createdAt: new Date().toISOString()
      }
    ];
    setAnalyses(mockAnalyses);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsAnalyzing(true);
    try {
      // In a real app, we'd extract text/metadata from video. 
      // Here we simulate with a random competitor transcript.
      const mockInput = "ダイエット中に食べていい深夜食。コンビニで買える3選を紹介。1.ゆで卵 2.サラダチキン 3.おでん。最後が一番おすすめ。いいねして見返してね。";
      const result = await analyzeCompetitorReel(mockInput);
      
      const newAnalysis: AnalysisData = {
        id: Math.random().toString(36).substr(2, 9),
        title: result.title || '新規分析ビデオ',
        views: Math.floor(Math.random() * 500000) + 100000,
        followers: Math.floor(Math.random() * 50000) + 10000,
        buzzRate: 0,
        duration: 30,
        transcription: result.transcription || '',
        structure: result.structure || { hook: '', problem: '', solution: '', cta: '' },
        direction: result.direction || { camera: '', person: '', caption: '' },
        createdAt: new Date().toISOString()
      };
      newAnalysis.buzzRate = newAnalysis.views / newAnalysis.followers;

      setAnalyses(prev => [newAnalysis, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteAnalysis = (id: string) => {
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const handleGenerate = async () => {
    if (genTheme.length < 10) {
      alert("テーマをもう少し詳しく入力してください（10文字以上）");
      return;
    }
    setIsGenerating(true);
    try {
      const selectedAnalyses = analyses.filter(a => a.buzzRate >= BUZZ_THRESHOLD);
      const script = await generateSmartScript(genTheme, genTone, selectedAnalyses);
      setGeneratedScript(script);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const growthData = [
    { date: '02/01', accuracy: 65, revisions: 12 },
    { date: '02/05', accuracy: 72, revisions: 8 },
    { date: '02/10', accuracy: 78, revisions: 5 },
    { date: '02/15', accuracy: 85, revisions: 3 },
    { date: '02/20', accuracy: 92, revisions: 2 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
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

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {mode === 'ANALYSIS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">分析アーカイブ</h2>
                <p className="text-zinc-400 text-sm">競合の動画をアップロードして「勝ちの3層構造」を解剖します。</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium border border-zinc-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  拡張機能から同期
                </button>
                <label className="cursor-pointer px-6 py-2 buzz-gradient rounded-xl text-sm font-bold shadow-lg hover:shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  新規動画アップロード
                  <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleUpload} />
                </label>
              </div>
            </section>

            {isAnalyzing && (
              <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center border-dashed border-2 border-pink-500/30">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-pink-400 font-bold animate-pulse">AIが動画を3層構造に解剖中...</p>
                <p className="text-zinc-500 text-xs mt-2">（音声解析・構成分解・演出言語化を実行しています）</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {analyses.length > 0 ? (
                analyses.map(analysis => (
                  <AnalysisCard 
                    key={analysis.id} 
                    data={analysis} 
                    onDelete={deleteAnalysis} 
                  />
                ))
              ) : (
                <div className="text-center py-20 text-zinc-600 italic">
                  まだ分析データがありません。動画をアップロードして始めましょう。
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
                        <button key={p.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-pink-500/50 transition-all text-left">
                          <div className="text-xl mb-1">{p.icon}</div>
                          <div className="text-[10px] font-bold text-zinc-300">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">2. テーマ・伝えたい内容（100文字以上推奨）</label>
                    <textarea 
                      value={genTheme}
                      onChange={(e) => setGenTheme(e.target.value)}
                      placeholder="例：新商品の美容液を紹介したい。競合Aの『悩み解決型』フックを使いつつ、成分の凄さをエモーショナルに伝えたい..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all resize-none"
                    ></textarea>
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
                  <div className="text-3xl font-bold text-emerald-400">92.4%</div>
                  <div className="text-[10px] text-zinc-500 mt-2">過去20回の修正履歴から算出</div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold uppercase mb-1">平均バズ指数</div>
                  <div className="text-3xl font-bold text-pink-500">x6.2</div>
                  <div className="text-[10px] text-zinc-500 mt-2">自社投稿のインプレッション平均</div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold uppercase mb-1">保持ナレッジ</div>
                  <div className="text-3xl font-bold text-blue-400">14 <span className="text-sm font-normal text-zinc-600">Patterns</span></div>
                  <div className="text-[10px] text-zinc-500 mt-2">最新のトレンドに基づく構成案</div>
                </div>
             </section>

             <section className="glass p-8 rounded-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  生成台本の「自分好み」への進化
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData}>
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
                <p className="text-xs text-zinc-500 mt-4 text-center italic">
                  ユーザーが修正を加えるほど、AIはあなたのブランドトーンを学習し、修正不要な台本を出力するようになります。
                </p>
             </section>
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
