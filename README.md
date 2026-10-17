# CastPad: Dual-Screen Big Screen & Phone Gamepad

Play retro arcade games casted to your **Projector / TV**, while your **Smartphone** displays **NO game graphics**, only dedicated tactile gamepad controls (virtual flight sticks, 4-way cross D-pad, steering wheel, triggers, haptics, and gyro tilt steering)!

---

## 🎮 Included 6 Retro Arcade Games

1. **Void Horizon (1989)** - 360° space combat shooter *(Analog Flight Stick + 4 Action Triggers)*
2. **Cyber Snake (1982)** - Neon lightcycle arena *(4-Way Cross D-Pad + Turbo Nitro + Brake)*
3. **Galactic Invaders (1978)** - Earth defense swarm shooter *(Strafe Buttons + Rapid-Fire Cannon Trigger)*
4. **Neon Pong (1972)** - Hyper paddle duel *(Paddle Elevation Slider / Tilt + Hyper Smash Curve)*
5. **Turbo Highway (1986)** - High-speed 280 MPH pixel circuit *(Steering Wheel / Gyro + Gas/Brake Pedals + NOS)*
6. **Vector Asteroids (1980)** - Inertial vector space physics *(Turn Left/Right + Rocket Thrust + Laser + Warp)*

---

## 🚀 Running on GitHub & Deploying

### Option A: GitHub Pages (100% Free & Automatic)
This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) and **WebRTC Peer-to-Peer DataChannels** powered by PeerJS.
1. Push this repo to GitHub.
2. In your GitHub repository:
   - Go to **Settings** → **Pages**
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Push any commit to `main` (or run the workflow manually under Actions).
4. Your game will be live at `https://<your-username>.github.io/<your-repo>/`!
5. **How it connects on GitHub Pages:** Phones and projectors automatically establish a direct **WebRTC Peer-to-Peer DataChannel**, meaning it works globally across devices without requiring a Node.js backend server!

### Option B: Running Locally (Node.js)
```bash
# 1. Install dependencies
npm install

# 2. Start local server with WebSocket room relay
npm run dev

# 3. Open in browser:
# http://localhost:3000
```

### Option C: Full-Stack Deployment (Render, Railway, Docker, Cloud Run)
```bash
# Build production bundle
npm run build

# Start the full-stack server on port 3000
npm start
```

---

## 🛠 Project Structure

```
├── .github/workflows/deploy.yml  # Automatic GitHub Pages deployment
├── server.ts                     # Express + WebSocket room relay
├── vite.config.ts                # Vite config (base: './' for GitHub Pages)
├── src/
│   ├── network/
│   │   └── networkClient.ts      # Hybrid WebSocket + WebRTC P2P + BroadcastChannel
│   ├── game/
│   │   ├── types.ts              # Types & inputs
│   │   ├── retroGames.ts         # 6 Retro game definitions & cartridges
│   │   ├── retroRules.ts         # Decoupled physics (Snake, Pong, Invaders, Racer, Asteroids)
│   │   ├── retroRules.test.ts    # Unit test suite
│   │   ├── audio.ts              # Web Audio synthesizer for 8-bit arcade sounds
│   │   └── retroArcadeEngine.ts  # 60 FPS Canvas rendering engine
│   ├── components/
│   │   ├── ProjectorDisplay.tsx  # 16:9 Cinema Big Screen with QR code pairing
│   │   ├── PhoneController.tsx   # Morphing tactile smartphone gamepad
│   │   ├── DualScreenSimulator.tsx # Side-by-side split simulator
│   │   └── HowItWorksModal.tsx   # Projector setup instructions
│   └── App.tsx                   # Viewport router & game cartridge selector
```
