export type RetroGameId =
  | 'void_horizon'
  | 'cyber_snake'
  | 'galactic_invaders'
  | 'neon_pong'
  | 'turbo_racer'
  | 'vector_asteroids';

export interface RetroGameDef {
  id: RetroGameId;
  title: string;
  subtitle: string;
  year: string;
  genre: string;
  badge: string;
  accentColor: string;
  controllerType: 'flight_stick' | 'dpad_turbo' | 'invader_slider' | 'paddle_slider' | 'steering_wheel' | 'vector_controls';
  controlsSummary: string;
  description: string;
}

export const RETRO_GAMES: RetroGameDef[] = [
  {
    id: 'void_horizon',
    title: 'Void Horizon',
    subtitle: 'Space Combat Simulation',
    year: '1989',
    genre: 'Arcade Shooter',
    badge: '360° DOGFIGHT',
    accentColor: '#00f0ff',
    controllerType: 'flight_stick',
    controlsSummary: 'Analog Flight Stick · Auto-Blaster · Afterburner · Energy Shield · EMP Nova',
    description: 'High-speed space combat against dive-bombing drones, heavy battle-cruisers, asteroid belts, and mothership bosses.',
  },
  {
    id: 'cyber_snake',
    title: 'Cyber Snake',
    subtitle: 'Neon Lightcycle Grid',
    year: '1982',
    genre: 'Arcade Maze',
    badge: 'TACTILE D-PAD',
    accentColor: '#10b981',
    controllerType: 'dpad_turbo',
    controlsSummary: '4-Way Tactile D-Pad · Turbo Nitro · Instant Brake',
    description: 'Steer a glowing high-voltage light-snake through an infinite neon arena. Devour energy cores and avoid your growing tail!',
  },
  {
    id: 'galactic_invaders',
    title: 'Galactic Invaders',
    subtitle: 'Earth Defense Protocol',
    year: '1978',
    genre: 'Fixed Shooter',
    badge: 'DEFENSE CANNON',
    accentColor: '#f43f5e',
    controllerType: 'invader_slider',
    controlsSummary: 'Horizontal Steer Slider / D-Pad · Turbo Laser Cannon · Bunker Shield Repair',
    description: 'Marching alien swarms descend row by row! Take shelter behind destructible energy bunkers and shoot the mystery UFO.',
  },
  {
    id: 'neon_pong',
    title: 'Neon Pong',
    subtitle: 'Hyper Paddle Duel',
    year: '1972',
    genre: 'Paddle Sports',
    badge: 'PADDLE SLIDER',
    accentColor: '#eab308',
    controllerType: 'paddle_slider',
    controlsSummary: 'Precision Paddle Slider · Gyro Tilt · Hyper Smash · Spin Curve',
    description: 'Ultra-fast neon tennis duel against intelligent AI or split-screen challenger. Apply spin curves and smash spikes!',
  },
  {
    id: 'turbo_racer',
    title: 'Turbo Highway',
    subtitle: 'Pixel Speed Circuit',
    year: '1986',
    genre: 'Arcade Racer',
    badge: 'WHEEL & PEDALS',
    accentColor: '#f97316',
    controllerType: 'steering_wheel',
    controlsSummary: 'Racing Steering Wheel (or Gyro Steer!) · Gas Pedal · Disc Brake · Nitro NOS',
    description: 'Outrun highway traffic at 280 MPH with screeching drifts, speed traps, and full-throttle nitro boosts.',
  },
  {
    id: 'vector_asteroids',
    title: 'Vector Asteroids',
    subtitle: 'Inertial Deep Space 1980',
    year: '1980',
    genre: 'Vector Arcade',
    badge: 'INERTIAL ROTARY',
    accentColor: '#a855f7',
    controllerType: 'vector_controls',
    controlsSummary: 'Rotate Left/Right · Rocket Thruster · Vector Cannon · Hyperspace Teleport',
    description: 'Authentic vector-line physics with zero friction! Rotate, thrust, fragment massive space rocks, and hunt alien saucers.',
  },
];
