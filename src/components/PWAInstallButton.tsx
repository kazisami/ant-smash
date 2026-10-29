import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed and launched from home screen, hide prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold px-3 py-2 text-sm shadow-md transition-all cursor-pointer border-2 border-amber-300"
        aria-label="Add to Home Screen"
      >
        <Download className="w-4 h-4 text-white" />
        <span>Add to Home Screen</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold px-3 py-2 text-sm shadow-md transition-all cursor-pointer border-2 border-amber-300"
          aria-label="Add to iPhone or iPad Home Screen"
        >
          <Smartphone className="w-4 h-4 text-white" />
          <span>{compact ? 'Add to Phone' : 'Add to Home Screen'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-4 border-amber-300 relative text-slate-800">
              <button
                onClick={() => setShowGuide(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
                aria-label="Close guide"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-2 rounded-2xl bg-amber-100 flex items-center justify-center border-2 border-amber-300">
                  <span className="text-3xl">🐜</span>
                </div>
                <h3 className="text-xl font-black text-amber-900">Add Ant Squasher</h3>
                <p className="text-xs text-amber-700 font-medium">To play fullscreen offline anytime!</p>
              </div>

              <div className="space-y-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 text-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm shrink-0 mt-0.5">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Step 1:</span> Tap the Safari{' '}
                    <strong className="text-blue-600">Share</strong> icon at the bottom of your screen.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-800 text-white shadow-sm shrink-0 mt-0.5">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Step 2:</span> Scroll down and tap{' '}
                    <strong className="text-slate-900">Add to Home Screen</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm shrink-0 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Step 3:</span> Tap{' '}
                    <strong className="text-emerald-700">Add</strong>. Ready for your toddler to play!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 text-base font-black text-white shadow-md active:scale-98 transition-all"
              >
                Got it, Let's Play!
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for generic desktop or manual install help
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-2 rounded-2xl bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 font-bold px-3 py-2 text-xs transition-all cursor-pointer border border-amber-300"
        aria-label="Install App Information"
      >
        <Smartphone className="w-4 h-4 text-amber-700" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-4 border-amber-300 relative text-slate-800">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
              aria-label="Close guide"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-2 rounded-2xl bg-amber-100 flex items-center justify-center border-2 border-amber-300">
                <span className="text-3xl">🐜</span>
              </div>
              <h3 className="text-xl font-black text-amber-900">Install Ant Squasher</h3>
              <p className="text-xs text-amber-700">Works 100% offline on phones & tablets!</p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              On <strong>iPhone/iPad</strong>: Tap the Share button in Safari and choose <strong>Add to Home Screen</strong>.<br/><br/>
              On <strong>Android</strong>: Tap the menu (three dots) in Chrome and tap <strong>Install App</strong> or <strong>Add to Home screen</strong>.
            </p>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 text-base font-black text-white shadow-md active:scale-98 transition-all"
            >
              Back to Game
            </button>
          </div>
        </div>
      )}
    </>
  );
};
