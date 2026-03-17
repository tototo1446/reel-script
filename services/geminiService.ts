
import { GoogleGenAI, Type, createPartFromUri, FileState, Chat } from "@google/genai";
import { AnalysisData, GeneratedScript, CrossAnalysisResult, SceneData, SceneAnalysis, SceneReferenceData, VideoOverallAnalysis } from "../types";
import { DEFAULT_PATTERNS } from "../constants";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// ヘルパー: ファイルアップロード + 処理完了待ち
const uploadAndWaitForFile = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<{ uri: string; mimeType: string }> => {
  onProgress?.('ファイルをアップロード中...');

  const uploadedFile = await ai.files.upload({
    file: file,
    config: {
      mimeType: file.type,
      displayName: file.name,
    },
  });

  let currentFile = uploadedFile;
  const maxRetries = 60; // 最大2分 (2秒 x 60回)
  let retries = 0;
  while (currentFile.state === FileState.PROCESSING) {
    if (retries >= maxRetries) {
      throw new Error('ファイル処理がタイムアウトしました（2分超過）。ファイルサイズを小さくして再試行してください。');
    }
    onProgress?.(`動画を処理中... (${retries * 2}秒経過)`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    currentFile = await ai.files.get({ name: currentFile.name! });
    retries++;
  }

  if (currentFile.state !== FileState.ACTIVE) {
    const errorMsg = currentFile.error
      ? JSON.stringify(currentFile.error)
      : '不明なエラー';
    throw new Error(`ファイル処理に失敗しました: ${errorMsg}`);
  }

  return {
    uri: currentFile.uri!,
    mimeType: currentFile.mimeType!,
  };
};

// 動画ファイルを直接Geminiに送信して3層分析
export const analyzeCompetitorReel = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<Partial<AnalysisData>> => {
  const { uri, mimeType } = await uploadAndWaitForFile(file, onProgress);

  onProgress?.('AIが動画を3層構造に解剖中...');

  const videoPart = createPartFromUri(uri, mimeType);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      videoPart,
      `この動画を詳細に分析してください。

【分析要件】
1. 音声の完全な文字起こし
2. 動画の推定時間（秒数）
3. 以下の4層構成に分解:
   - フック(Hook): 最初の3秒で視聴者を引き込む要素
   - 問題提起(Problem): 視聴者が共感する課題
   - 解決策(Solution): 提供する解決策や価値
   - CTA: 行動喚起（いいね、保存、フォローなど）
4. 演出意図の分析:
   - カメラワーク（距離、角度、動き）
   - 人物配置（顔出し/なし、立ち位置、衣装）
   - テロップ/テキスト（色、フォント、位置、タイミング）
5. 動画の適切なタイトル（日本語）

JSON形式で出力してください。`
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          duration: { type: Type.NUMBER },
          structure: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              problem: { type: Type.STRING },
              solution: { type: Type.STRING },
              cta: { type: Type.STRING }
            },
            required: ['hook', 'problem', 'solution', 'cta']
          },
          direction: {
            type: Type.OBJECT,
            properties: {
              camera: { type: Type.STRING },
              person: { type: Type.STRING },
              caption: { type: Type.STRING }
            },
            required: ['camera', 'person', 'caption']
          },
          transcription: { type: Type.STRING }
        },
        required: ['title', 'duration', 'structure', 'direction', 'transcription']
      }
    }
  });

  return JSON.parse(response.text!);
};

