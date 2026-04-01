
import React, { useState, useRef } from 'react';
import { KnowledgeItem } from '../types';

const CATEGORIES = [
  { value: 'general', label: '一般' },
  { value: 'structure', label: '構成ルール' },
  { value: 'copywriting', label: 'コピーライティング' },
  { value: 'brand', label: 'ブランドガイド' },
];

const categoryLabel = (value: string) => CATEGORIES.find(c => c.value === value)?.label || value;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
};

interface KnowledgeManagerProps {
  knowledgeItems: KnowledgeItem[];
  onAddText: (title: string, category: string, content: string) => Promise<void>;
  onAddFile: (title: string, category: string, file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isExtracting: boolean;
  extractionProgress: string;
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({
  knowledgeItems,
  onAddText,
  onAddFile,
  onDelete,
  isExtracting,
  extractionProgress,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setCategory('general');
    setContent('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitText = async () => {
    if (!title.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      await onAddText(title.trim(), category, content.trim());
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFile = async () => {
    if (!title.trim() || !selectedFile) return;
    await onAddFile(title.trim(), category, selectedFile);
    resetForm();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('ファイルサイズは20MB以下にしてください。');
      return;
    }
    setSelectedFile(file);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase mb-2 hover:text-zinc-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          ナレッジ管理
          {knowledgeItems.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {knowledgeItems.length}件
            </span>
          )}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="space-y-3">
          {/* 入力モード切替 */}
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${inputMode === 'text' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              テキスト入力
            </button>
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${inputMode === 'file' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              PDF / 画像
            </button>
          </div>

          {/* 共通: タイトル + カテゴリ */}
          <div className="flex gap-2">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ナレッジ名"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 transition-colors"
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-xs outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* テキスト入力モード */}
          {inputMode === 'text' && (
            <>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="ノウハウやガイドラインをここに入力..."
                className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs outline-none focus:border-purple-500 transition-colors resize-none"
              />
              <button
                onClick={handleSubmitText}
                disabled={!title.trim() || !content.trim() || isSaving}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </>
          )}

          {/* ファイルアップロードモード */}
          {inputMode === 'file' && (
            <>
              <div
                onClick={() => !isExtracting && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isExtracting ? 'border-zinc-700 bg-zinc-900/30 cursor-wait' : 'border-zinc-700 hover:border-purple-500/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isExtracting}
                />
                {isExtracting ? (
                  <div className="text-xs text-purple-300 animate-pulse">{extractionProgress || '処理中...'}</div>
                ) : selectedFile ? (
                  <div className="text-xs text-zinc-300">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)</div>
                ) : (
                  <div className="text-xs text-zinc-500">PDF / PNG / JPEG をクリックまたはドラッグ（20MB以下）</div>
                )}
              </div>
              <button
                onClick={handleSubmitFile}
                disabled={!title.trim() || !selectedFile || isExtracting}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isExtracting ? 'AI抽出中...' : 'アップロード & 抽出'}
              </button>
            </>
          )}

          {/* ナレッジ一覧 */}
          {knowledgeItems.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {knowledgeItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300 truncate">{item.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">{categoryLabel(item.category)}</span>
                      <span className="text-[9px] text-zinc-600">{item.source_type === 'text' ? 'テキスト' : item.source_type.toUpperCase()}</span>
                      <span className="text-[9px] text-zinc-600">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`「${item.title}」を削除しますか？`)) {
                        onDelete(item.id);
                      }
                    }}
                    className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
