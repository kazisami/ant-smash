/**
 * Core Ant Simulation & Math Logic.
 * Decoupled from React DOM for fast 60fps canvas performance and deterministic unit testing.
 */

export type AntType = 'standard' | 'speedy' | 'big' | 'golden' | 'leaf';

export interface Ant {
  id: string;
  type: AntType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // in radians
  speed: number;
  size: number;
  hitRadius: number;
  legPhase: number;
  wobbleOffset: number;
  wobbleSpeed: number;
  health: number; // usually 1, big ant can take 2 squashes or 1 big satisfying crunch
  maxHealth: number;
  color: string;
  accentColor: string;
  target?: { x: number; y: number };
  hasCrumb?: boolean;
}

export interface Splat {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  droplets: Array<{ dx: number; dy: number; r: number }>;
  createdAt: number;
  type: AntType;
}

export interface StarParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  size: number;
  color: string;
  alpha: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  createdAt: number;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

export const ANT_CONFIGS: Record<AntType, {
  baseSpeed: number;
  size: number;
  hitRadius: number;
  color: string;
  accentColor: string;
  points: number;
  name: string;
}> = {
  standard: {
    baseSpeed: 75,
    size: 26,
    hitRadius: 46, // Generous hitbox for tiny toddler fingers!
    color: '#38220f',
    accentColor: '#5c391a',
    points: 1,
    name: 'Garden Ant',
  },
  speedy: {
    baseSpeed: 135,
    size: 22,
    hitRadius: 42,
    color: '#dc2626',
    accentColor: '#f87171',
    points: 2,
    name: 'Sugar Rusher',
  },
  big: {
    baseSpeed: 45,
    size: 40,
    hitRadius: 65, // Extra generous for big ant
    color: '#1c1917',
    accentColor: '#44403c',
    points: 3,
    name: 'Chonky Ant',
  },
  golden: {
    baseSpeed: 90,
    size: 28,
    hitRadius: 50,
    color: '#eab308',
    accentColor: '#fef08a',
    points: 5,
    name: 'Golden Shimmer',
  },
  leaf: {
    baseSpeed: 60,
    size: 30,
    hitRadius: 52,
    color: '#292524',
    accentColor: '#22c55e',
    points: 2,
    name: 'Snack Scout',
  },
};

export const SPLAT_PALETTES = {
  jelly: ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'],
  cartoon: ['#451a03', '#78350f', '#065f46', '#831843'],
  berry: ['#e11d48', '#be123c', '#9f1239', '#881337', '#fb7185'],
};

/**
 * Pure check whether a tap point hits an ant with given hit tolerance.
 */
export function isPointInHitbox(
  px: number,
  py: number,
  antX: number,
  antY: number,
  hitRadius: number
): boolean {
  const dx = px - antX;
  const dy = py - antY;
  return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
}

/**
 * Advance ant position by delta time with gentle sinusoidal crawling wobble.
 */
export function stepAnt(ant: Ant, dt: number): Ant {
  const clampedDt = Math.min(dt, 0.05);
  let angle = ant.angle;

  // If ant has a specific target (e.g. Picnic center treat)
  if (ant.target) {
    const dx = ant.target.x - ant.x;
    const dy = ant.target.y - ant.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    if (distToTarget > 10) {
      angle = Math.atan2(dy, dx);
    }
  }

  // Wiggle angle slightly for organic bug scuttling
  const wobble = Math.sin(ant.wobbleOffset) * 0.25;
  const moveAngle = angle + wobble;

  const vx = Math.cos(moveAngle) * ant.speed;
  const vy = Math.sin(moveAngle) * ant.speed;

  return {
    ...ant,
    x: ant.x + vx * clampedDt,
    y: ant.y + vy * clampedDt,
    vx,
    vy,
    angle,
    wobbleOffset: ant.wobbleOffset + ant.wobbleSpeed * clampedDt,
    legPhase: ant.legPhase + ant.speed * clampedDt * 0.2,
  };
}

/**
 * Check if ant has wandered way beyond the viewport.
 */
export function isAntOutOfBounds(ant: Ant, bounds: ViewportBounds, margin = 120): boolean {
  return (
    ant.x < -margin ||
    ant.x > bounds.width + margin ||
    ant.y < -margin ||
    ant.y > bounds.height + margin
  );
}

/**
 * Spawns an ant from outside the screen edges crawling inward.
 */
