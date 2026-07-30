export default function PageLoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
    </div>
  );
}