// 動画全体分析（音声込み）: 動画をGeminiにアップロードし、音声・映像を総合的に分析
export const analyzeVideoOverall = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<VideoOverallAnalysis> => {
  const { uri, mimeType } = await uploadAndWaitForFile(file, onProgress);

  onProgress?.('AIが動画全体を音声込みで分析中...');

  const videoPart = createPartFromUri(uri, mimeType);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      videoPart,
      `この動画を音声・映像の両面から詳細に分析してください。

【分析要件】
1. transcription: 音声の完全な文字起こし（話者が複数いる場合は話者を区別。ナレーション、会話、すべて含む）
2. bgm: BGM・音楽の説明（ジャンル、テンポ、雰囲気、使用タイミング）
3. soundEffects: 効果音・環境音の説明（どんな効果音がどのタイミングで使われているか）
4. narrationStyle: ナレーション・話し方のスタイル分析（話速、声のトーン、間の取り方、感情の込め方）
5. overallStructure: 動画全体の構成・流れの説明（起承転結やフック→本題→CTAなどの構成）
6. hookAnalysis: 冒頭フック（最初の3秒）の詳細分析（何を言っているか、どんな映像か、なぜ引き込まれるか）
7. pacing: テンポ・ペース感の分析（カット切り替え頻度、情報密度、緩急の付け方）
8. emotionalTone: 全体の感情トーン（明るい/真剣/ユーモラス/緊張感など）

JSON形式で出力してください。`
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcription: { type: Type.STRING },
          bgm: { type: Type.STRING },
          soundEffects: { type: Type.STRING },
          narrationStyle: { type: Type.STRING },
          overallStructure: { type: Type.STRING },
          hookAnalysis: { type: Type.STRING },
          pacing: { type: Type.STRING },
          emotionalTone: { type: Type.STRING },
        },
        required: ['transcription', 'bgm', 'soundEffects', 'narrationStyle', 'overallStructure', 'hookAnalysis', 'pacing', 'emotionalTone']
      }
    }
  });

  return JSON.parse(response.text!);
};

// シーン参照データをトリミング（1セッションあたり最大30シーン: 冒頭10 + 中盤10 + 終盤10）
const trimScenes = (scenes: SceneReferenceData['scenes']): SceneReferenceData['scenes'] => {
  if (scenes.length <= 30) return scenes;
  const head = scenes.slice(0, 10);
  const midStart = Math.floor((scenes.length - 10) / 2);
  const mid = scenes.slice(midStart, midStart + 10);
  const tail = scenes.slice(-10);
  return [...head, ...mid, ...tail];
};

// シーン参照データからプロンプトコンテキストを生成
const buildSceneReferenceContext = (refs: SceneReferenceData[]): string => {
  if (refs.length === 0) return '';

  const blocks = refs.map((ref, i) => {
    const trimmed = trimScenes(ref.scenes);
    const lines = trimmed.map(s => {
      const tags = s.tags.length > 0 ? ' ' + s.tags.join(' ') : '';
      return `  [${s.timestampFormatted}] ${s.description}${tags}`;
    });
    return `--- 参考動画${i + 1}: ${ref.videoFileName} (${Math.round(ref.videoDuration)}秒, ${ref.scenes.length}シーン) ---\n${lines.join('\n')}`;
  });

  return `\n\n【参考動画のシーン構成フロー】\n${blocks.join('\n\n')}\n\n上記の参考動画のシーン展開のペース感、切り替えタイミング、視覚的な演出パターンを踏まえて台本を作成してください。`;
};

// 動画全体分析データからプロンプトコンテキストを生成
const buildOverallAnalysisContext = (overallAnalyses: { videoFileName: string; analysis: VideoOverallAnalysis }[]): string => {
  if (overallAnalyses.length === 0) return '';

  const blocks = overallAnalyses.map((item, i) => {
    const a = item.analysis;
    return `--- 参考動画${i + 1}: ${item.videoFileName} 音声・全体分析 ---
【文字起こし】
${a.transcription}

【BGM・音楽】${a.bgm}
【効果音・環境音】${a.soundEffects}
【ナレーションスタイル】${a.narrationStyle}
【全体構成】${a.overallStructure}
【冒頭フック分析】${a.hookAnalysis}
【テンポ・ペース感】${a.pacing}
【感情トーン】${a.emotionalTone}`;
  });

  return `\n\n【参考動画の音声・全体分析データ】\n${blocks.join('\n\n')}\n\n上記の音声データ（文字起こし、話し方、BGM、効果音）とペース感・構成を踏まえて、セリフの口調・テンポ・演出を台本に反映してください。`;
};

