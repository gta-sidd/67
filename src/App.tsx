/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProjectorDisplay } from './components/ProjectorDisplay.tsx';
import { PhoneController } from './components/PhoneController.tsx';
import { DualScreenSimulator } from './components/DualScreenSimulator.tsx';
import { HowItWorksModal } from './components/HowItWorksModal.tsx';
import { RETRO_GAMES, RetroGameId } from './game/retroGames.ts';
import { Tv, Smartphone, Columns, HelpCircle, Gamepad2 } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<'simulator' | 'projector' | 'controller'>('simulator');
  const [roomId, setRoomId] = useState('CAST1');
  const [activeGame, setActiveGame] = useState<RetroGameId>('super_plumber');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Initialize mode, room, and game from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const urlRoom = params.get('room');
    const urlGame = params.get('game') as RetroGameId;

    if (urlRoom) {
      setRoomId(urlRoom.toUpperCase());
    }

    if (urlGame && RETRO_GAMES.some((g) => g.id === urlGame)) {
      setActiveGame(urlGame);
    }

    if (urlMode === 'projector') {
      setMode('projector');
    } else if (urlMode === 'controller') {
      setMode('controller');
    } else {
      setMode('simulator');
    }
  }, []);

  const handleSwitchMode = (newMode: 'simulator' | 'projector' | 'controller') => {
    setMode(newMode);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', newMode);
    url.searchParams.set('room', roomId);
    url.searchParams.set('game', activeGame);
    window.history.replaceState({}, '', url.toString());
  };

  const handleGameChange = (newGame: RetroGameId) => {
    setActiveGame(newGame);
    const url = new URL(window.location.href);
    url.searchParams.set('game', newGame);
    window.history.replaceState({}, '', url.toString());
  };

  const currentGameDef = RETRO_GAMES.find((g) => g.id === activeGame) || RETRO_GAMES[0];

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Floating Viewport Selector */}
      {mode !== 'controller' && (
        <nav className="w-full bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono z-40 gap-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-cyan-400 tracking-wider">
              CASTPAD RETRO
            </span>
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>ACTIVE: <strong>{currentGameDef.title}</strong> ({currentGameDef.year})</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => handleSwitchMode('simulator')}
              className={`px-2.5 sm:px-3 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                mode === 'simulator'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SPLIT SIMULATOR</span>
              <span className="sm:hidden">SPLIT</span>
            </button>

            <button
              onClick={() => handleSwitchMode('projector')}
              className={`px-2.5 sm:px-3 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                mode === 'projector'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PROJECTOR VIEW</span>
              <span className="sm:hidden">PROJECTOR</span>
            </button>

            <button
              onClick={() => handleSwitchMode('controller')}
              className={`px-2.5 sm:px-3 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                mode === 'controller'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PHONE GAMEPAD</span>
              <span className="sm:hidden">GAMEPAD</span>
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="px-2.5 py-1 rounded-md bg-cyan-950 border border-cyan-700 text-cyan-300 hover:bg-cyan-900 transition-colors flex items-center gap-1 font-bold"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HOW IT WORKS</span>
            </button>
          </div>
        </nav>
      )}

      {/* Main Mode View */}
      <div className="flex-1 w-full h-full flex flex-col">
        {mode === 'simulator' && (
          <DualScreenSimulator
            roomId={roomId}
            activeGame={activeGame}
            onGameChange={handleGameChange}
            onOpenHelp={() => setIsHelpOpen(true)}
            onSwitchMode={handleSwitchMode}
          />
        )}

        {mode === 'projector' && (
          <div className="w-full h-screen bg-black flex items-center justify-center">
            <ProjectorDisplay
              roomId={roomId}
              activeGame={activeGame}
              onGameChange={handleGameChange}
              onOpenHelp={() => setIsHelpOpen(true)}
              onOpenPhoneView={() => handleSwitchMode('controller')}
            />
          </div>
        )}

        {mode === 'controller' && (
          <div className="w-full min-h-screen bg-slate-950 flex flex-col">
            <PhoneController
              roomId={roomId}
              activeGame={activeGame}
              onGameChange={handleGameChange}
              standalone={true}
              onOpenHelp={() => setIsHelpOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Educational & Architectural Modal */}
      <HowItWorksModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
