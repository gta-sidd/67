import { Peer, DataConnection } from 'peerjs';
import type { GameInput } from '../game/types.ts';
import type { RetroGameId } from '../game/retroGames.ts';

export type NetworkRole = 'display' | 'controller';

export interface NetworkCallbacks {
  onConnected?: (info: { role: NetworkRole; mode: 'websocket' | 'webrtc' | 'broadcast'; playerId?: number }) => void;
  onDisconnected?: () => void;
  onControllerJoined?: (playerId: number) => void;
  onControllerLeft?: (playerId: number) => void;
  onInput?: (input: GameInput, playerId: number) => void;
  onGameChanged?: (gameId: RetroGameId) => void;
  onHapticEvent?: (data: { pattern: number[]; health?: number; shield?: number; score?: number }) => void;
  onPing?: (ms: number) => void;
}

export class NetworkClient {
  public role: NetworkRole;
  public roomId: string;
  public playerId: number;
  public isConnected: boolean = false;
  public transport: 'websocket' | 'webrtc' | 'broadcast' | 'none' = 'none';

  private ws: WebSocket | null = null;
  private peer: Peer | null = null;
  private peerConnections: Map<string, DataConnection> = new Map();
  private controllerPeerConn: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: NetworkCallbacks;
  private disposed: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(role: NetworkRole, roomId: string, playerId = 1, callbacks: NetworkCallbacks = {}) {
    this.role = role;
    this.roomId = roomId.toUpperCase().trim();
    this.playerId = playerId;
    this.callbacks = callbacks;

    this.initBroadcastChannel();
    this.tryWebSocket();
    this.initWebRTC();
  }

