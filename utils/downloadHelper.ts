
import { SceneData } from '../types';

export const downloadSceneThumbnail = (scene: SceneData): void => {
  const link = document.createElement('a');
  link.href = scene.thumbnailDataUrl;
  link.download = `scene_${scene.sceneNumber}_${scene.timestampFormatted.replace(':', '-')}.jpg`;
  link.click();
};

export const downloadScenesTsv = (scenes: SceneData[], fileName: string): void => {
  const header = 'シーン番号\tタイムスタンプ\t説明\tタグ';
  const rows = scenes.map(s => {
    const desc = s.analysis?.description || '';
    const tags = s.analysis?.tags?.join(', ') || '';
    return `${s.sceneNumber}\t${s.timestampFormatted}\t${desc}\t${tags}`;
  });
  const tsv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_scenes.tsv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadScenesZip = async (scenes: SceneData[]): Promise<void> => {
  // Download selected scenes as individual files with a slight delay between each
  for (const scene of scenes) {
    downloadSceneThumbnail(scene);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
};
