import React from 'react';
import {
  Tv,
  Smartphone,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight,
  Monitor,
  Cast,
  HelpCircle,
  X,
} from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-mono text-white">
              Can You Play on a Projector with Phone-Only Controls?
            </h2>
            <p className="text-cyan-400 text-xs font-mono">
              DIRECT ANSWER & TECHNICAL ARCHITECTURE
            </p>
          </div>
        </div>

        {/* Direct Answer Banner */}
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="text-emerald-300 font-semibold block mb-1">
              YES, ABSOLUTELY! Here is why and how it works:
            </strong>
            <p className="text-slate-200 text-xs leading-relaxed">
              Standard screen mirroring (Miracast / AirPlay) forces a 1:1 duplicate of your phone screen onto the projector. But with a <strong>Dual-Screen Web Architecture</strong> (like this app), your projector runs the <strong>Receiver Display</strong> (100% full game world), and your phone runs the <strong>Dedicated Gamepad Controller</strong> (only thumbsticks, buttons, and haptics — zero game graphics to distract or drain battery)!
            </p>
          </div>
        </div>

        {/* Comparison: Standard Mirroring vs Dual-Screen Architecture */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/60">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold mb-2">
              <XCircle className="w-4 h-4" /> TRADITIONAL SCREEN MIRRORING
            </div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>❌ Phone screen is mirrored 1:1 onto the projector wall</li>
              <li>❌ Virtual buttons and your thumbs block the movie-sized gameplay</li>
              <li>❌ Severe battery drain & thermal throttling on phone</li>
              <li>❌ Noticeable input lag / video latency over Wi-Fi mirroring</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-700/60">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold mb-2">
              <Zap className="w-4 h-4" /> THIS DUAL-SCREEN WEB SETUP
            </div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>✅ <strong>Zero Game on Phone:</strong> Phone only displays ergonomic virtual buttons & joystick</li>
              <li>✅ <strong>Cinema Projector:</strong> 100% unobstructed 60 FPS visual glory on the projector</li>
              <li>✅ <strong>Sub-15ms Latency:</strong> Only lightweight button coordinates travel via WebSockets</li>
              <li>✅ <strong>Tactile Features:</strong> Phone vibrates on hits, supports motion/gyro steering!</li>
            </ul>
          </div>
        </div>

        {/* How to run it right now on your projector */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-mono font-bold text-white tracking-wider uppercase">
            3 WAYS TO PLAY ON YOUR PROJECTOR:
          </h3>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="px-2 py-1 rounded bg-slate-800 text-xs font-mono font-bold text-cyan-300 shrink-0">
              SETUP 1
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">Smart Projector / FireStick / Android TV Browser</span>
              <p className="text-slate-400 mt-0.5">
                Open this app URL in the built-in Chrome or Firefox browser on your projector. Press Fullscreen, then scan the on-screen QR code with your phone camera!
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="px-2 py-1 rounded bg-slate-800 text-xs font-mono font-bold text-cyan-300 shrink-0">
              SETUP 2
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">HDMI Cable (Laptop / PC to Projector)</span>
              <p className="text-slate-400 mt-0.5">
                Plug your laptop into your projector via HDMI. Open Projector Mode, press Fullscreen (F), and use your phone wirelessly from the couch.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
            <div className="px-2 py-1 rounded bg-slate-800 text-xs font-mono font-bold text-cyan-300 shrink-0">
              SETUP 3
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">Chromecast / Google Cast</span>
              <p className="text-slate-400 mt-0.5">
                Cast the Projector tab from your computer or Chrome browser to your Chromecast projector. Then open the controller link on your smartphone.
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-sm tracking-wider transition-colors shadow-lg shadow-cyan-500/20"
        >
          GOT IT! JUMP INTO GAMEPLAY
        </button>
      </div>
    </div>
  );
};
