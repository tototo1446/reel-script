import React, { useState, useRef, useEffect } from 'react';

interface VideoTitleDialogProps {
  isOpen: boolean;
  originalFileName: string;
  onConfirm: (title: string) => void;
}

export const VideoTitleDialog: React.FC<VideoTitleDialogProps> = ({
  isOpen,
  originalFileName,
  onConfirm,
}) => {
  const [accountName, setAccountName] = useState('');
  const [description, setDescription] = useState('');
  const accountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && accountInputRef.current) {
      accountInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = accountName.trim().length > 0 && description.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const title = `@${accountName.trim()} | ${description.trim()}`;
    onConfirm(title);
    setAccountName('');
    setDescription('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canConfirm) {
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-sm">🎬</span>
            動画の情報を入力
          </h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            誰のどんなリールか記録しておくと、後から探しやすくなります
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="px-6 pb-2 space-y-4">
          {/* 元ファイル名（参考表示） */}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg">
            <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-zinc-500 truncate">{originalFileName}</span>
          </div>

          {/* アカウント名 */}
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1.5">
              アカウント名 <span className="text-pink-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
              <input
                ref={accountInputRef}
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="tiktok_user123"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white outline-none focus:border-pink-500 transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* リール内容 */}
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1.5">
              リールの内容 <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例: 美容液紹介リール、ダイエットビフォーアフター"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-pink-500 transition-colors placeholder:text-zinc-600"
            />
          </div>

          {/* プレビュー */}
          {(accountName.trim() || description.trim()) && (
            <div className="px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="text-[10px] text-zinc-500 mb-1">タイトルプレビュー</div>
              <div className="text-sm text-white font-medium">
                @{accountName.trim() || '...'} | {description.trim() || '...'}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 mt-2">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-pink-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
          >
            この内容で保存
          </button>
        </div>
      </div>
    </div>
  );
};
