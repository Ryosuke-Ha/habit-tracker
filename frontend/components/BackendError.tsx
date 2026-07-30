interface BackendErrorProps {
  onRetry: () => void
  message?: string
}

export function BackendError({
  onRetry,
  message = "サーバーに接続できません。",
}: BackendErrorProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full border border-red-200 bg-red-50 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-red-600 text-sm font-bold mb-2">
          接続エラー
        </h1>
        <p className="text-gray-600 text-xs mb-6 leading-relaxed">
          {message}
        </p>
        <button
          onClick={onRetry}
          className="w-full border border-red-300 text-red-600 py-3 text-xs
                     hover:bg-red-100 transition-colors"
        >
          再接続する
        </button>
        <a
          href="https://status.railway.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3 text-gray-500 text-xs hover:text-gray-700
                     transition-colors underline"
        >
          サービスステータスを確認
        </a>
      </div>
    </div>
  )
}
