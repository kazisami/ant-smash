import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Ant,
  Splat,
  StarParticle,
  FloatingText,
  spawnAnt,
  stepAnt,
  isAntOutOfBounds,
  isPointInHitbox,
  createSplat,
  createBurstParticles,
  checkMilestone,
  SPLAT_PALETTES,
} from '../game/antEngine';
import { sound } from '../game/sound';
import { Volume2, VolumeX, Sparkles, Eraser, Settings, Trophy, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

export interface GameSettings {
  speed: 'gentle' | 'normal' | 'fast';
  spawnRate: 'relaxed' | 'normal' | 'swarm';
  palette: 'jelly' | 'berry' | 'cartoon';
  mode: 'free' | 'picnic';
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  speed: 'normal',
  spawnRate: 'normal',
  palette: 'jelly',
  mode: 'free',
  soundEnabled: true,
};

export const AntCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High frequency simulation state stored in refs for 60fps zero-lag performance
  const antsRef = useRef<Ant[]>([]);
  const splatsRef = useRef<Splat[]>([]);
  const particlesRef = useRef<StarParticle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const scoreRef = useRef<number>(0);
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const lastSpawnTimeRef = useRef<number>(0);
  const consecutiveStreakRef = useRef<number>(0);
  const lastSquashTimeRef = useRef<number>(0);
  const picnicTreatRef = useRef<{ x: number; y: number; health: number; maxHealth: number }>({
    x: 0,
    y: 0,
    health: 5,
    maxHealth: 5,
  });

  // UI State for Toddler/Parent HUD
  const [score, setScore] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(sound.getMuted());
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [tableCleanPulse, setTableCleanPulse] = useState<boolean>(false);

  // Sync settings ref
  useEffect(() => {
    settingsRef.current = gameSettings;
  }, [gameSettings]);

  // Speed multiplier derived from settings
  const getSpeedMultiplier = useCallback(() => {
    switch (settingsRef.current.speed) {
      case 'gentle': return 0.65;
      case 'fast': return 1.35;
      case 'normal':
      default: return 1.0;
    }
  }, []);

  // Spawn interval derived from settings
  const getSpawnInterval = useCallback(() => {
    switch (settingsRef.current.spawnRate) {
      case 'relaxed': return 1400;
      case 'swarm': return 500;
      case 'normal':
      default: return 900;
    }
  }, []);

  // Squash Handler: checks hit detection and spawns juice
  const handleSquashAt = useCallback((x: number, y: number) => {
    const currentAnts = antsRef.current;
    let hitAny = false;
    const remainingAnts: Ant[] = [];

    const now = Date.now();
    // Calculate combo streak
    if (now - lastSquashTimeRef.current < 1500) {
      consecutiveStreakRef.current += 1;
    } else {
      consecutiveStreakRef.current = 1;
    }
    lastSquashTimeRef.current = now;

    for (const ant of currentAnts) {
      if (isPointInHitbox(x, y, ant.x, ant.y, ant.hitRadius)) {
        hitAny = true;
        // Sound and Haptic Feedback
        sound.playSquish(ant.type);

        // Splat graphics
        const splat = createSplat(ant, settingsRef.current.palette);
        splatsRef.current.push(splat);

        // Particle Burst
        const burst = createBurstParticles(ant.x, ant.y, ant.type === 'big' ? 18 : 10, splat.color);
        particlesRef.current.push(...burst);

        // Score Calculation
        const antScore = ant.type === 'golden' ? 5 : ant.type === 'big' ? 3 : 1;
        const prevScore = scoreRef.current;
        const newScore = prevScore + antScore;
        scoreRef.current = newScore;
        setScore(newScore);

        // Floating Text
        floatingTextsRef.current.push({
          id: `ft-${now}-${Math.random()}`,
          x: ant.x,
          y: ant.y - 20,
          text: ant.type === 'golden' ? '+5 Super!' : ant.type === 'big' ? '+3 Chonk!' : `+${antScore}`,
          color: splat.color,
          alpha: 1.0,
          createdAt: now,
        });

        // Milestone Celebration Check
        const cheer = checkMilestone(prevScore, newScore);
        if (cheer) {
          sound.playCelebration();
          setMilestoneBanner(cheer);
          setTimeout(() => setMilestoneBanner(null), 2500);
          // Big celebratory star burst around center
          if (canvasRef.current) {
            const cx = canvasRef.current.width / 2;
            const cy = canvasRef.current.height / 2;
            particlesRef.current.push(...createBurstParticles(cx, cy, 25, '#f59e0b'));
          }
        }
      } else {
        remainingAnts.push(ant);
      }
    }

    if (hitAny) {
      antsRef.current = remainingAnts;
    }
  }, []);

  const isPointerDownRef = useRef<boolean>(false);

  // Pointer event handlers for unified touch, mouse, and stylus support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = true;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handleSquashAt(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handleSquashAt(x, y);
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
  };

  // Expose helper on window for deterministic testing and inspection
  useEffect(() => {
    (window as unknown as { __game?: { getAnts: () => Ant[]; getScore: () => number; squash: (x: number, y: number) => void } }).__game = {
      getAnts: () => antsRef.current,
      getScore: () => scoreRef.current,
      squash: (x: number, y: number) => handleSquashAt(x, y),
    };
  }, [handleSquashAt]);

  // Clean the Table (Wipe with Sponge)
  const clearSplats = () => {
    sound.playWipe();
    setTableCleanPulse(true);
    setTimeout(() => setTableCleanPulse(false), 300);
    splatsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
  };

  // Toggle Sound
  const toggleMute = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) {
      sound.playBoing();
    }
  };

  // Main 60 FPS Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    // Auto-resize canvas to fill viewport cleanly with devicePixelRatio
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Center picnic treat
      picnicTreatRef.current.x = w / 2;
      picnicTreatRef.current.y = h / 2;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initial warm up ants so the toddler sees bugs right away!
    const bounds = { width: window.innerWidth, height: window.innerHeight };
    for (let i = 0; i < 4; i++) {
      const initialAnt = spawnAnt(bounds, undefined, getSpeedMultiplier());
      // place them partially on-screen so action starts instantly
      initialAnt.x = Math.random() * (bounds.width - 100) + 50;
      initialAnt.y = Math.random() * (bounds.height - 100) + 50;
      antsRef.current.push(initialAnt);
    }

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = currentTime;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const bounds = { width, height };

      // 1. Spawning Logic
      const now = Date.now();
      const spawnInterval = getSpawnInterval();
      const maxAnts = settingsRef.current.spawnRate === 'swarm' ? 18 : 10;

      if (now - lastSpawnTimeRef.current > spawnInterval && antsRef.current.length < maxAnts) {
        lastSpawnTimeRef.current = now;
        const target = settingsRef.current.mode === 'picnic'
          ? { x: picnicTreatRef.current.x, y: picnicTreatRef.current.y }
          : undefined;
        antsRef.current.push(spawnAnt(bounds, undefined, getSpeedMultiplier(), target));
      }

      // 2. Physics & Ant Movement Step
      const updatedAnts: Ant[] = [];
      for (const ant of antsRef.current) {
        const nextAnt = stepAnt(ant, dt);

        // In picnic mode, if ant reaches the treat, it nibbles happily
        if (settingsRef.current.mode === 'picnic') {
          const dx = nextAnt.x - picnicTreatRef.current.x;
          const dy = nextAnt.y - picnicTreatRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 45) {
            // Nibble: ant grabs a crumb and heads back out
            nextAnt.target = {
              x: nextAnt.x + (dx > 0 ? 400 : -400),
              y: nextAnt.y + (dy > 0 ? 400 : -400),
            };
            nextAnt.hasCrumb = true;
          }
        }

        if (!isAntOutOfBounds(nextAnt, bounds)) {
          updatedAnts.push(nextAnt);
        }
      }
      antsRef.current = updatedAnts;

      // 3. Update Splats (slowly fade after 14s)
      const validSplats: Splat[] = [];
      for (const s of splatsRef.current) {
        if (now - s.createdAt < 14000) {
          validSplats.push(s);
        }
      }
      splatsRef.current = validSplats;

      // 4. Update Particle Bursts
      const activeParticles: StarParticle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vRot * dt;
        p.alpha -= dt * 1.5;
        p.vy += 80 * dt; // gentle gravity
        if (p.alpha > 0) {
          activeParticles.push(p);
        }
      }
      particlesRef.current = activeParticles;

      // 5. Update Floating Texts
      const activeTexts: FloatingText[] = [];
      for (const ft of floatingTextsRef.current) {
        ft.y -= dt * 45;
        ft.alpha -= dt * 1.2;
        if (ft.alpha > 0) {
          activeTexts.push(ft);
        }
      }
      floatingTextsRef.current = activeTexts;

      // ---------------- RENDER PASS ----------------
      // Pure clean white background as requested
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Subtle light kitchen/picnic dots to give subtle depth to the white surface
      ctx.fillStyle = '#f1f5f9';
      const dotSpacing = 48;
      for (let px = 24; px < width; px += dotSpacing) {
        for (let py = 24; py < height; py += dotSpacing) {
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Picnic Treat (if picnic mode active)
      if (settingsRef.current.mode === 'picnic') {
        const tx = picnicTreatRef.current.x;
        const ty = picnicTreatRef.current.y;
        ctx.save();
        ctx.translate(tx, ty);

        // Soft plate shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.beginPath();
        ctx.arc(0, 10, 52, 0, Math.PI * 2);
        ctx.fill();

        // White ceramic plate with cute rim
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Strawberry cake slice or watermelon slice
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(26, 22);
        ctx.lineTo(-26, 22);
        ctx.closePath();
        ctx.fill();

        // Frosting & Strawberry top
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-22, 14, 44, 8);
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(0, -24, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Splats
      for (const s of splatsRef.current) {
        const age = now - s.createdAt;
        const fadeAlpha = age > 9000 ? Math.max(0, 1 - (age - 9000) / 5000) : 1;

        ctx.save();
        ctx.globalAlpha = fadeAlpha * 0.92;
        ctx.fillStyle = s.color;

        // Central organic splat blob
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Outer droplets
        for (const drop of s.droplets) {
          ctx.beginPath();
          ctx.arc(s.x + drop.dx, s.y + drop.dy, drop.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cute little cartoon X_X squashed eyes in the splat center
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        // Left eye
        ctx.beginPath();
        ctx.moveTo(s.x - 7, s.y - 7);
        ctx.lineTo(s.x - 1, s.y - 1);
        ctx.moveTo(s.x - 1, s.y - 7);
        ctx.lineTo(s.x - 7, s.y - 1);
        ctx.stroke();
        // Right eye
        ctx.beginPath();
        ctx.moveTo(s.x + 1, s.y - 7);
        ctx.lineTo(s.x + 7, s.y - 1);
        ctx.moveTo(s.x + 7, s.y - 7);
        ctx.lineTo(s.x + 1, s.y - 1);
        ctx.stroke();

        ctx.restore();
      }

      // Draw Crawling Ants
      for (const ant of antsRef.current) {
        ctx.save();
        ctx.translate(ant.x, ant.y);
        ctx.rotate(ant.angle + Math.PI / 2); // Rotate so head faces forward

        // Ant Shadow for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        ctx.ellipse(3, 4, ant.size * 0.4, ant.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Six wriggling animated legs
        ctx.strokeStyle = ant.color;
        ctx.lineWidth = Math.max(2.5, ant.size * 0.09);
        ctx.lineCap = 'round';

        const legWiggle = Math.sin(ant.legPhase);
        const legOffsets = [-0.25, 0, 0.28];

        for (let i = 0; i < 3; i++) {
          const yPos = legOffsets[i] * ant.size;
          const phaseOffset = i * 1.2;
          const leftWiggle = Math.sin(ant.legPhase + phaseOffset) * 6;
          const rightWiggle = Math.cos(ant.legPhase + phaseOffset) * 6;

          // Left leg
          ctx.beginPath();
          ctx.moveTo(-ant.size * 0.2, yPos);
          ctx.quadraticCurveTo(
            -ant.size * 0.65,
            yPos - 4 + leftWiggle,
            -ant.size * 0.85,
            yPos + (i === 0 ? -10 : i === 1 ? 2 : 12) + leftWiggle
          );
          ctx.stroke();

          // Right leg
          ctx.beginPath();
          ctx.moveTo(ant.size * 0.2, yPos);
          ctx.quadraticCurveTo(
            ant.size * 0.65,
            yPos - 4 + rightWiggle,
            ant.size * 0.85,
            yPos + (i === 0 ? -10 : i === 1 ? 2 : 12) + rightWiggle
          );
          ctx.stroke();
        }

        // Abdomen (rear segment)
        ctx.fillStyle = ant.color;
        ctx.beginPath();
        ctx.ellipse(0, ant.size * 0.42, ant.size * 0.35, ant.size * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();

        // Thorax (middle segment)
        ctx.beginPath();
        ctx.ellipse(0, 0, ant.size * 0.24, ant.size * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head (front segment)
        ctx.beginPath();
        ctx.ellipse(0, -ant.size * 0.38, ant.size * 0.28, ant.size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Antennas with cute round tips
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -ant.size * 0.48);
        ctx.quadraticCurveTo(-12, -ant.size * 0.72, -16 + legWiggle * 2, -ant.size * 0.82);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(4, -ant.size * 0.48);
        ctx.quadraticCurveTo(12, -ant.size * 0.72, 16 - legWiggle * 2, -ant.size * 0.82);
        ctx.stroke();

        // Antenna tip bulbs
        ctx.fillStyle = ant.accentColor;
        ctx.beginPath();
        ctx.arc(-16 + legWiggle * 2, -ant.size * 0.82, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16 - legWiggle * 2, -ant.size * 0.82, 3, 0, Math.PI * 2);
        ctx.fill();

        // Big friendly cartoon eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5, -ant.size * 0.42, ant.size * 0.11, 0, Math.PI * 2);
        ctx.arc(5, -ant.size * 0.42, ant.size * 0.11, 0, Math.PI * 2);
        ctx.fill();

        // Eye pupils looking forward
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(-5, -ant.size * 0.44, ant.size * 0.06, 0, Math.PI * 2);
        ctx.arc(5, -ant.size * 0.44, ant.size * 0.06, 0, Math.PI * 2);
        ctx.fill();

        // Leaf / Crumb item on back
        if (ant.hasCrumb) {
          ctx.fillStyle = ant.accentColor;
          ctx.beginPath();
          ctx.arc(0, ant.size * 0.35, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw Star Particles
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        // Draw cute 5-point star
        ctx.beginPath();
        const spikes = 5;
        const outer = p.size;
        const inner = p.size * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (i * Math.PI) / spikes;
          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw Floating Texts
      for (const ft of floatingTextsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x - 20, ft.y);
        ctx.fillText(ft.text, ft.x - 20, ft.y);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [getSpeedMultiplier, getSpawnInterval]);

  return (
    <main
      className="relative w-full h-full select-none touch-none overflow-hidden bg-white"
      role="main"
      aria-label="Ant Squasher Game"
    >
      {/* 60 FPS HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="ant-game-canvas"
        className="w-full h-full block cursor-pointer select-none touch-none bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Persistent Toddler-Friendly HUD */}
      <header className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between pointer-events-none z-30">
        {/* Left: Star Score Badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 bg-amber-400 text-amber-950 font-black text-xl sm:text-2xl px-4 py-2 rounded-3xl shadow-lg border-3 border-amber-300 transform active:scale-95 transition-transform">
            <span className="text-2xl sm:text-3xl animate-bounce">⭐</span>
            <span className="tabular-nums font-black">{score}</span>
            <span className="text-xs uppercase tracking-wider text-amber-900 font-bold ml-1">Squashed</span>
          </div>

          {/* Clean table button (Wipe / Sponge) */}
          <button
            onClick={clearSplats}
            className={`p-2.5 sm:p-3 rounded-2xl bg-sky-100 hover:bg-sky-200 active:scale-90 text-sky-800 shadow-md border-2 border-sky-300 transition-all cursor-pointer flex items-center gap-1.5 ${
              tableCleanPulse ? 'scale-110 bg-sky-300' : ''
            }`}
            title="Clean Table"
            aria-label="Clean the table"
          >
            <Eraser className="w-5 h-5 text-sky-700" />
            <span className="text-xs font-bold hidden sm:inline">Wipe</span>
          </button>
        </div>

        {/* Right: Quick actions & Install Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <PWAInstallButton compact={true} />

          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            className="p-2.5 sm:p-3 rounded-2xl bg-white/95 hover:bg-slate-100 active:scale-90 text-slate-700 shadow-md border-2 border-slate-200 transition-all cursor-pointer"
            aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-red-500" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-600" />
            )}
          </button>

          {/* Parent Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 sm:p-3 rounded-2xl bg-white/95 hover:bg-slate-100 active:scale-90 text-slate-700 shadow-md border-2 border-slate-200 transition-all cursor-pointer"
            aria-label="Game Settings"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-amber-600" />
          </button>
        </div>
      </header>

      {/* Celebratory Milestone Banner */}
      {milestoneBanner && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-40 animate-pop-bounce">
          <div className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-500 text-white font-black text-2xl sm:text-3xl px-6 py-3 rounded-full shadow-2xl border-4 border-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-yellow-200 animate-spin" />
            <span>{milestoneBanner}</span>
            <Sparkles className="w-7 h-7 text-yellow-200 animate-spin" />
          </div>
        </div>
      )}

      {/* Bottom Hint for Toddlers */}
      <footer className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none text-center z-20">
        <div className="bg-white/80 backdrop-blur-xs px-4 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs sm:text-sm font-bold text-slate-600">
          Tap or swipe the ants with your fingers! 👆🐜
        </div>
      </footer>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Parent Settings / Controls Modal */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Parent and Game Settings"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border-4 border-amber-300 relative text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <h2 className="text-xl font-black text-slate-900">Game Settings</h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4 text-sm font-semibold">
              {/* Ant Speed */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-bold">
                  Ant Speed
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gentle', 'normal', 'fast'] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setGameSettings((s) => ({ ...s, speed: spd }))}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold capitalize transition-all border-2 cursor-pointer ${
                        gameSettings.speed === spd
                          ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {spd === 'gentle' ? '🐢 Slow (Toddler)' : spd === 'normal' ? '🚶 Normal' : '⚡ Speedy'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ant Crowd Count */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-bold">
                  Ant Numbers
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['relaxed', 'normal', 'swarm'] as const).map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setGameSettings((s) => ({ ...s, spawnRate: rate }))}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold capitalize transition-all border-2 cursor-pointer ${
                        gameSettings.spawnRate === rate
                          ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {rate === 'relaxed' ? '🌱 A Few' : rate === 'normal' ? '🐜 Steady' : '🎉 Ant Party!'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Splat Colors */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-bold">
                  Splat Colors
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['jelly', 'berry', 'cartoon'] as const).map((pal) => (
                    <button
                      key={pal}
                      onClick={() => setGameSettings((s) => ({ ...s, palette: pal }))}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold capitalize transition-all border-2 cursor-pointer ${
                        gameSettings.palette === pal
                          ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pal === 'jelly' ? '🌈 Jelly Colors' : pal === 'berry' ? '🍓 Berry Red' : '🎨 Cartoon'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Game Mode */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-bold">
                  Game Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGameSettings((s) => ({ ...s, mode: 'free' }))}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border-2 cursor-pointer ${
                      gameSettings.mode === 'free'
                        ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚪ White Table (Free Play)
                  </button>
                  <button
                    onClick={() => setGameSettings((s) => ({ ...s, mode: 'picnic' }))}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border-2 cursor-pointer ${
                      gameSettings.mode === 'picnic'
                        ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🍰 Guard the Picnic Treat!
                  </button>
                </div>
              </div>

              {/* Offline & PWA Info */}
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Offline & PWA Ready:</strong> This app runs 100% offline without needing internet. Add it to your home screen using the install button!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-2 w-full rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 text-base font-black text-white shadow-md active:scale-98 transition-all cursor-pointer"
            >
              Resume Playing
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
