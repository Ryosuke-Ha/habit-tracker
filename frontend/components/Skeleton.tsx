function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-gray-800 animate-pulse rounded ${className}`} />
  )
}

function SkeletonTodoItem() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800">
      <SkeletonBlock className="w-5 h-5 rounded-sm flex-shrink-0" />
      <SkeletonBlock className="h-4 flex-1" />
      <SkeletonBlock className="w-12 h-3" />
    </div>
  )
}

export function SkeletonTodoPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-6">
        <SkeletonBlock className="w-32 h-6" />
        <SkeletonBlock className="w-24 h-4" />
      </div>
      <SkeletonBlock className="w-full h-2 mb-6" />
      <SkeletonBlock className="w-24 h-4 mb-3" />
      {[...Array(5)].map((_, i) => (
        <SkeletonTodoItem key={i} />
      ))}
    </div>
  )
}

export function SkeletonReviewPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-6">
        <SkeletonBlock className="w-40 h-6" />
        <SkeletonBlock className="w-20 h-4" />
      </div>
      <SkeletonBlock className="w-full h-20 mb-4" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4">
          <SkeletonBlock className="w-16 h-5 mb-2" />
          <SkeletonBlock className="w-full h-4 mb-1" />
          <SkeletonBlock className="w-3/4 h-4" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonMemoPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-6">
        <SkeletonBlock className="w-32 h-6" />
        <SkeletonBlock className="w-16 h-8" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="mb-3 p-3 border border-gray-800">
          <SkeletonBlock className="w-3/4 h-4 mb-2" />
          <SkeletonBlock className="w-24 h-3" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCoachingPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-6">
        <SkeletonBlock className="w-36 h-6" />
      </div>
      <SkeletonBlock className="w-full h-32 mb-4" />
      <SkeletonBlock className="w-full h-12 mb-3" />
      {[...Array(3)].map((_, i) => (
        <SkeletonBlock key={i} className="w-full h-16 mb-2" />
      ))}
    </div>
  )
}

export function SkeletonCoachingSessionPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-8 h-8 rounded-lg" />
          <div>
            <SkeletonBlock className="w-40 h-4 mb-1" />
            <SkeletonBlock className="w-24 h-3" />
          </div>
        </div>
        <SkeletonBlock className="w-24 h-8 rounded-lg" />
      </div>
      <SkeletonBlock className="w-full h-10 mb-6 rounded-xl" />
      <SkeletonBlock className="w-full h-36 mb-6 rounded-2xl" />
      <div className="flex gap-1 mb-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonBlock key={i} className="h-1.5 flex-1 rounded-full" />
        ))}
      </div>
      <SkeletonBlock className="w-full h-28 mb-3 rounded-xl" />
      <SkeletonBlock className="w-full h-12 rounded-xl" />
    </div>
  )
}
