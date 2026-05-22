interface BackendErrorProps {
  nextRetryIn: number
  onRetry: () => void
}

export function BackendError({ nextRetryIn, onRetry }: BackendErrorProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-sm w-full border border-red-800 bg-red-950/20 p-8 text-center">

        <div className="text-6xl mb-6">⚠️</div>

        <h1 className="text-red-400 text-lg font-bold mb-2 tracking-wider">
          SERVER ERROR
        </h1>

        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          サーバーに接続できません。<br />
          しばらくお待ちください。
        </p>

        {nextRetryIn > 0 ? (
          <p className="text-gray-500 text-xs mb-6">
            🔄 {nextRetryIn}秒後に再接続します...
          </p>
        ) : (
          <p className="text-yellow-500 text-xs mb-6 animate-pulse">
            🔄 再接続中...
          </p>
        )}

        <button
          onClick={onRetry}
          className="w-full border border-red-700 text-red-400 py-3 text-sm hover:bg-red-900/30 transition-colors tracking-wider"
        >
          今すぐ再接続
        </button>

        <a
          href="https://status.railway.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-4 text-gray-600 text-xs hover:text-gray-400 transition-colors underline"
        >
          サービスステータスを確認
        </a>
      </div>
    </div>
  )
}
