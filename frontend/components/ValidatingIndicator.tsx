export function ValidatingIndicator({ isValidating }: { isValidating: boolean }) {
  if (!isValidating) return null
  return (
    <div className="fixed top-2 right-2 z-50">
      <div className="flex items-center gap-1 bg-gray-900 border border-gray-700
                      px-2 py-1 rounded text-xs text-gray-400">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        更新中
      </div>
    </div>
  )
}
