import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Zap,
  Shield,
  Bomb,
  Flame,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Compass,
  Vibrate,
  RefreshCw,
  HelpCircle,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Disc,
  Gauge,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { GameInput } from '../game/types.ts';
import { RETRO_GAMES, RetroGameId } from '../game/retroGames.ts';
import { sound } from '../game/audio.ts';
import { NetworkClient } from '../network/networkClient.ts';

interface PhoneControllerProps {
  roomId: string;
  playerId?: number;
  standalone?: boolean;
  activeGame?: RetroGameId;
  onGameChange?: (gameId: RetroGameId) => void;
  onInputEmit?: (input: GameInput) => void;
  onOpenHelp?: () => void;
}

export const PhoneController: React.FC<PhoneControllerProps> = ({
  roomId: initialRoomId,
  playerId: initialPlayerId = 1,
  standalone = false,
  activeGame: propActiveGame = 'void_horizon',
  onGameChange,
  onInputEmit,
  onOpenHelp,
}) => {
  const [roomId, setRoomId] = useState(initialRoomId || 'CAST1');
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [activeGame, setActiveGame] = useState<RetroGameId>(propActiveGame);
  const [connected, setConnected] = useState(false);
  const [pingMs, setPingMs] = useState(12);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGameSelector, setShowGameSelector] = useState(false);

  // Ship/Game telemetry relayed from display to controller
  const [telemetry, setTelemetry] = useState({
    health: 5,
    maxHealth: 5,
    shield: 100,
    energy: 100,
    bombCharge: 100,
    score: 0,
  });

  const netRef = useRef<NetworkClient | null>(null);

  // Controller inputs
  const inputRef = useRef<GameInput>({
    stickX: 0,
    stickY: 0,
    fire: false,
    boost: false,
    shield: false,
    bomb: false,
    tiltX: 0,
    tiltY: 0,
  });

  // Joystick state
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (propActiveGame) setActiveGame(propActiveGame);
  }, [propActiveGame]);

  // Vibrate phone helper
  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore if restricted
      }
    }
  }, [hapticsEnabled]);

  // Emit input to display
  const emitInput = useCallback(() => {
    const currentInput = inputRef.current;
    if (onInputEmit) {
      onInputEmit(currentInput);
    }
    netRef.current?.sendInput(currentInput);
  }, [onInputEmit]);

  // Switch game handler
  const handleSelectGame = (gameId: RetroGameId) => {
    setActiveGame(gameId);
    setShowGameSelector(false);
    triggerHaptic([40, 40, 80]);
    if (onGameChange) onGameChange(gameId);
    netRef.current?.sendGameChange(gameId);
  };

  // Multi-Transport Network Client (WebSocket + WebRTC P2P + BroadcastChannel)
  useEffect(() => {
    const net = new NetworkClient('controller', roomId, playerId, {
      onConnected: (info) => {
        setConnected(true);
        if (info.playerId) setPlayerId(info.playerId);
        triggerHaptic([50, 50, 100]);
      },
      onDisconnected: () => {
        setConnected(false);
      },
      onGameChanged: (gameId) => {
        setActiveGame(gameId);
        triggerHaptic([30, 30]);
      },
      onHapticEvent: (data) => {
        if (data.pattern) triggerHaptic(data.pattern);
        setTelemetry((prev) => ({
          ...prev,
          health: data.health !== undefined ? data.health : prev.health,
          shield: data.shield !== undefined ? data.shield : prev.shield,
          score: data.score !== undefined ? data.score : prev.score,
        }));
      },
      onPing: (ms) => setPingMs(ms),
    });
    netRef.current = net;

    return () => {
      net.dispose();
    };
  }, [roomId, playerId, triggerHaptic]);

  // Gyroscope tilt support
  useEffect(() => {
    if (!gyroEnabled) {
      inputRef.current.tiltX = 0;
      inputRef.current.tiltY = 0;
      emitInput();
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0;
      const beta = e.beta || 0;

      const tiltX = Math.max(-1, Math.min(1, gamma / 25));
      const tiltY = Math.max(-1, Math.min(1, (beta - 40) / 25));

      inputRef.current.tiltX = tiltX;
      inputRef.current.tiltY = tiltY;
      emitInput();
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroEnabled, emitInput]);

  // Touch joystick handling
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      const touch = e.touches[0];
      touchIdRef.current = touch.identifier;
      updateJoystick(touch.clientX, touch.clientY);
    } else {
      updateJoystick(e.clientX, e.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchIdRef.current) {
          updateJoystick(e.touches[i].clientX, e.touches[i].clientY);
          break;
        }
      }
    } else if (e.buttons === 1) {
      updateJoystick(e.clientX, e.clientY);
    }
  };

  const handleTouchEnd = () => {
    touchIdRef.current = null;
    setStickPos({ x: 0, y: 0 });
    inputRef.current.stickX = 0;
    inputRef.current.stickY = 0;
    emitInput();
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDist = rect.width / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxDist) {
      normX = (dx / dist) * maxDist;
      normY = (dy / dist) * maxDist;
    }

    setStickPos({ x: normX, y: normY });
    inputRef.current.stickX = normX / maxDist;
    inputRef.current.stickY = normY / maxDist;
    emitInput();
  };

  // Button actions
  const setButtonState = (key: 'fire' | 'boost' | 'shield' | 'bomb', active: boolean) => {
    inputRef.current[key] = active;
    if (active) {
      triggerHaptic(key === 'bomb' ? [120, 40, 180] : 30);
      if (soundEnabled) sound.playClick(key === 'fire');
    }
    emitInput();
  };

  const setDpadDirection = (x: number, y: number) => {
    inputRef.current.stickX = x;
    inputRef.current.stickY = y;
    triggerHaptic(20);
    if (soundEnabled) sound.playClick();
    emitInput();
  };

  const currentDef = RETRO_GAMES.find(g => g.id === activeGame) || RETRO_GAMES[0];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className={`relative flex flex-col justify-between w-full h-full bg-slate-950 text-slate-100 select-none overflow-hidden touch-none ${standalone ? 'min-h-screen' : ''}`}>
      {/* Background Controller Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* Top Console Telemetry Header */}
      <header className="relative z-20 flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono">
            {connected ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">LINKED</span>
                <span className="text-slate-400 text-[10px]">({pingMs}ms)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span>CONNECTING</span>
              </span>
            )}
          </div>

          {/* Active Retro Game Selector Button */}
          <button
            onClick={() => setShowGameSelector(!showGameSelector)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-500/50 bg-cyan-950/60 text-cyan-300 font-mono text-xs font-bold hover:bg-cyan-900 transition-colors"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate max-w-[120px]">{currentDef.title}</span>
            <span className="text-[10px] text-cyan-400/80">▼</span>
          </button>
        </div>

        {/* Status Utilities */}
        <div className="flex items-center gap-1.5">
          {/* Hull Health */}
          <div className="flex items-center gap-1 mr-1">
            <span className="text-[9px] text-slate-400 font-mono">HP</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-xs border transition-colors ${
                    i < telemetry.health
                      ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_6px_#10b981]'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setGyroEnabled(!gyroEnabled);
              triggerHaptic(25);
            }}
            title="Motion / Gyro Steering"
            className={`p-1.5 rounded border text-xs ${
              gyroEnabled
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setHapticsEnabled(!hapticsEnabled);
              triggerHaptic(50);
            }}
            title="Haptic Feedback"
            className={`p-1.5 rounded border text-xs ${
              hapticsEnabled
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Vibrate className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Controller Sound"
            className="p-1.5 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            title="Fullscreen"
            className="p-1.5 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              title="Projector Setup Instructions"
              className="p-1.5 rounded border bg-cyan-900/60 border-cyan-700 text-cyan-300 hover:bg-cyan-800"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Game Switcher Dropdown Modal */}
      {showGameSelector && (
        <div className="absolute inset-x-2 top-14 z-30 bg-slate-900 border-2 border-cyan-500 rounded-xl p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-cyan-300">SELECT RETRO GAME CARTRIDGE</span>
            <button
              onClick={() => setShowGameSelector(false)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              [X]
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RETRO_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game.id)}
                className={`flex flex-col text-left p-2 rounded-lg border transition-all ${
                  activeGame === game.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs text-white">{game.title}</span>
                  <span className="text-[9px] font-mono text-slate-400">{game.year}</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 mt-0.5">{game.badge}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Gamepad Touch Area - Morphs based on activeGame */}
      <main className="relative flex-1 flex flex-row items-center justify-around p-2 sm:p-4 gap-2 sm:gap-4 z-10 overflow-hidden">
        {/* =========================================================================
            GAME 0: SUPER PLUMBER (NES Cross D-Pad + [B] Dash/Fire + [A] Jump)
           ========================================================================= */}
        {activeGame === 'super_plumber' && (
          <>
            {/* Left Side: Tactile NES Cross D-Pad */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-red-400 uppercase flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-red-400" />
                NES CROSS D-PAD
              </div>
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 grid grid-cols-3 grid-rows-3 gap-1.5 p-2 bg-slate-900 rounded-3xl border-2 border-red-500/50 shadow-[0_0_24px_rgba(239,68,68,0.25)]">
                <div />
                <button
                  onMouseDown={() => setDpadDirection(0, -1)}
                  onTouchStart={() => setDpadDirection(0, -1)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="bg-slate-800 border-2 border-red-500/70 rounded-xl flex items-center justify-center active:bg-red-600 active:text-white transition-all text-slate-300 shadow-md"
                  aria-label="Look Up"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>
                <div />

                <button
                  onMouseDown={() => setDpadDirection(-1, 0)}
                  onTouchStart={() => setDpadDirection(-1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="bg-slate-800 border-2 border-red-500/70 rounded-xl flex items-center justify-center active:bg-red-600 active:text-white transition-all text-slate-300 shadow-md"
                  aria-label="Move Left"
                >
                  <ArrowLeft className="w-7 h-7" />
                </button>
                <div className="bg-slate-950 rounded-lg flex items-center justify-center border border-red-900/50">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500/60" />
                </div>
                <button
                  onMouseDown={() => setDpadDirection(1, 0)}
                  onTouchStart={() => setDpadDirection(1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="bg-slate-800 border-2 border-red-500/70 rounded-xl flex items-center justify-center active:bg-red-600 active:text-white transition-all text-slate-300 shadow-md"
                  aria-label="Move Right"
                >
                  <ArrowRight className="w-7 h-7" />
                </button>

                <div />
                <button
                  onMouseDown={() => setDpadDirection(0, 1)}
                  onTouchStart={() => setDpadDirection(0, 1)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="bg-slate-800 border-2 border-red-500/70 rounded-xl flex items-center justify-center active:bg-red-600 active:text-white transition-all text-slate-300 shadow-md"
                  aria-label="Crouch"
                >
                  <ArrowDown className="w-6 h-6" />
                </button>
                <div />
              </div>
              <div className="mt-1 text-[9px] font-mono text-slate-400">HOLD TO RUN LEFT / RIGHT</div>
            </div>

            {/* Right Side: Angled NES Action Buttons [B] and [A] */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-[260px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-red-400 uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-red-400" />
                ACTION BUTTONS
              </div>
              <div className="flex items-center gap-3 sm:gap-4 p-3 bg-slate-900/90 rounded-3xl border-2 border-red-500/40 shadow-xl">
                {/* Button [B]: Dash & Fireball */}
                <button
                  onTouchStart={() => setButtonState('fire', true)}
                  onTouchEnd={() => setButtonState('fire', false)}
                  onMouseDown={() => setButtonState('fire', true)}
                  onMouseUp={() => setButtonState('fire', false)}
                  className="w-22 h-22 sm:w-26 sm:h-26 rounded-full bg-gradient-to-b from-red-600 to-red-900 border-4 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex flex-col items-center justify-center active:scale-95 transition-all select-none"
                  aria-label="Dash and Fireball"
                >
                  <Flame className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow" />
                  <span className="font-black font-mono text-base sm:text-lg text-white mt-0.5">B</span>
                  <span className="text-[8px] sm:text-[9px] font-mono text-red-200 uppercase font-semibold">DASH/FIRE</span>
                </button>

                {/* Button [A]: Jump */}
                <button
                  onTouchStart={() => setButtonState('boost', true)}
                  onTouchEnd={() => setButtonState('boost', false)}
                  onMouseDown={() => setButtonState('boost', true)}
                  onMouseUp={() => setButtonState('boost', false)}
                  className="w-22 h-22 sm:w-26 sm:h-26 rounded-full bg-gradient-to-b from-rose-500 to-rose-800 border-4 border-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.6)] flex flex-col items-center justify-center active:scale-95 transition-all select-none -translate-y-2 sm:-translate-y-3"
                  aria-label="Jump"
                >
                  <ArrowUp className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow stroke-[3]" />
                  <span className="font-black font-mono text-base sm:text-lg text-white mt-0.5">A</span>
                  <span className="text-[8px] sm:text-[9px] font-mono text-rose-100 uppercase font-semibold">JUMP</span>
                </button>
              </div>
              <div className="mt-1 text-[9px] font-mono text-slate-400 text-center">
                [A] LEAP / STOMP · [B] RUN & FIREBALL
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 1: VOID HORIZON (Analog Flight Stick + 4 Combat Buttons)
           ========================================================================= */}
        {activeGame === 'void_horizon' && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-1 text-[10px] sm:text-xs font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                FLIGHT STICK
              </div>
              <div
                ref={joystickBaseRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-slate-900/90 border-2 border-slate-700/80 shadow-[inset_0_4px_16px_rgba(0,0,0,0.8),0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
              >
                <div className="absolute inset-3 sm:inset-4 rounded-full border border-slate-800/80 pointer-events-none" />
                <div className="absolute inset-8 sm:inset-10 rounded-full border border-slate-800/60 pointer-events-none" />
                <div className="absolute w-full h-[1px] bg-slate-800/70 pointer-events-none" />
                <div className="absolute h-full w-[1px] bg-slate-800/70 pointer-events-none" />
                <div
                  style={{
                    transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                    transition: stickPos.x === 0 && stickPos.y === 0 ? 'transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none',
                  }}
                  className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border-2 border-cyan-400/80 shadow-[0_4px_16px_rgba(0,240,255,0.4)] flex items-center justify-center"
                >
                  <div className="w-6 h-6 rounded-full bg-cyan-500/30 border border-cyan-400 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00f0ff]" />
                  </div>
                </div>
              </div>
              <div className="mt-1 text-[9px] font-mono text-slate-500 text-center">
                {gyroEnabled ? 'TILT PHONE TO STEER' : '360° ANALOG STICK'}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-1 text-[10px] sm:text-xs font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-rose-400" />
                TRIGGERS
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
                <button
                  onTouchStart={() => setButtonState('fire', true)}
                  onTouchEnd={() => setButtonState('fire', false)}
                  onMouseDown={() => setButtonState('fire', true)}
                  onMouseUp={() => setButtonState('fire', false)}
                  className="group relative flex flex-col items-center justify-center h-16 sm:h-20 rounded-xl bg-gradient-to-b from-rose-600 to-rose-800 border-2 border-rose-400 shadow-[0_4px_14px_rgba(244,63,94,0.4)] active:translate-y-1 transition-all select-none p-1"
                >
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" />
                  <span className="font-bold font-mono text-xs sm:text-sm tracking-wider text-white">FIRE</span>
                  <span className="text-[8px] font-mono text-rose-200 hidden sm:inline">BLASTER</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('boost', true)}
                  onTouchEnd={() => setButtonState('boost', false)}
                  onMouseDown={() => setButtonState('boost', true)}
                  onMouseUp={() => setButtonState('boost', false)}
                  className="group relative flex flex-col items-center justify-center h-16 sm:h-20 rounded-xl bg-gradient-to-b from-sky-600 to-sky-800 border-2 border-sky-400 shadow-[0_4px_14px_rgba(56,189,248,0.4)] active:translate-y-1 transition-all select-none p-1"
                >
                  <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" />
                  <span className="font-bold font-mono text-xs sm:text-sm tracking-wider text-white">BOOST</span>
                  <span className="text-[8px] font-mono text-sky-200 hidden sm:inline">THRUST</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('shield', true)}
                  onTouchEnd={() => setButtonState('shield', false)}
                  onMouseDown={() => setButtonState('shield', true)}
                  onMouseUp={() => setButtonState('shield', false)}
                  className="group relative flex flex-col items-center justify-center h-16 sm:h-20 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 border-2 border-teal-400 shadow-[0_4px_14px_rgba(20,184,166,0.35)] active:translate-y-1 transition-all select-none p-1"
                >
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" />
                  <span className="font-bold font-mono text-xs sm:text-sm tracking-wider text-white">SHIELD</span>
                  <span className="text-[8px] font-mono text-teal-200 hidden sm:inline">BARRIER</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('bomb', true)}
                  onTouchEnd={() => setButtonState('bomb', false)}
                  onMouseDown={() => setButtonState('bomb', true)}
                  onMouseUp={() => setButtonState('bomb', false)}
                  className="group relative flex flex-col items-center justify-center h-16 sm:h-20 rounded-xl bg-gradient-to-b from-purple-600 to-purple-900 border-2 border-purple-400 shadow-[0_4px_14px_rgba(168,85,247,0.4)] active:translate-y-1 transition-all select-none p-1"
                >
                  <Bomb className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" />
                  <span className="font-bold font-mono text-xs sm:text-sm tracking-wider text-white">BOMB</span>
                  <span className="text-[8px] font-mono text-purple-200 hidden sm:inline">EMP</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 2: CYBER SNAKE (Tactile 4-Way D-Pad + Turbo Boost)
           ========================================================================= */}
        {activeGame === 'cyber_snake' && (
          <>
            {/* Left Side: 4-Way Cross D-Pad */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
                TACTILE 4-WAY D-PAD
              </div>
              <div className="relative w-40 h-40 grid grid-cols-3 grid-rows-3 gap-1.5 p-2 bg-slate-900 rounded-3xl border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <div />
                <button
                  onMouseDown={() => setDpadDirection(0, -1)}
                  onTouchStart={() => setDpadDirection(0, -1)}
                  className="bg-emerald-950/80 border-2 border-emerald-500 rounded-xl flex items-center justify-center active:bg-emerald-500 active:text-black transition-all shadow-md text-emerald-300"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>
                <div />

                <button
                  onMouseDown={() => setDpadDirection(-1, 0)}
                  onTouchStart={() => setDpadDirection(-1, 0)}
                  className="bg-emerald-950/80 border-2 border-emerald-500 rounded-xl flex items-center justify-center active:bg-emerald-500 active:text-black transition-all shadow-md text-emerald-300"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="bg-slate-950 rounded-lg flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <button
                  onMouseDown={() => setDpadDirection(1, 0)}
                  onTouchStart={() => setDpadDirection(1, 0)}
                  className="bg-emerald-950/80 border-2 border-emerald-500 rounded-xl flex items-center justify-center active:bg-emerald-500 active:text-black transition-all shadow-md text-emerald-300"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>

                <div />
                <button
                  onMouseDown={() => setDpadDirection(0, 1)}
                  onTouchStart={() => setDpadDirection(0, 1)}
                  className="bg-emerald-950/80 border-2 border-emerald-500 rounded-xl flex items-center justify-center active:bg-emerald-500 active:text-black transition-all shadow-md text-emerald-300"
                >
                  <ArrowDown className="w-6 h-6" />
                </button>
                <div />
              </div>
            </div>

            {/* Right Side: Turbo Boost & Brake */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px] gap-3">
              <div className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
                SPEED MODIFIERS
              </div>
              <button
                onTouchStart={() => setButtonState('boost', true)}
                onTouchEnd={() => setButtonState('boost', false)}
                onMouseDown={() => setButtonState('boost', true)}
                onMouseUp={() => setButtonState('boost', false)}
                className="w-full max-w-[180px] h-20 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-900 border-2 border-emerald-400 shadow-[0_4px_16px_rgba(16,185,129,0.4)] flex flex-col items-center justify-center active:translate-y-1 transition-all"
              >
                <Flame className="w-6 h-6 text-white" />
                <span className="font-black font-mono text-sm tracking-wider text-white">TURBO NITRO</span>
                <span className="text-[9px] font-mono text-emerald-200">2X SPEED</span>
              </button>

              <button
                onTouchStart={() => setButtonState('shield', true)}
                onTouchEnd={() => setButtonState('shield', false)}
                onMouseDown={() => setButtonState('shield', true)}
                onMouseUp={() => setButtonState('shield', false)}
                className="w-full max-w-[180px] h-14 rounded-xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center gap-2 active:bg-slate-800 transition-all"
              >
                <Disc className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs text-slate-300">PRECISION STEER</span>
              </button>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 3: GALACTIC INVADERS (Horizontal Cannon Steer + Rapid Cannon)
           ========================================================================= */}
        {activeGame === 'galactic_invaders' && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-rose-400 uppercase">
                CANNON STRAFE
              </div>
              <div className="flex items-center gap-3 w-full max-w-[220px]">
                <button
                  onTouchStart={() => setDpadDirection(-1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(-1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-28 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-rose-500/60 shadow-lg flex flex-col items-center justify-center active:bg-rose-950 transition-all"
                >
                  <ArrowLeft className="w-8 h-8 text-rose-400" />
                  <span className="font-mono text-xs font-bold text-white mt-1">LEFT</span>
                </button>
                <button
                  onTouchStart={() => setDpadDirection(1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-28 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-rose-500/60 shadow-lg flex flex-col items-center justify-center active:bg-rose-950 transition-all"
                >
                  <ArrowRight className="w-8 h-8 text-rose-400" />
                  <span className="font-mono text-xs font-bold text-white mt-1">RIGHT</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-rose-400 uppercase">
                DEFENSE BATTERY
              </div>
              <button
                onTouchStart={() => setButtonState('fire', true)}
                onTouchEnd={() => setButtonState('fire', false)}
                onMouseDown={() => setButtonState('fire', true)}
                onMouseUp={() => setButtonState('fire', false)}
                className="w-36 h-36 rounded-full bg-gradient-to-b from-rose-500 to-red-800 border-4 border-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.5)] flex flex-col items-center justify-center active:scale-95 transition-all"
              >
                <Zap className="w-10 h-10 text-white animate-pulse" />
                <span className="font-black font-mono text-base tracking-wider text-white mt-1">FIRE</span>
                <span className="text-[10px] font-mono text-rose-200">LASER CANNON</span>
              </button>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 4: NEON PONG (Precision Paddle Track + Smash Spike)
           ========================================================================= */}
        {activeGame === 'neon_pong' && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-yellow-400 uppercase">
                PADDLE ELEVATION
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[180px]">
                <button
                  onTouchStart={() => setDpadDirection(0, -1)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(0, -1)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="w-full h-16 rounded-xl bg-slate-900 border-2 border-yellow-500 flex items-center justify-center gap-2 active:bg-yellow-950 transition-all"
                >
                  <ArrowUp className="w-6 h-6 text-yellow-400" />
                  <span className="font-mono text-xs font-bold text-white">UP</span>
                </button>
                <button
                  onTouchStart={() => setDpadDirection(0, 1)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(0, 1)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="w-full h-16 rounded-xl bg-slate-900 border-2 border-yellow-500 flex items-center justify-center gap-2 active:bg-yellow-950 transition-all"
                >
                  <ArrowDown className="w-6 h-6 text-yellow-400" />
                  <span className="font-mono text-xs font-bold text-white">DOWN</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-yellow-400 uppercase">
                SPIN & SMASH
              </div>
              <button
                onTouchStart={() => setButtonState('boost', true)}
                onTouchEnd={() => setButtonState('boost', false)}
                onMouseDown={() => setButtonState('boost', true)}
                onMouseUp={() => setButtonState('boost', false)}
                className="w-32 h-32 rounded-2xl bg-gradient-to-b from-yellow-500 to-amber-700 border-2 border-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.4)] flex flex-col items-center justify-center active:scale-95 transition-all"
              >
                <Sparkles className="w-8 h-8 text-white" />
                <span className="font-black font-mono text-sm tracking-wider text-white mt-1">HYPER SMASH</span>
                <span className="text-[9px] font-mono text-yellow-100">CURVE SPIKE</span>
              </button>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 5: TURBO HIGHWAY RACER (Steering Wheel / Gyro + Pedals + NOS)
           ========================================================================= */}
        {activeGame === 'turbo_racer' && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-orange-400 uppercase">
                STEERING WHEEL
              </div>
              <div className="flex items-center gap-2 w-full max-w-[220px]">
                <button
                  onTouchStart={() => setDpadDirection(-1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(-1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-28 rounded-2xl bg-slate-900 border-2 border-orange-500 shadow-md flex flex-col items-center justify-center active:bg-orange-950 transition-all"
                >
                  <ArrowLeft className="w-8 h-8 text-orange-400" />
                  <span className="font-mono text-xs font-bold text-white mt-1">STEER LEFT</span>
                </button>
                <button
                  onTouchStart={() => setDpadDirection(1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-28 rounded-2xl bg-slate-900 border-2 border-orange-500 shadow-md flex flex-col items-center justify-center active:bg-orange-950 transition-all"
                >
                  <ArrowRight className="w-8 h-8 text-orange-400" />
                  <span className="font-mono text-xs font-bold text-white mt-1">STEER RIGHT</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-orange-400 uppercase">
                RACING PEDALS
              </div>
              <div className="flex items-center gap-2 w-full max-w-[220px]">
                <button
                  onTouchStart={() => setButtonState('shield', true)}
                  onTouchEnd={() => setButtonState('shield', false)}
                  onMouseDown={() => setButtonState('shield', true)}
                  onMouseUp={() => setButtonState('shield', false)}
                  className="flex-1 h-28 rounded-xl bg-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center active:bg-red-950 transition-all"
                >
                  <Disc className="w-6 h-6 text-slate-400" />
                  <span className="font-mono text-xs font-bold text-slate-300 mt-1">BRAKE</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('boost', true)}
                  onTouchEnd={() => setButtonState('boost', false)}
                  onMouseDown={() => setButtonState('boost', true)}
                  onMouseUp={() => setButtonState('boost', false)}
                  className="flex-1 h-28 rounded-xl bg-gradient-to-b from-orange-500 to-amber-700 border-2 border-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.4)] flex flex-col items-center justify-center active:scale-95 transition-all"
                >
                  <Gauge className="w-7 h-7 text-white" />
                  <span className="font-black font-mono text-xs text-white mt-1">NITRO NOS</span>
                  <span className="text-[8px] font-mono text-orange-200">FULL THROTTLE</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            GAME 6: VECTOR ASTEROIDS 1980 (Rotate L/R + Thrust + Fire + Hyperspace)
           ========================================================================= */}
        {activeGame === 'vector_asteroids' && (
          <>
            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-purple-400 uppercase">
                ROTARY ATTITUDE
              </div>
              <div className="flex items-center gap-2 w-full max-w-[220px]">
                <button
                  onTouchStart={() => setDpadDirection(-1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(-1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-24 rounded-2xl bg-slate-900 border-2 border-purple-500 shadow-md flex flex-col items-center justify-center active:bg-purple-950 transition-all"
                >
                  <RotateCcw className="w-7 h-7 text-purple-400" />
                  <span className="font-mono text-xs font-bold text-white mt-1">TURN LEFT</span>
                </button>
                <button
                  onTouchStart={() => setDpadDirection(1, 0)}
                  onTouchEnd={() => setDpadDirection(0, 0)}
                  onMouseDown={() => setDpadDirection(1, 0)}
                  onMouseUp={() => setDpadDirection(0, 0)}
                  className="flex-1 h-24 rounded-2xl bg-slate-900 border-2 border-purple-500 shadow-md flex flex-col items-center justify-center active:bg-purple-950 transition-all"
                >
                  <RotateCcw className="w-7 h-7 text-purple-400 scale-x-[-1]" />
                  <span className="font-mono text-xs font-bold text-white mt-1">TURN RIGHT</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 max-w-[240px]">
              <div className="mb-2 text-[10px] font-mono tracking-widest text-purple-400 uppercase">
                THRUST & CANNON
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[220px]">
                <button
                  onTouchStart={() => setButtonState('boost', true)}
                  onTouchEnd={() => setButtonState('boost', false)}
                  onMouseDown={() => setButtonState('boost', true)}
                  onMouseUp={() => setButtonState('boost', false)}
                  className="h-18 rounded-xl bg-gradient-to-b from-sky-600 to-sky-900 border-2 border-sky-400 flex flex-col items-center justify-center active:scale-95 transition-all"
                >
                  <Flame className="w-5 h-5 text-white" />
                  <span className="font-mono text-xs font-bold text-white">THRUST</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('fire', true)}
                  onTouchEnd={() => setButtonState('fire', false)}
                  onMouseDown={() => setButtonState('fire', true)}
                  onMouseUp={() => setButtonState('fire', false)}
                  className="h-18 rounded-xl bg-gradient-to-b from-purple-600 to-purple-900 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] flex flex-col items-center justify-center active:scale-95 transition-all"
                >
                  <Zap className="w-5 h-5 text-white" />
                  <span className="font-mono text-xs font-bold text-white">FIRE</span>
                </button>
                <button
                  onTouchStart={() => setButtonState('bomb', true)}
                  onTouchEnd={() => setButtonState('bomb', false)}
                  onMouseDown={() => setButtonState('bomb', true)}
                  onMouseUp={() => setButtonState('bomb', false)}
                  className="col-span-2 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center gap-1.5 active:bg-slate-800 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span className="font-mono text-[10px] text-purple-300">HYPERSPACE TELEPORT</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bottom Bar: Clean room code switch */}
      <footer className="relative z-10 px-3 sm:px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span>ROOM:</span>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-18 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-cyan-300 font-bold tracking-wider text-center focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => {
              if (wsRef.current) wsRef.current.close();
              triggerHaptic(50);
            }}
            title="Reconnect"
            className="p-1 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[10px] sm:text-[11px] text-slate-500">
          CART: <span className="text-cyan-400 font-semibold">{currentDef.title}</span>
        </div>
      </footer>
    </div>
  );
};
