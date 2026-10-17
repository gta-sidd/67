import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

interface ClientInfo {
  ws: WebSocket;
  role: 'display' | 'controller';
  roomId: string;
  playerId?: number;
  lastPing: number;
}

interface Room {
  id: string;
  displayWs?: WebSocket;
  controllers: Map<number, WebSocket>;
  createdAt: number;
}

const rooms = new Map<string, Room>();
const clientMap = new WeakMap<WebSocket, ClientInfo>();

function getOrCreateRoom(roomId: string): Room {
  const normalizedId = roomId.toUpperCase().trim();
  let room = rooms.get(normalizedId);
  if (!room) {
    room = {
      id: normalizedId,
      controllers: new Map(),
      createdAt: Date.now(),
    };
    rooms.set(normalizedId, room);
  }
  return room;
}

wss.on('connection', (ws: WebSocket) => {
  const clientInfo: ClientInfo = {
    ws,
    role: 'display',
    roomId: '',
    lastPing: Date.now(),
  };
  clientMap.set(ws, clientInfo);

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'register_display') {
        const roomId = (msg.roomId || 'CAST1').toUpperCase().trim();
        const room = getOrCreateRoom(roomId);
        room.displayWs = ws;
        clientInfo.role = 'display';
        clientInfo.roomId = roomId;

        ws.send(JSON.stringify({
          type: 'registered',
          role: 'display',
          roomId,
          connectedControllers: Array.from(room.controllers.keys()),
        }));

        // Notify display of any existing controllers
        for (const [pid] of room.controllers.entries()) {
          ws.send(JSON.stringify({
            type: 'controller_joined',
            playerId: pid,
          }));
        }
      }

      else if (msg.type === 'register_controller') {
        const roomId = (msg.roomId || 'CAST1').toUpperCase().trim();
        const room = getOrCreateRoom(roomId);
        
        // Find next player ID (1, 2, etc.)
        let pid = 1;
        while (room.controllers.has(pid)) {
          pid++;
        }
        if (msg.requestedPlayerId && !room.controllers.has(msg.requestedPlayerId)) {
          pid = msg.requestedPlayerId;
        }

        room.controllers.set(pid, ws);
        clientInfo.role = 'controller';
        clientInfo.roomId = roomId;
        clientInfo.playerId = pid;

        ws.send(JSON.stringify({
          type: 'registered',
          role: 'controller',
          roomId,
          playerId: pid,
          displayConnected: !!room.displayWs && room.displayWs.readyState === WebSocket.OPEN,
        }));

        // Notify the projector display that a controller joined
        if (room.displayWs && room.displayWs.readyState === WebSocket.OPEN) {
          room.displayWs.send(JSON.stringify({
            type: 'controller_joined',
            playerId: pid,
          }));
        }
      }

      else if (msg.type === 'controller_input') {
        const room = rooms.get(clientInfo.roomId);
        if (room && room.displayWs && room.displayWs.readyState === WebSocket.OPEN) {
          room.displayWs.send(JSON.stringify({
            type: 'input',
            playerId: clientInfo.playerId || 1,
            payload: msg.payload,
            timestamp: msg.timestamp || Date.now(),
          }));
        }
      }

      else if (msg.type === 'rumble_feedback') {
        // Display sends rumble or health update back to the controller
        const room = rooms.get(clientInfo.roomId);
        if (room) {
          const targetWs = room.controllers.get(msg.targetPlayerId || 1);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'haptic_event',
              pattern: msg.pattern,
              health: msg.health,
              shield: msg.shield,
              score: msg.score,
            }));
          }
        }
      }

      else if (msg.type === 'change_game') {
        const room = rooms.get(clientInfo.roomId);
        if (room) {
          if (room.displayWs && room.displayWs.readyState === WebSocket.OPEN) {
            room.displayWs.send(JSON.stringify({
              type: 'game_changed',
              gameId: msg.gameId,
            }));
          }
          for (const ctrlWs of room.controllers.values()) {
            if (ctrlWs.readyState === WebSocket.OPEN) {
              ctrlWs.send(JSON.stringify({
                type: 'game_changed',
                gameId: msg.gameId,
              }));
            }
          }
        }
      }

      else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', clientTimestamp: msg.clientTimestamp }));
      }
    } catch {
      // Ignore malformed payloads
    }
  });

  ws.on('close', () => {
    const info = clientMap.get(ws);
    if (!info) return;

    const room = rooms.get(info.roomId);
    if (!room) return;

    if (info.role === 'display' && room.displayWs === ws) {
      delete room.displayWs;
      // Notify controllers that display disconnected
      for (const ctrlWs of room.controllers.values()) {
        if (ctrlWs.readyState === WebSocket.OPEN) {
          ctrlWs.send(JSON.stringify({ type: 'display_disconnected' }));
        }
      }
    } else if (info.role === 'controller' && info.playerId) {
      room.controllers.delete(info.playerId);
      if (room.displayWs && room.displayWs.readyState === WebSocket.OPEN) {
        room.displayWs.send(JSON.stringify({
          type: 'controller_left',
          playerId: info.playerId,
        }));
      }
    }

    // Clean up empty rooms after 10 minutes
    if (!room.displayWs && room.controllers.size === 0) {
      setTimeout(() => {
        const current = rooms.get(room.id);
        if (current && !current.displayWs && current.controllers.size === 0) {
          rooms.delete(room.id);
        }
      }, 600000);
    }
  });
});

// Setup Vite or static serving
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`CastPad server running on port ${PORT} [production=${isProduction}]`);
  });
}

startServer();
