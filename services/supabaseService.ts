
import { supabase } from './supabaseClient';
import { SceneData, SceneExtractionSession, SceneAnalysis } from '../types';

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

// 過去のセッション一覧を取得
export const fetchSessions = async (): Promise<{
  id: string;
  video_file_name: string;
  video_file_size: number;
  video_duration: number;
  total_scenes: number;
  analysis_status: string;
  created_at: string;
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

  return data || [];
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
