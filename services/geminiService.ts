
import { GoogleGenAI, Type, createPartFromUri, FileState, Chat } from "@google/genai";
import { AnalysisData, GeneratedScript, CrossAnalysisResult, SceneData, SceneAnalysis } from "../types";
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

// 台本生成（パターン選択・フィードバック履歴対応）
export const generateSmartScript = async (
  theme: string,
  tone: string,
  patterns: AnalysisData[],
  selectedPatternId?: string | null,
  editHistory?: { instruction: string }[]
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `あなたはSNS動画マーケティングのプロです。
    以下の「勝ちパターン」を参考に、新しいテーマ「${theme}」で、トーン「${tone}」のリール台本を生成してください。

    【参考にすべき勝ちパターン】
    ${patternContext}
    ${selectedPatternNote}
    ${feedbackContext}

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

/** 場面切り替え検出時の最小間隔（秒）。これより短い間隔のタイムスタンプはマージする */
const MIN_SCENE_INTERVAL_SEC = 1.5;

/** 動画の長さ（秒）を取得 */
const getVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.src = url;
    v.onloadedmetadata = () => {
      resolve(v.duration);
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('動画の読み込みに失敗'));
    };
  });

// 動画から場面切り替えのタイムスタンプ（秒）をLLMで検出
export const detectSceneChangeTimestamps = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<number[]> => {
  const { uri, mimeType } = await uploadAndWaitForFile(file, onProgress);

  onProgress?.('AIが場面の切り替わりを検出中...');

  const videoPart = createPartFromUri(uri, mimeType);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      videoPart,
      `この動画を視聴し、場面が切り替わったタイミング（秒数）を漏れなく検出してください。1つでも見落としがあれば不十分です。

【検出の基本】
- 動画を頭から順に確認し、以下の変化が起きたタイミングをすべて列挙する
- 検出しすぎるくらいでよい。疑わしい場合も含める
- 0秒（動画の開始）は必ず含める

【分割するケース】※これらは必ず検出する
- カット割り（別の映像に切り替わる）
- カメラアングル・構図の変更（アップ↔引き、横顔↔正面、クローズアップ、製品のアップなど）
- 場所・背景の変化（例：部屋→洗面所）
- 人物の出入り、別の人物への切り替え
- テロップ・キャプションの内容の切り替え（テキストが変わるたびに検出。「ねぇ」「みたいなの ある？」「コレだけ使ってりゃいい！」など、各テロップの出現を漏れなく検出）
- 製品・アイテムの切り替え（手に持つものが変わる、紹介する商品が変わる）

【分割しないケース】
- 同じ人物・同じ場所・同じ構図・同じテロップが連続している = 1シーン
- 表情の変化、手の動きだけ（テロップ・製品に変化がない場合）= 分割しない

【目安】
- 60秒の動画なら通常10〜25シーン程度。それより少ない場合は見落としがないか再確認する

【その他】
- 各シーンの代表フレームとして、切り替わり直後の秒数を返す（小数可: 5.2, 12.8）
- 最大60シーンまで

以下のJSON形式で出力してください:
{ "timestamps": [0, 5.2, 12.3, ...] }`
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timestamps: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
        required: ['timestamps'],
      },
    },
  });

  const result = JSON.parse(response.text!) as { timestamps: number[] };
  let timestamps = result.timestamps ?? [];

  // 0秒が含まれていなければ追加し、ソート・重複除去
  let sorted = [...new Set([0, ...timestamps])].sort((a, b) => a - b);

  // 最小間隔を強制：同じカットが続く場合の細かい分割を除去
  const filtered: number[] = [];
  for (const t of sorted) {
    if (filtered.length === 0 || t - filtered[filtered.length - 1] >= MIN_SCENE_INTERVAL_SEC) {
      filtered.push(t);
    }
  }

  // フォールバック: LLMの検出が粗い場合（1シーンあたり15秒以上）、定期サンプルを補完
  try {
    const duration = await getVideoDuration(file);
    const scenesPerMinute = duration > 0 ? filtered.length / (duration / 60) : 0;
    if (duration > 30 && scenesPerMinute < 5) {
      const supplementInterval = 6;
      const supplemented: number[] = [...filtered];
      for (let t = supplementInterval; t < duration - 1; t += supplementInterval) {
        const nearExisting = supplemented.some((existing) => Math.abs(existing - t) < 4);
        if (!nearExisting) supplemented.push(t);
      }
      supplemented.sort((a, b) => a - b);
      const merged: number[] = [];
      for (const t of supplemented) {
        if (merged.length === 0 || t - merged[merged.length - 1] >= MIN_SCENE_INTERVAL_SEC) {
          merged.push(t);
        }
      }
      return merged;
    }
  } catch {
    // 動画長取得失敗時は補完しない
  }
  return filtered;
};

// シーンフレームの個別AI分析
export const analyzeSceneFrames = async (
  scenes: SceneData[],
  onSceneAnalyzed: (sceneId: string, analysis: SceneAnalysis) => void,
  onProgress: (current: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress(i + 1, scenes.length);

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

      const analysis: SceneAnalysis = JSON.parse(response.text!);
      onSceneAnalyzed(scene.id, analysis);
    } catch (err) {
      console.error(`シーン${scene.sceneNumber}の分析に失敗:`, err);
      onSceneAnalyzed(scene.id, {
        description: '分析に失敗しました',
        tags: [],
      });
    }

    // Rate limit対策: 少し間隔を空ける
    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
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
