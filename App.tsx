
import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, AnalysisData, GeneratedScript, ChatMessage, UserMetrics, CrossAnalysisResult, SceneExtractionSession, SceneViewMode, SceneAnalysis, SceneReferenceData } from './types';
import { DEFAULT_PATTERNS, TONES, BUZZ_THRESHOLD } from './constants';
import { generateSmartScript, crossAnalyzePatterns, initScriptChat, rewriteScript, analyzeSceneFrames, analyzeVideoOverall } from './services/geminiService';
import { detectSceneTimestamps } from './services/sceneDetectionService';
import { ScriptViewer } from './components/ScriptViewer';
import { SceneUploader } from './components/SceneUploader';
import { SceneHeader } from './components/SceneHeader';
import { SceneToolbar } from './components/SceneToolbar';
import { SceneGrid } from './components/SceneGrid';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { AnalysisProgressCard } from './components/AnalysisProgressCard';
import { SessionHistoryList, SessionHistoryItem } from './components/SessionHistoryList';
import { SessionSelector } from './components/SessionSelector';
import { OverallAnalysisCard } from './components/OverallAnalysisCard';
import { VideoTitleDialog } from './components/VideoTitleDialog';
import { useLocalStorage } from './hooks/useLocalStorage';
import { extractFramesAtTimestamps, ExtractionProgress } from './utils/videoFrameExtractor';
import { downloadSceneThumbnail, downloadScenesTsv, downloadScenesZip } from './utils/downloadHelper';
import { saveSessionToSupabase, updateSceneAnalysis, updateSessionAnalysisStatus, updateOverallAnalysis, updateVideoTitle, fetchSessions, fetchScenes, deleteSession as deleteSessionFromSupabase } from './services/supabaseService';
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
  const [genTheme, setGenTheme] = useState('');
  const [genTone, setGenTone] = useState(TONES[0]);
  const [generatedScript, setGeneratedScript] = useLocalStorage<GeneratedScript | null>('reelcutter_script', null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [userMetrics, setUserMetrics] = useLocalStorage<UserMetrics>('reelcutter_metrics', DEFAULT_METRICS);
  const [crossAnalysis, setCrossAnalysis] = useLocalStorage<CrossAnalysisResult | null>('reelcutter_cross', null);
  const [isCrossAnalyzing, setIsCrossAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  // シーン分析 state
  const [sceneSession, setSceneSession] = useState<SceneExtractionSession | null>(null);
  const [sceneViewMode, setSceneViewMode] = useState<SceneViewMode>('grid');
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [supabaseSessionId, setSupabaseSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pastSessions, setPastSessions] = useState<SessionHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [overallAnalysisProgress, setOverallAnalysisProgress] = useState<string>('');
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [scriptReferenceIds, setScriptReferenceIds] = useLocalStorage<string[]>('reelcutter_script_refs', []);

  // 初回マウント時: localStorage復元 + 過去セッション取得
  useEffect(() => {
    if (generatedScript) {
      initScriptChat(generatedScript);
    }
    // 過去セッション取得
    fetchSessions().then(sessions => setPastSessions(sessions));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // videoObjectUrl のクリーンアップ
  useEffect(() => {
    return () => {
      if (sceneSession?.videoObjectUrl) {
        URL.revokeObjectURL(sceneSession.videoObjectUrl);
      }
    };
  }, [sceneSession?.videoObjectUrl]);

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

  // === シーン分析ハンドラー ===

  const handleSceneExtraction = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      alert('100MBを超えるファイルはアップロードできません。');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(null);
    setVideoFile(file);

    try {
      // Phase 1: Python/コードでカット検出（分析はGemini 2.5 Flashで後段で実行）
      setExtractionProgress({
        current: 0,
        total: 1,
        percentage: 0,
        phase: 'detecting',
        status: 'カットを検出中...',
      });

      let timestamps: number[];
      try {
        timestamps = await detectSceneTimestamps(file, (status) =>
          setExtractionProgress((p) => (p ? { ...p, status } : p))
        );
      } catch (detectErr) {
        console.warn('場面検出に失敗、等間隔でフォールバック:', detectErr);
        // フォールバック: 3秒間隔で抽出（重複を減らす）
        const { duration } = await new Promise<{ duration: number }>((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const v = document.createElement('video');
          v.src = url;
          v.onloadedmetadata = () => {
            resolve({ duration: v.duration });
            URL.revokeObjectURL(url);
          };
          v.onerror = () => reject(new Error('動画の読み込みに失敗'));
        });
        timestamps = [];
        for (let t = 0; t < duration; t += 3) timestamps.push(t);
        if (timestamps[timestamps.length - 1] !== duration - 0.1) {
          timestamps.push(Math.max(0, duration - 0.5));
        }
      }

      if (timestamps.length === 0) {
        timestamps = [0];
      }

      // Phase 2: 検出したタイムスタンプでフレーム抽出
      const { frames, duration, videoObjectUrl } = await extractFramesAtTimestamps(
        file,
        timestamps,
        { quality: 0.8 },
        (progress) => setExtractionProgress({ ...progress, phase: 'extracting' })
      );

      const session: SceneExtractionSession = {
        id: Math.random().toString(36).substr(2, 9),
        videoFileName: file.name,
        videoTitle: file.name,
        videoFileSize: file.size,
        videoDuration: duration,
        videoObjectUrl,
        scenes: frames,
        totalScenes: frames.length,
        extractionStatus: 'extracted',
        analysisStatus: 'idle',
        analysisProgress: { current: 0, total: frames.length, percentage: 0 },
        overallAnalysis: null,
        overallAnalysisStatus: 'idle',
        createdAt: new Date().toISOString(),
      };

      setSceneSession(session);

      // タイトル入力ダイアログを表示（確定後にSupabase保存）
      setShowTitleDialog(true);
    } catch (err) {
      alert(`シーン抽出に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  };

  const handleStartSceneAnalysis = async () => {
    if (!sceneSession) return;

    setSceneSession(prev => prev ? {
      ...prev,
      analysisStatus: 'analyzing',
      analysisProgress: { current: 0, total: prev.totalScenes, percentage: 0 },
      overallAnalysisStatus: videoFile ? 'analyzing' : prev.overallAnalysisStatus,
    } : null);

    // Supabase: 分析開始ステータス更新
    if (supabaseSessionId) {
      updateSessionAnalysisStatus(supabaseSessionId, 'analyzing');
    }

    // シーンフレーム分析（既存）
    const sceneAnalysisPromise = (async () => {
      try {
        await analyzeSceneFrames(
          sceneSession.scenes,
          (sceneId: string, analysis: SceneAnalysis) => {
            setSceneSession(prev => {
              if (!prev) return null;
              const scene = prev.scenes.find(s => s.id === sceneId);
              const updatedScenes = prev.scenes.map(s =>
                s.id === sceneId ? { ...s, analysis, analysisStatus: 'completed' as const } : s
              );
              const completedCount = updatedScenes.filter(s => s.analysisStatus === 'completed').length;

              // Supabase: 個別シーンの分析結果を保存
              if (supabaseSessionId && scene) {
                updateSceneAnalysis(supabaseSessionId, scene.sceneNumber, analysis);
              }

              return {
                ...prev,
                scenes: updatedScenes,
                analysisProgress: {
                  current: completedCount,
                  total: prev.totalScenes,
                  percentage: Math.round((completedCount / prev.totalScenes) * 100)
                }
              };
            });
          },
          (current: number, _total: number) => {
            setSceneSession(prev => {
              if (!prev) return null;
              const updatedScenes = prev.scenes.map((s, i) =>
                i === current - 1 ? { ...s, analysisStatus: 'analyzing' as const } : s
              );
              return { ...prev, scenes: updatedScenes };
            });
          }
        );
        setSceneSession(prev => prev ? { ...prev, analysisStatus: 'completed' } : null);
        if (supabaseSessionId) {
          updateSessionAnalysisStatus(supabaseSessionId, 'completed');
        }
      } catch (err) {
        setSceneSession(prev => prev ? { ...prev, analysisStatus: 'error' } : null);
        if (supabaseSessionId) {
          updateSessionAnalysisStatus(supabaseSessionId, 'error');
        }
        throw err;
      }
    })();

    // 動画全体分析（音声込み）— videoFileがある場合のみ並列実行
    const overallAnalysisPromise = videoFile ? (async () => {
      try {
        setOverallAnalysisProgress('動画をアップロード中...');
        const result = await analyzeVideoOverall(videoFile, (status) => {
          setOverallAnalysisProgress(status);
        });
        setSceneSession(prev => prev ? {
          ...prev,
          overallAnalysis: result,
          overallAnalysisStatus: 'completed',
        } : null);
        setOverallAnalysisProgress('動画全体分析完了');
        // Supabase: 全体分析結果を保存
        if (supabaseSessionId) {
          updateOverallAnalysis(supabaseSessionId, result);
        }
      } catch (err) {
        console.error('動画全体分析エラー:', err);
        setSceneSession(prev => prev ? { ...prev, overallAnalysisStatus: 'error' } : null);
        setOverallAnalysisProgress('動画全体分析に失敗しました');
        // 全体分析の失敗はシーン分析を止めない
      }
    })() : Promise.resolve();

    try {
      await Promise.all([sceneAnalysisPromise, overallAnalysisPromise]);
      // 両方完了後にセッション一覧を更新
      if (supabaseSessionId) {
        const sessions = await fetchSessions();
        setPastSessions(sessions);
      }
    } catch (err) {
      alert(`AI分析に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  const handleSelectAll = () => {
    setSceneSession(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => ({ ...s, isSelected: true }))
    } : null);
  };

  const handleDeselectAll = () => {
    setSceneSession(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => ({ ...s, isSelected: false }))
    } : null);
  };

  const handleToggleSceneSelection = (id: string) => {
    setSceneSession(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, isSelected: !s.isSelected } : s)
    } : null);
  };

  const handleClearScenes = () => {
    if (sceneSession?.videoObjectUrl) {
      URL.revokeObjectURL(sceneSession.videoObjectUrl);
    }
    setSceneSession(null);
    setSupabaseSessionId(null);
    setVideoFile(null);
    setOverallAnalysisProgress('');
  };

  const handleLoadSessionFromHistory = async (session: SessionHistoryItem) => {
    setIsLoadingHistory(true);
    try {
      const scenes = await fetchScenes(session.id);
      const restored: SceneExtractionSession = {
        id: session.id,
        videoFileName: session.video_file_name,
        videoTitle: session.video_title || session.video_file_name,
        videoFileSize: session.video_file_size ?? 0,
        videoDuration: session.video_duration ?? 0,
        videoObjectUrl: '', // 過去セッションは動画なし
        scenes,
        totalScenes: scenes.length,
        extractionStatus: 'extracted',
        analysisStatus: session.analysis_status as SceneExtractionSession['analysisStatus'],
        analysisProgress: { current: scenes.length, total: scenes.length, percentage: 100 },
        overallAnalysis: session.overall_analysis ?? null,
        overallAnalysisStatus: session.overall_analysis ? 'completed' : 'idle',
        createdAt: session.created_at,
      };
      setSceneSession(restored);
      setSupabaseSessionId(session.id);
      setShowVideoPreview(false);
    } catch (err) {
      console.error('履歴の読み込みに失敗:', err);
      alert('履歴の読み込みに失敗しました。');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteSessionFromHistory = async (sessionId: string) => {
    try {
      await deleteSessionFromSupabase(sessionId);
      if (supabaseSessionId === sessionId) {
        handleClearScenes();
      }
      const sessions = await fetchSessions();
      setPastSessions(sessions);
    } catch (err) {
      console.error('削除に失敗:', err);
      alert('削除に失敗しました。');
    }
  };

  const handleVideoTitleChange = async (newTitle: string) => {
    // ローカルstateを即時更新
    setSceneSession(prev => prev ? { ...prev, videoTitle: newTitle } : null);

    // Supabaseに保存
    if (supabaseSessionId) {
      try {
        await updateVideoTitle(supabaseSessionId, newTitle);
        // 履歴一覧も更新
        const sessions = await fetchSessions();
        setPastSessions(sessions);
      } catch (err) {
        console.error('タイトル更新エラー:', err);
      }
    }
  };

  // タイトル入力ダイアログ確定 → タイトルを設定してSupabase保存
  const handleTitleDialogConfirm = async (title: string) => {
    setShowTitleDialog(false);

    // ローカルstateにタイトルを反映
    setSceneSession(prev => prev ? { ...prev, videoTitle: title } : null);

    // Supabaseに保存
    if (sceneSession) {
      setIsSaving(true);
      try {
        const sessionToSave = { ...sceneSession, videoTitle: title };
        const dbId = await saveSessionToSupabase(sessionToSave);
        setSupabaseSessionId(dbId);
        const sessions = await fetchSessions();
        setPastSessions(sessions);
      } catch (saveErr) {
        console.error('Supabase保存エラー:', saveErr);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDownloadScene = (scene: typeof sceneSession extends null ? never : NonNullable<typeof sceneSession>['scenes'][number]) => {
    downloadSceneThumbnail(scene);
  };

  const handleDownloadZip = async () => {
    if (!sceneSession) return;
    const selected = sceneSession.scenes.filter(s => s.isSelected);
    if (selected.length === 0) {
      alert('ダウンロードするシーンを選択してください。');
      return;
    }
    await downloadScenesZip(selected);
  };

  const handleDownloadTsv = () => {
    if (!sceneSession) return;
    downloadScenesTsv(sceneSession.scenes, sceneSession.videoFileName.replace(/\.[^.]+$/, ''));
  };

  // === 台本生成ハンドラー ===

  const handleGenerate = async () => {
    if (genTheme.length < 100) {
      alert("テーマをもう少し詳しく入力してください（100文字以上）");
      return;
    }
    if (analyses.length === 0 && !selectedPattern && selectedSessionIds.length === 0) {
      alert("パターンを選択するか、分析データを追加してください。");
      return;
    }
    setIsGenerating(true);
    try {
      // 選択されたセッションのシーンデータを並列fetch
      let sceneReferences: SceneReferenceData[] = [];
      if (selectedSessionIds.length > 0) {
        const sessionsMap = new Map<string, SessionHistoryItem>(pastSessions.map(s => [s.id, s]));
        const scenesResults = await Promise.all(
          selectedSessionIds.map(id => fetchScenes(id))
        );
        sceneReferences = selectedSessionIds.map((id, idx) => {
          const session = sessionsMap.get(id);
          const scenes = scenesResults[idx]
            .filter(s => s.analysis?.description)
            .map(s => ({
              sceneNumber: s.sceneNumber,
              timestampFormatted: s.timestampFormatted,
              description: s.analysis!.description,
              tags: s.analysis!.tags,
            }));
          return {
            sessionId: id,
            videoFileName: session?.video_file_name || 'unknown',
            videoDuration: session?.video_duration || 0,
            scenes,
          };
        });
      }

      // 選択されたセッションの動画全体分析データを収集
      const overallAnalyses: { videoFileName: string; analysis: import('./types').VideoOverallAnalysis }[] = [];
      if (selectedSessionIds.length > 0) {
        const sessionsMap = new Map<string, SessionHistoryItem>(pastSessions.map(s => [s.id, s]));
        for (const id of selectedSessionIds) {
          const session = sessionsMap.get(id);
          if (session?.overall_analysis) {
            overallAnalyses.push({
              videoFileName: session.video_file_name,
              analysis: session.overall_analysis,
            });
          }
        }
      }

      const selectedAnalyses = analyses.filter(a => a.buzzRate >= BUZZ_THRESHOLD);
      const patternsToUse = selectedAnalyses.length > 0 ? selectedAnalyses : analyses;
      const script = await generateSmartScript(
        genTheme,
        genTone,
        patternsToUse,
        selectedPattern,
        userMetrics.editHistory,
        sceneReferences.length > 0 ? sceneReferences : undefined,
        overallAnalyses.length > 0 ? overallAnalyses : undefined
      );
      setGeneratedScript(script);
      setScriptReferenceIds([...selectedSessionIds]);
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
      {/* Header / Nav */}
      <header className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold italic text-sm">🎬</div>
          <h1 className="text-xl font-bold tracking-tighter text-white">Reel Scene <span className="text-pink-400">Analyzer</span></h1>
        </div>

        <nav className="flex bg-zinc-900/80 p-1 rounded-xl backdrop-blur-sm">
          <button
            onClick={() => setMode('ANALYSIS')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'ANALYSIS' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            分析モード
          </button>
          <button
            onClick={() => setMode('GENERATION')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'GENERATION' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            台本生成
          </button>
          <button
            onClick={() => setMode('LOGS')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'LOGS' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            成長ログ
          </button>
        </nav>

        <div className="w-8 h-8 bg-zinc-800/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors">
          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* === 分析モード (シーン分析UI) === */}
        {mode === 'ANALYSIS' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {!sceneSession ? (
              <div className="flex flex-col items-center">
                <SceneUploader
                  onFileSelected={handleSceneExtraction}
                  isExtracting={isExtracting}
                  extractionProgress={extractionProgress}
                />
                <SessionHistoryList
                  sessions={pastSessions}
                  onLoadSession={handleLoadSessionFromHistory}
                  onDeleteSession={handleDeleteSessionFromHistory}
                  isLoading={isLoadingHistory}
                />
              </div>
            ) : (
              <>
                {/* AI分析進捗 */}
                {(sceneSession.analysisStatus === 'analyzing' || sceneSession.overallAnalysisStatus === 'analyzing') && (
                  <AnalysisProgressCard
                    current={sceneSession.analysisProgress.current}
                    total={sceneSession.analysisProgress.total}
                    percentage={sceneSession.analysisProgress.percentage}
                    overallAnalysisStatus={sceneSession.overallAnalysisStatus}
                    overallAnalysisProgress={overallAnalysisProgress}
                  />
                )}

                {/* ヘッダー */}
                <SceneHeader
                  totalScenes={sceneSession.totalScenes}
                  videoFileName={sceneSession.videoFileName}
                  videoTitle={sceneSession.videoTitle}
                  hasVideo={!!sceneSession.videoObjectUrl}
                  onOpenVideoPreview={() => setShowVideoPreview(true)}
                  onStartAnalysis={handleStartSceneAnalysis}
                  onBack={handleClearScenes}
                  onTitleChange={handleVideoTitleChange}
                  isAnalyzing={sceneSession.analysisStatus === 'analyzing'}
                  analysisCompleted={sceneSession.analysisStatus === 'completed'}
                  isSaving={isSaving}
                />

                {/* ツールバー */}
                <SceneToolbar
                  totalScenes={sceneSession.totalScenes}
                  selectedCount={sceneSession.scenes.filter(s => s.isSelected).length}
                  viewMode={sceneViewMode}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onClear={handleClearScenes}
                  onDownloadZip={handleDownloadZip}
                  onDownloadTsv={handleDownloadTsv}
                  onSetViewMode={setSceneViewMode}
                />

                {/* 動画全体分析結果 */}
                {sceneSession.overallAnalysis && (
                  <OverallAnalysisCard analysis={sceneSession.overallAnalysis} />
                )}

                {/* シーングリッド */}
                <SceneGrid
                  scenes={sceneSession.scenes}
                  viewMode={sceneViewMode}
                  onSelectScene={handleToggleSceneSelection}
                  onDownloadScene={handleDownloadScene}
                />
              </>
            )}

            {/* 動画プレビューモーダル */}
            {showVideoPreview && sceneSession && (
              <VideoPreviewModal
                isOpen={showVideoPreview}
                onClose={() => setShowVideoPreview(false)}
                videoObjectUrl={sceneSession.videoObjectUrl}
                scenes={sceneSession.scenes}
              />
            )}

            {/* タイトル入力ダイアログ（アップロード直後に必須表示） */}
            {sceneSession && (
              <VideoTitleDialog
                isOpen={showTitleDialog}
                originalFileName={sceneSession.videoFileName}
                onConfirm={handleTitleDialogConfirm}
              />
            )}
          </div>
        )}

        {/* === 台本生成モード === */}
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
                  <SessionSelector
                    sessions={pastSessions}
                    selectedIds={selectedSessionIds}
                    onSelectionChange={setSelectedSessionIds}
                  />

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
                        disabled={isGenerating || (analyses.length === 0 && !selectedPattern && selectedSessionIds.length === 0)}
                        className="px-8 py-3 buzz-gradient rounded-xl font-bold shadow-lg hover:shadow-pink-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                      >
                        {isGenerating ? 'AI台本生成中...' : '最強の台本を生成'}
                      </button>
                    </div>
                  </div>
                  {analyses.length === 0 && !selectedPattern && selectedSessionIds.length === 0 && (
                    <p className="text-[10px] text-red-400 mt-2">※台本生成にはパターン選択、分析データ、または参考セッションの選択が必要です。</p>
                  )}
                </div>
              </div>

              {generatedScript && scriptReferenceIds.length > 0 && (
                <div className="glass p-4 rounded-2xl border-zinc-800">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2">参考にした動画</h4>
                  <div className="flex flex-wrap gap-2">
                    {scriptReferenceIds.map(id => {
                      const s = pastSessions.find(ps => ps.id === id);
                      if (!s) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5">
                          {s.first_thumbnail_url ? (
                            <img src={s.first_thumbnail_url} alt="" className="w-5 h-9 object-cover rounded" />
                          ) : (
                            <div className="w-5 h-9 rounded bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-600">🎬</div>
                          )}
                          <span className="text-xs text-zinc-300 truncate max-w-[160px]">{s.video_title || s.video_file_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

        {/* === 成長ログモード === */}
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

      <footer className="p-8 text-center text-zinc-500 text-[10px] uppercase tracking-widest">
        &copy; 2025 Reel Scene Analyzer. Privacy Protected. All data deleted after analysis.
      </footer>
    </div>
  );
};

export default App;
