
import { supabase } from './supabaseClient';
import { SceneData, SceneExtractionSession, SceneAnalysis, VideoOverallAnalysis, GeneratedScript, ScriptHistoryItem, KnowledgeItem } from '../types';

// base64 data URL → Blob に変換
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

// サムネイル画像をSupabase Storageにアップロード
const uploadThumbnail = async (
  sessionId: string,
  sceneNumber: number,
  dataUrl: string
): Promise<string | null> => {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${sessionId}/scene_${sceneNumber}.jpg`;

  const { error } = await supabase.storage
    .from('scene-thumbnails')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error(`サムネイルアップロードエラー (scene ${sceneNumber}):`, error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('scene-thumbnails')
    .getPublicUrl(path);

  return urlData.publicUrl;
};

// 分析セッションをSupabaseに保存
export const saveSessionToSupabase = async (
  session: SceneExtractionSession,
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  // 1. analysis_sessions テーブルにセッション挿入
  const { data: sessionData, error: sessionError } = await supabase
    .from('analysis_sessions')
    .insert({
      video_file_name: session.videoFileName,
      video_title: session.videoTitle,
      video_file_size: session.videoFileSize,
      video_duration: session.videoDuration,
      total_scenes: session.totalScenes,
      analysis_status: session.analysisStatus,
    })
    .select('id')
    .single();

  if (sessionError || !sessionData) {
    throw new Error(`セッション保存エラー: ${sessionError?.message}`);
  }

  const dbSessionId = sessionData.id;

  // 2. 各シーンのサムネイルをStorageにアップロード + scenes テーブルに挿入
  for (let i = 0; i < session.scenes.length; i++) {
    const scene = session.scenes[i];
    onProgress?.(i + 1, session.scenes.length);

    // サムネイルアップロード
    const thumbnailUrl = await uploadThumbnail(
      dbSessionId,
      scene.sceneNumber,
      scene.thumbnailDataUrl
    );

    // scenes テーブルに挿入
    const { error: sceneError } = await supabase
      .from('scenes')
      .insert({
        session_id: dbSessionId,
        scene_number: scene.sceneNumber,
        timestamp_sec: scene.timestamp,
        timestamp_formatted: scene.timestampFormatted,
        thumbnail_url: thumbnailUrl,
        analysis_status: scene.analysisStatus,
        description: scene.analysis?.description || null,
        tags: scene.analysis?.tags || [],
      });

    if (sceneError) {
      console.error(`シーン${scene.sceneNumber}の保存エラー:`, sceneError);
    }
  }

  return dbSessionId;
};

// 単一シーンのAI分析結果をSupabaseに更新
export const updateSceneAnalysis = async (
  sessionId: string,
  sceneNumber: number,
  analysis: SceneAnalysis
): Promise<void> => {
  const { error } = await supabase
    .from('scenes')
    .update({
      description: analysis.description,
      tags: analysis.tags,
      analysis_status: 'completed',
    })
    .eq('session_id', sessionId)
    .eq('scene_number', sceneNumber);

  if (error) {
    console.error(`シーン分析更新エラー (scene ${sceneNumber}):`, error);
  }
};

// セッションの分析ステータスを更新
export const updateSessionAnalysisStatus = async (
  sessionId: string,
  status: string
): Promise<void> => {
  const { error } = await supabase
    .from('analysis_sessions')
    .update({ analysis_status: status })
    .eq('id', sessionId);

  if (error) {
    console.error('セッションステータス更新エラー:', error);
  }
};

// 動画全体分析結果を保存
export const updateOverallAnalysis = async (
  sessionId: string,
  overallAnalysis: VideoOverallAnalysis
): Promise<void> => {
  const { error } = await supabase
    .from('analysis_sessions')
    .update({ overall_analysis: overallAnalysis })
    .eq('id', sessionId);

  if (error) {
    console.error('動画全体分析の保存エラー:', error);
  }
};

// 動画タイトルを更新
export const updateVideoTitle = async (
  sessionId: string,
  title: string
): Promise<void> => {
  const { error } = await supabase
    .from('analysis_sessions')
    .update({ video_title: title })
    .eq('id', sessionId);

  if (error) {
    console.error('動画タイトル更新エラー:', error);
    throw error;
  }
};

// 過去のセッション一覧を取得（各セッションの代表サムネイル付き）
export const fetchSessions = async (): Promise<{
  id: string;
  video_file_name: string;
  video_title: string | null;
  video_file_size: number;
  video_duration: number;
  total_scenes: number;
  analysis_status: string;
  overall_analysis: VideoOverallAnalysis | null;
  created_at: string;
  first_thumbnail_url: string | null;
}[]> => {
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('セッション一覧取得エラー:', error);
    return [];
  }

  const sessions = data || [];
  if (sessions.length === 0) return [];

  // 各セッションの最初のシーンのサムネイルを一括取得
  const sessionIds = sessions.map(s => s.id);
  const { data: thumbnails } = await supabase
    .from('scenes')
    .select('session_id, thumbnail_url')
    .in('session_id', sessionIds)
    .eq('scene_number', 1);

  const thumbnailMap = new Map<string, string>(
    (thumbnails || [])
      .filter(t => t.thumbnail_url)
      .map(t => [t.session_id, t.thumbnail_url])
  );

  return sessions.map(s => ({
    ...s,
    first_thumbnail_url: thumbnailMap.get(s.id) || null,
  }));
};

// セッション内のシーン一覧を取得
export const fetchScenes = async (sessionId: string): Promise<SceneData[]> => {
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('session_id', sessionId)
    .order('scene_number', { ascending: true });

  if (error) {
    console.error('シーン取得エラー:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    sceneNumber: row.scene_number,
    timestamp: row.timestamp_sec,
    timestampFormatted: row.timestamp_formatted,
    thumbnailDataUrl: row.thumbnail_url || '',
    isSelected: false,
    analysis: row.description ? {
      description: row.description,
      tags: row.tags || [],
    } : null,
    analysisStatus: row.analysis_status as SceneData['analysisStatus'],
  }));
};

// セッションを削除
export const deleteSession = async (sessionId: string): Promise<void> => {
  // Storage のサムネイルを削除
  const { data: files } = await supabase.storage
    .from('scene-thumbnails')
    .list(sessionId);

  if (files && files.length > 0) {
    const paths = files.map(f => `${sessionId}/${f.name}`);
    await supabase.storage.from('scene-thumbnails').remove(paths);
  }

  // DB から削除（cascade で scenes も消える）
  const { error } = await supabase
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('セッション削除エラー:', error);
  }
};

// ========== 台本関連 ==========

// 台本をSupabaseに保存（新規INSERT + 参照セッション紐付け）
export const saveScriptToSupabase = async (
  script: GeneratedScript,
  referenceSessionIds: string[]
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('generated_scripts')
      .insert({
        theme: script.theme,
        tone: script.tone,
        pattern_id: script.patternId,
        scenes: script.scenes,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('台本保存エラー:', error?.message);
      return null;
    }

    const dbScriptId = data.id;

    if (referenceSessionIds.length > 0) {
      const refs = referenceSessionIds.map(sessionId => ({
        script_id: dbScriptId,
        session_id: sessionId,
      }));
      const { error: refError } = await supabase
        .from('script_references')
        .insert(refs);

      if (refError) {
        console.error('台本参照保存エラー:', refError);
      }
    }

    return dbScriptId;
  } catch (err) {
    console.error('台本保存エラー（テーブル未作成の可能性）:', err);
    return null;
  }
};

// 台本を更新（チャット修正後）
export const updateScriptInSupabase = async (
  scriptId: string,
  script: GeneratedScript
): Promise<void> => {
  const { error } = await supabase
    .from('generated_scripts')
    .update({
      scenes: script.scenes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scriptId);

  if (error) {
    console.error('台本更新エラー:', error);
  }
};

// 過去の台本一覧を取得
export const fetchScripts = async (): Promise<ScriptHistoryItem[]> => {
  try {
    const { data, error } = await supabase
      .from('generated_scripts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('台本一覧取得エラー:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('台本一覧取得エラー（テーブル未作成の可能性）:', err);
    return [];
  }
};

// 台本の参照セッションIDを取得
export const fetchScriptReferences = async (
  scriptId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('script_references')
    .select('session_id')
    .eq('script_id', scriptId);

  if (error) {
    console.error('台本参照取得エラー:', error);
    return [];
  }

  return (data || []).map(r => r.session_id);
};

// 台本を削除
export const deleteScriptFromSupabase = async (scriptId: string): Promise<void> => {
  const { error } = await supabase
    .from('generated_scripts')
    .delete()
    .eq('id', scriptId);

  if (error) {
    console.error('台本削除エラー:', error);
  }
};

// ========== ナレッジ関連 ==========

// ナレッジ一覧取得
export const fetchKnowledgeItems = async (): Promise<KnowledgeItem[]> => {
  try {
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ナレッジ一覧取得エラー:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('ナレッジ一覧取得エラー:', err);
    return [];
  }
};

// ナレッジ保存
export const saveKnowledgeItem = async (
  item: Omit<KnowledgeItem, 'id' | 'created_at'>
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('knowledge_items')
      .insert({
        title: item.title,
        category: item.category,
        content: item.content,
        source_type: item.source_type,
        source_file_name: item.source_file_name,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('ナレッジ保存エラー:', error?.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error('ナレッジ保存エラー:', err);
    return null;
  }
};

// ナレッジ削除
export const deleteKnowledgeItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('ナレッジ削除エラー:', error);
  }
};