// 台本生成（パターン選択・フィードバック履歴対応）
export const generateSmartScript = async (
  theme: string,
  tone: string,
  patterns: AnalysisData[],
  selectedPatternId?: string | null,
  editHistory?: { instruction: string }[],
  sceneReferences?: SceneReferenceData[],
  overallAnalyses?: { videoFileName: string; analysis: VideoOverallAnalysis }[]
): Promise<GeneratedScript> => {
  const patternContext = patterns
    .map(p => `[Pattern: ${p.title}] Hook: ${p.structure.hook}, Problem: ${p.structure.problem}, Solution: ${p.structure.solution}, CTA: ${p.structure.cta}, Camera: ${p.direction.camera}, Person: ${p.direction.person}, Caption: ${p.direction.caption}`)
    .join('\n');

  const selectedPatternNote = selectedPatternId
    ? `\n\n【選択されたパターン】${DEFAULT_PATTERNS.find(p => p.id === selectedPatternId)?.name || selectedPatternId} を基本構成として使用してください。`
    : '';

  const feedbackContext = editHistory && editHistory.length > 0
    ? `\n\n【ユーザーの好み（過去の修正履歴）】\n${editHistory.slice(-10).map(e => `- ${e.instruction}`).join('\n')}\n上記の傾向を反映して、ユーザー好みの台本を生成してください。`
    : '';

  const sceneRefContext = sceneReferences ? buildSceneReferenceContext(sceneReferences) : '';
  const overallContext = overallAnalyses ? buildOverallAnalysisContext(overallAnalyses) : '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `あなたはSNS動画マーケティングのプロです。
    以下の「勝ちパターン」を参考に、新しいテーマ「${theme}」で、トーン「${tone}」のリール台本を生成してください。

    【参考にすべき勝ちパターン】
    ${patternContext}
    ${selectedPatternNote}
    ${feedbackContext}
    ${sceneRefContext}
    ${overallContext}

    【出力ルール】
    - 構成・流れ・テンポは参考パターンを維持する
    - 秒数付きのシーンに分ける
    - 各シーンには「セリフ」「テロップ」「具体的演出（例：0-3秒: 120%ズーム）」を含める`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          tone: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                caption: { type: Type.STRING },
                direction: { type: Type.STRING }
              },
              required: ['time', 'dialogue', 'caption', 'direction']
            }
          }
        },
        required: ['theme', 'tone', 'scenes']
      }
    }
  });

  const result = JSON.parse(response.text!);
  return {
    ...result,
    id: Math.random().toString(36).substr(2, 9),
    patternId: selectedPatternId || patterns[0]?.id || 'custom'
  };
};

// クロス分析: 複数動画の共通パターン抽出
export const crossAnalyzePatterns = async (
  analyses: AnalysisData[]
): Promise<CrossAnalysisResult> => {
  const analysisContext = analyses.map((a, i) =>
    `【動画${i + 1}: ${a.title}】
    構成: Hook="${a.structure.hook}" / Problem="${a.structure.problem}" / Solution="${a.structure.solution}" / CTA="${a.structure.cta}"
    演出: カメラ="${a.direction.camera}" / 人物="${a.direction.person}" / テロップ="${a.direction.caption}"
    秒数: ${a.duration}秒
    バズ率: x${a.buzzRate.toFixed(1)}`
  ).join('\n\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下の${analyses.length}本の動画分析結果を横断的に比較し、共通する「勝ちパターン」を抽出してください。

${analysisContext}

特に以下の観点で分析:
1. 共通するフック手法のパターン（具体的に列挙）
2. 共通する構成の流れ
3. 共通する演出手法
4. これらに基づく今後の動画制作への具体的な推奨事項`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          commonHookPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
          commonStructure: { type: Type.STRING },
          commonDirection: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['commonHookPatterns', 'commonStructure', 'commonDirection', 'recommendations']
      }
    }
  });

  const result = JSON.parse(response.text!);
  return {
    ...result,
    analyzedCount: analyses.length,
    createdAt: new Date().toISOString(),
  };
};

