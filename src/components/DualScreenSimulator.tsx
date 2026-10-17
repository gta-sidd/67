import React, { useState } from 'react';
import { ProjectorDisplay } from './ProjectorDisplay.tsx';
import { PhoneController } from './PhoneController.tsx';
import { Tv, Smartphone, HelpCircle } from 'lucide-react';
import type { GameInput } from '../game/types.ts';
import type { RetroGameId } from '../game/retroGames.ts';

interface DualScreenSimulatorProps {
  roomId: string;
  activeGame: RetroGameId;
  onGameChange: (gameId: RetroGameId) => void;
  onOpenHelp: () => void;
  onSwitchMode: (mode: 'projector' | 'controller' | 'simulator') => void;
}

export const DualScreenSimulator: React.FC<DualScreenSimulatorProps> = ({
  roomId,
  activeGame,
  onGameChange,
  onOpenHelp,
  onSwitchMode,
}) => {
  const [, setDirectInput] = useState<GameInput | null>(null);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-950 text-slate-100">
      {/* Split Screens Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 sm:p-4 overflow-hidden">
        {/* Left / Top: Projector Big Screen Display (7 Cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col bg-black rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-cyan-300 font-bold">
              <Tv className="w-4 h-4 text-cyan-400" />
              PROJECTOR WALL DISPLAY (NO CONTROLLER ON SCREEN)
            </span>
            <span className="text-[11px] text-slate-400">1080P CINEMA VIEW</span>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black min-h-[360px] sm:min-h-[460px]">
            <ProjectorDisplay
              roomId={roomId}
              activeGame={activeGame}
              onGameChange={onGameChange}
              onOpenHelp={onOpenHelp}
              onOpenPhoneView={() => onSwitchMode('controller')}
            />
          </div>
        </div>

        {/* Right / Bottom: Phone Gamepad Controller (5 Cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-rose-300 font-bold">
              <Smartphone className="w-4 h-4 text-rose-400" />
              YOUR SMARTPHONE (CONTROLLER ONLY · ZERO GAME GRAPHICS)
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">TACTILE GAMEPAD</span>
          </div>

          <div className="flex-1 relative flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] p-2">
            {/* Phone Bezel Frame */}
            <div className="w-full max-w-md h-full rounded-2xl border-2 border-slate-700 bg-slate-950 shadow-2xl overflow-hidden flex flex-col">
              <PhoneController
                roomId={roomId}
                standalone={false}
                activeGame={activeGame}
                onGameChange={onGameChange}
                onInputEmit={(input) => setDirectInput(input)}
                onOpenHelp={onOpenHelp}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Interactive Helper Banner */}
      <footer className="px-4 py-2 bg-slate-900/80 border-t border-slate-800 text-center text-xs font-mono text-slate-400">
        💡 <strong className="text-white">6 Retro Arcade Games Available:</strong> Switch between Void Horizon, Cyber Snake (D-Pad), Galactic Invaders, Neon Pong (Paddle), Turbo Highway (Wheel & Pedals), and Vector Asteroids!
      </footer>
    </div>
  );
};