export function spawnAnt(
  bounds: ViewportBounds,
  forcedType?: AntType,
  speedMultiplier = 1.0,
  target?: { x: number; y: number }
): Ant {
  // Randomly choose ant type if not forced
  let type: AntType = forcedType || 'standard';
  if (!forcedType) {
    const roll = Math.random();
    if (roll < 0.55) {
      type = 'standard';
    } else if (roll < 0.72) {
      type = 'speedy';
    } else if (roll < 0.85) {
      type = 'leaf';
    } else if (roll < 0.94) {
      type = 'big';
    } else {
      type = 'golden';
    }
  }

  const config = ANT_CONFIGS[type];
  const margin = 50;

  // Random side: 0=top, 1=right, 2=bottom, 3=left
  const side = Math.floor(Math.random() * 4);
  let startX = 0;
  let startY = 0;
  let destX = 0;
  let destY = 0;

  const w = Math.max(bounds.width, 320);
  const h = Math.max(bounds.height, 480);

  switch (side) {
    case 0: // Top
      startX = Math.random() * w;
      startY = -margin;
      destX = Math.random() * w;
      destY = h + margin;
      break;
    case 1: // Right
      startX = w + margin;
      startY = Math.random() * h;
      destX = -margin;
      destY = Math.random() * h;
      break;
    case 2: // Bottom
      startX = Math.random() * w;
      startY = h + margin;
      destX = Math.random() * w;
      destY = -margin;
      break;
    case 3: // Left
    default:
      startX = -margin;
      startY = Math.random() * h;
      destX = w + margin;
      destY = Math.random() * h;
      break;
  }

  if (target) {
    destX = target.x + (Math.random() * 60 - 30);
    destY = target.y + (Math.random() * 60 - 30);
  }

  const angle = Math.atan2(destY - startY, destX - startX);
  const speed = config.baseSpeed * (0.85 + Math.random() * 0.3) * speedMultiplier;

  return {
    id: `ant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    speed,
    size: config.size,
    hitRadius: config.hitRadius,
    legPhase: Math.random() * 10,
    wobbleOffset: Math.random() * Math.PI * 2,
    wobbleSpeed: 4 + Math.random() * 4,
    health: 1,
    maxHealth: 1,
    color: config.color,
    accentColor: config.accentColor,
    target: target ? { x: destX, y: destY } : undefined,
    hasCrumb: type === 'leaf',
  };
}

/**
 * Creates random organic splat droplets for juicy cartoon squish visuals.
 */
export function createSplat(ant: Ant, theme: keyof typeof SPLAT_PALETTES = 'jelly'): Splat {
  const palette = SPLAT_PALETTES[theme] || SPLAT_PALETTES.jelly;
  let color = palette[Math.floor(Math.random() * palette.length)];

  if (ant.type === 'golden') {
    color = '#f59e0b';
  } else if (ant.type === 'speedy') {
    color = '#ef4444';
  } else if (ant.type === 'leaf') {
    color = '#22c55e';
  }

  const dropletCount = 6 + Math.floor(Math.random() * 6);
  const droplets: Array<{ dx: number; dy: number; r: number }> = [];

  for (let i = 0; i < dropletCount; i++) {
    const angle = (Math.PI * 2 * i) / dropletCount + (Math.random() * 0.4 - 0.2);
    const dist = (ant.size * 0.7) + Math.random() * (ant.size * 0.9);
    droplets.push({
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      r: (ant.size * 0.12) + Math.random() * (ant.size * 0.2),
    });
  }

  return {
    id: `splat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    x: ant.x,
    y: ant.y,
    size: ant.size * 1.5,
    color,
    droplets,
    createdAt: Date.now(),
    type: ant.type,
  };
}

/**
 * Spawn celebratory stars and sparkles when an ant is squashed.
 */
export function createBurstParticles(x: number, y: number, count = 10, mainColor = '#f59e0b'): StarParticle[] {
  const particles: StarParticle[] = [];
  const colors = [mainColor, '#ec4899', '#3b82f6', '#10b981', '#facc15', '#a855f7'];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 180;
    particles.push({
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 8,
      size: 10 + Math.random() * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1.0,
    });
  }

  return particles;
}

/**
 * Milestone detector for toddler celebration (e.g. 5, 10, 20, 30, 50, 100 ants squashed!)
 */
export function checkMilestone(previousCount: number, newCount: number): string | null {
  const milestones = [
    { count: 5, cheer: 'High Five! ✋' },
    { count: 10, cheer: 'Super Squasher! ⭐' },
    { count: 20, cheer: 'Ant Champion! 🏆' },
    { count: 35, cheer: 'Magnificent! 🌟' },
    { count: 50, cheer: 'Fifty Ants! Wow! 🎈' },
    { count: 75, cheer: 'Unstoppable! 🚀' },
    { count: 100, cheer: '100 Ants! Mega Hero! 👑' },
  ];

  for (const m of milestones) {
    if (previousCount < m.count && newCount >= m.count) {
      return m.cheer;
    }
  }

  // Periodic celebration every 25 ants after 100
  if (newCount > 100 && Math.floor(newCount / 25) > Math.floor(previousCount / 25)) {
    return `${newCount} Ants! Fantastic! 🎉`;
  }

  return null;
}