// チャットリライト用セッション管理
let scriptChat: Chat | null = null;

export const initScriptChat = (script: GeneratedScript): void => {
  const scriptJsonSchema = {
    type: Type.OBJECT,
    properties: {
      theme: { type: Type.STRING },
      tone: { type: Type.STRING },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING },
            dialogue: { type: Type.STRING },
            caption: { type: Type.STRING },
            direction: { type: Type.STRING }
          },
          required: ['time', 'dialogue', 'caption', 'direction'] as string[]
        }
      }
    },
    required: ['theme', 'tone', 'scenes'] as string[]
  };

  scriptChat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: "application/json",
      responseSchema: scriptJsonSchema,
    },
    history: [
      {
        role: 'user',
        parts: [{ text: `あなたはSNS動画台本の編集アシスタントです。以下が現在の台本です。この後のメッセージで修正指示を出すので、修正後の台本全体をJSON形式で返してください。\n\n${JSON.stringify(script)}` }]
      },
      {
        role: 'model',
        parts: [{ text: JSON.stringify({ theme: script.theme, tone: script.tone, scenes: script.scenes }) }]
      }
    ]
  });
};

// 単一シーンのAI分析（内部ヘルパー）
const analyzeSingleScene = async (
  scene: SceneData
): Promise<{ sceneId: string; analysis: SceneAnalysis }> => {
  try {
    const base64Data = scene.thumbnailDataUrl.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        `この動画フレーム画像を分析してください。
シーン番号: ${scene.sceneNumber}
タイムスタンプ: ${scene.timestampFormatted}

以下を出力:
1. description: シーンの内容を2-3文で簡潔に説明（日本語）
2. tags: 関連ハッシュタグを3-5個（#付き、日本語）`
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['description', 'tags']
        }
      }
    });

    return { sceneId: scene.id, analysis: JSON.parse(response.text!) };
  } catch (err) {
    console.error(`シーン${scene.sceneNumber}の分析に失敗:`, err);
    return { sceneId: scene.id, analysis: { description: '分析に失敗しました', tags: [] } };
  }
};

// シーンフレームの並列AI分析（Gemini 2.5 Flash、4並列バッチ処理）
const SCENE_ANALYSIS_CONCURRENCY = 4;

export const analyzeSceneFrames = async (
  scenes: SceneData[],
  onSceneAnalyzed: (sceneId: string, analysis: SceneAnalysis) => void,
  onProgress: (current: number, total: number) => void
): Promise<void> => {
  let completedCount = 0;

  for (let i = 0; i < scenes.length; i += SCENE_ANALYSIS_CONCURRENCY) {
    const batch = scenes.slice(i, i + SCENE_ANALYSIS_CONCURRENCY);

    // バッチ開始を通知
    onProgress(i + 1, scenes.length);

    // バッチ内を並列実行
    const results = await Promise.all(batch.map(scene => analyzeSingleScene(scene)));

    // 結果を通知
    for (const { sceneId, analysis } of results) {
      onSceneAnalyzed(sceneId, analysis);
      completedCount++;
      onProgress(completedCount, scenes.length);
    }

    // バッチ間のRate limit対策（最終バッチ以外）
    if (i + SCENE_ANALYSIS_CONCURRENCY < scenes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

export const rewriteScript = async (instruction: string): Promise<GeneratedScript> => {
  if (!scriptChat) throw new Error('チャットセッションが初期化されていません');

  const response = await scriptChat.sendMessage({
    message: `以下の指示に従って台本を修正してください。修正後の台本全体をJSON形式で出力してください。\n\n修正指示: ${instruction}`
  });

  const result = JSON.parse(response.text!);
  return {
    ...result,
    id: Math.random().toString(36).substr(2, 9),
    patternId: result.patternId || 'rewritten'
  };
};