  // 1. BroadcastChannel for instant same-browser / split-screen zero-lag communication
  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel(`castpad_${this.roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        if (this.disposed) return;
        const data = event.data;
        this.handleMessage(data, 'broadcast');
      };
    } catch {
      // BroadcastChannel not available
    }
  }

  // 2. Local Full-Stack WebSocket
  private tryWebSocket() {
    if (typeof window === 'undefined') return;

    // If hosted on github.io or static domain without backend, don't spam websocket retries
    const isStaticHost = window.location.hostname.endsWith('github.io') ||
                         window.location.hostname.endsWith('vercel.app') ||
                         window.location.hostname.endsWith('netlify.app');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.disposed) return;
        this.isConnected = true;
        this.transport = 'websocket';

        if (this.role === 'display') {
          this.ws?.send(JSON.stringify({ type: 'register_display', roomId: this.roomId }));
        } else {
          this.ws?.send(JSON.stringify({
            type: 'register_controller',
            roomId: this.roomId,
            requestedPlayerId: this.playerId,
          }));
        }

        this.callbacks.onConnected?.({ role: this.role, mode: 'websocket', playerId: this.playerId });
        this.startPingLoop();
      };

      this.ws.onmessage = (e) => {
        if (this.disposed) return;
        try {
          const data = JSON.parse(e.data);
          this.handleMessage(data, 'websocket');
        } catch {
          // ignore
        }
      };

      this.ws.onerror = () => {
        // Fallback gracefully to WebRTC on static hosts
        if (isStaticHost && this.ws) {
          try { this.ws.close(); } catch { /* ignore */ }
          this.ws = null;
        }
      };

      this.ws.onclose = () => {
        if (this.transport === 'websocket') {
          this.isConnected = false;
          this.transport = 'none';
        }
      };
    } catch {
      // WebSocket creation failed, fallback to WebRTC
    }
  }

  // 3. WebRTC Peer-to-Peer for static GitHub Pages and cross-device communication
  private initWebRTC() {
    if (typeof window === 'undefined') return;

    try {
      const cleanRoom = this.roomId.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (this.role === 'display') {
        const peerId = `castpad-${cleanRoom}-screen`;
        this.peer = new Peer(peerId, {
          debug: 0,
        });

        this.peer.on('open', () => {
          if (this.disposed) return;
          if (this.transport === 'none') {
            this.isConnected = true;
            this.transport = 'webrtc';
            this.callbacks.onConnected?.({ role: 'display', mode: 'webrtc' });
          }
        });

        this.peer.on('connection', (conn) => {
          if (!conn) return;
          this.peerConnections.set(conn.peer, conn);

          conn.on('open', () => {
            const pid = this.peerConnections.size;
            try {
              conn.send({ type: 'registered', role: 'controller', playerId: pid });
            } catch { /* ignore */ }
            this.callbacks.onControllerJoined?.(pid);
          });

          conn.on('data', (data) => {
            this.handleMessage(data, 'webrtc');
          });

          conn.on('error', () => {
            // Handled safely
          });

          conn.on('close', () => {
            this.peerConnections.delete(conn.peer);
            this.callbacks.onControllerLeft?.(1);
          });
        });

        this.peer.on('error', () => {
          // Handled safely
        });
      } else {
        // Controller Role
        this.peer = new Peer({
          debug: 0,
        });

        this.peer.on('open', () => {
          if (this.disposed) return;
          this.connectToDisplayPeer(cleanRoom);
        });

        this.peer.on('error', () => {
          // Retry connecting after 3s if not already connected
          setTimeout(() => {
            if (!this.disposed && !this.isConnected) {
              this.connectToDisplayPeer(cleanRoom);
            }
          }, 3000);
        });
      }
    } catch {
      // WebRTC initialization error fallback
    }
  }

  private connectToDisplayPeer(cleanRoom: string) {
    if (!this.peer || this.peer.destroyed || this.disposed) return;
    try {
      const targetPeerId = `castpad-${cleanRoom}-screen`;
      const conn = this.peer.connect(targetPeerId);
      if (!conn) return;
      this.controllerPeerConn = conn;

      conn.on('open', () => {
        if (this.disposed) return;
        this.isConnected = true;
        this.transport = 'webrtc';
        this.callbacks.onConnected?.({ role: 'controller', mode: 'webrtc', playerId: this.playerId });
      });

      conn.on('data', (data) => {
        this.handleMessage(data, 'webrtc');
      });

      conn.on('error', () => {
        // Handled safely
      });

      conn.on('close', () => {
        if (this.transport === 'webrtc') {
          this.isConnected = false;
          this.transport = 'none';
          this.callbacks.onDisconnected?.();
        }
      });
    } catch {
      // Handled safely
    }
  }

  // Handle incoming message across any transport
  private handleMessage(data: unknown, source: 'websocket' | 'webrtc' | 'broadcast') {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;

    if (msg.type === 'registered') {
      this.isConnected = true;
      if (typeof msg.playerId === 'number') this.playerId = msg.playerId;
      this.callbacks.onConnected?.({ role: this.role, mode: source, playerId: this.playerId });
    } else if (msg.type === 'controller_joined') {
      const pid = typeof msg.playerId === 'number' ? msg.playerId : 1;
      this.callbacks.onControllerJoined?.(pid);
    } else if (msg.type === 'controller_left') {
      const pid = typeof msg.playerId === 'number' ? msg.playerId : 1;
      this.callbacks.onControllerLeft?.(pid);
    } else if (msg.type === 'input') {
      const payload = msg.payload as GameInput;
      const pid = typeof msg.playerId === 'number' ? msg.playerId : 1;
      if (payload) this.callbacks.onInput?.(payload, pid);
    } else if (msg.type === 'controller_input') {
      const payload = msg.payload as GameInput;
      if (payload) this.callbacks.onInput?.(payload, this.playerId);
    } else if (msg.type === 'game_changed') {
      const gameId = msg.gameId as RetroGameId;
      if (gameId) this.callbacks.onGameChanged?.(gameId);
    } else if (msg.type === 'haptic_event') {
      this.callbacks.onHapticEvent?.({
        pattern: (msg.pattern as number[]) || [50],
        health: typeof msg.health === 'number' ? msg.health : undefined,
        shield: typeof msg.shield === 'number' ? msg.shield : undefined,
        score: typeof msg.score === 'number' ? msg.score : undefined,
      });
    } else if (msg.type === 'pong') {
      if (typeof msg.clientTimestamp === 'number') {
        const rtt = Date.now() - msg.clientTimestamp;
        this.callbacks.onPing?.(Math.max(4, rtt));
      }
    }
  }

  // Send Controller Input
  public sendInput(input: GameInput) {
    const payload = {
      type: 'input',
      playerId: this.playerId,
      payload: input,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel (instant for local tabs)
    try {
      this.broadcastChannel?.postMessage(payload);
    } catch { /* ignore */ }

    // 2. WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'controller_input',
        payload: input,
        timestamp: Date.now(),
      }));
    }

    // 3. WebRTC DataConnection
    if (this.controllerPeerConn && this.controllerPeerConn.open) {
      this.controllerPeerConn.send(payload);
    }
  }

  // Send Game Change
  public sendGameChange(gameId: RetroGameId) {
    const payload = { type: 'game_changed', gameId };

    try {
      this.broadcastChannel?.postMessage(payload);
    } catch { /* ignore */ }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'change_game', gameId }));
    }

    if (this.role === 'display') {
      for (const conn of this.peerConnections.values()) {
        if (conn.open) conn.send(payload);
      }
    } else if (this.controllerPeerConn && this.controllerPeerConn.open) {
      this.controllerPeerConn.send(payload);
    }
  }

  // Send Haptic Feedback from Display to Controller
  public sendHapticFeedback(pattern: number[], health?: number, shield?: number, score?: number, targetPlayerId = 1) {
    const payload = {
      type: 'haptic_event',
      targetPlayerId,
      pattern,
      health,
      shield,
      score,
    };

    try {
      this.broadcastChannel?.postMessage(payload);
    } catch { /* ignore */ }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'rumble_feedback',
        targetPlayerId,
        pattern,
        health,
        shield,
        score,
      }));
    }

    for (const conn of this.peerConnections.values()) {
      if (conn.open) conn.send(payload);
    }
  }

  private startPingLoop() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', clientTimestamp: Date.now() }));
      }
    }, 2500);
  }

  public dispose() {
    this.disposed = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
    }
    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch { /* ignore */ }
    }
  }
}
