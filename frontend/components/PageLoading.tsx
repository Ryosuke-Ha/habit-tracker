export function PageLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        <p className="text-gray-500 text-xs">Loading...</p>
      </div>
    </div>
  );
}
