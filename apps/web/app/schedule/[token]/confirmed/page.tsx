export default function ConfirmedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
          <div className="text-6xl mb-5">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You&apos;re all set!
          </h1>
          <p className="text-gray-500 mb-6">
            Your appointment is confirmed. You&apos;ll receive a text message
            shortly with the details. We&apos;ll call you at your scheduled time.
          </p>
          <div className="bg-indigo-50 rounded-xl px-4 py-3 text-indigo-700 text-sm font-medium">
            Check your phone for a confirmation text.
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-6">Powered by SyncCoreHub</p>
      </div>
    </div>
  );
}
