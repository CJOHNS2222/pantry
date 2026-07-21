import { useRef, useEffect, useCallback } from 'react';

/**
 * Canvas-based particle "fireworks" effect used to celebrate achievement unlocks.
 * Owns the canvas ref, the animation-frame loop, and its own cleanup.
 */
export function useCelebrationFireworks() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const triggerCelebration = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      alpha: number;
      decay: number;
      gravity: number;
    }

    const particles: Particle[] = [];
    const colors = ['#ff0055', '#00ffcc', '#ffcc00', '#ff6600', '#9900ff', '#33ccff', '#ff33aa', '#00ff66'];

    const createExplosion = (x: number, y: number) => {
      const count = 50 + Math.random() * 30;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 6;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (0.5 + Math.random() * 1.5),
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.015,
          gravity: 0.12,
        });
      }
    };

    const w = canvas.width;
    const h = canvas.height;

    createExplosion(w / 2, h / 2);
    setTimeout(() => createExplosion(w * 0.25, h * 0.45), 200);
    setTimeout(() => createExplosion(w * 0.75, h * 0.45), 400);
    setTimeout(() => createExplosion(w * 0.5, h * 0.35), 600);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
      }
    };

    render();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { canvasRef, triggerCelebration };
}
