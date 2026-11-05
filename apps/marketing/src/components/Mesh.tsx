'use client';
import { useEffect, useRef } from 'react';

const GAP = 46;
const STEP = 23;
const RADIUS = 160;
const PUSH = 18;

/**
 * The hero's line mesh on a canvas: a fine grid whose lines bend away from the cursor under a
 * gold glow. Without a mouse the glow drifts on its own; with reduced motion the grid stays
 * still. It animates only while the hero is on screen.
 */
export function Mesh({ host }: { host: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = host.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !el || !ctx) return undefined;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, target: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let time = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = el.clientWidth;
      height = el.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const warp = (x: number, y: number): [number, number] => {
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) || 1;
      const force = Math.exp(-d2 / (2 * RADIUS * RADIUS)) * mouse.power * PUSH;
      return [x + (dx / d) * force, y + (dy / d) * force];
    };
    const draw = () => {
      const style = getComputedStyle(document.documentElement);
      const paths: [number, number][][] = [];
      for (let x = 0; x <= width + GAP; x += GAP) {
        const points: [number, number][] = [];
        for (let y = 0; y <= height; y += STEP) points.push(warp(x, y));
        paths.push(points);
      }
      for (let y = 0; y <= height + GAP; y += GAP) {
        const points: [number, number][] = [];
        for (let x = 0; x <= width; x += STEP) points.push(warp(x, y));
        paths.push(points);
      }
      const trace = () => {
        ctx.beginPath();
        for (const points of paths)
          points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      };
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = style.getPropertyValue('--mesh-line').trim();
      trace();
      if (mouse.power < 0.01) return;
      const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, RADIUS * 1.7);
      glow.addColorStop(0, style.getPropertyValue('--mesh-glow').trim());
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = mouse.power;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = glow;
      trace();
      ctx.globalAlpha = 1;
    };
    const tick = () => {
      time += 0.006;
      if (!fine) {
        mouse.tx = width * (0.5 + 0.34 * Math.sin(time));
        mouse.ty = height * (0.3 + 0.12 * Math.cos(time * 1.3));
        mouse.target = 0.55;
        if (mouse.x < -999) Object.assign(mouse, { x: mouse.tx, y: mouse.ty });
      }
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      mouse.power += (mouse.target - mouse.power) * 0.08;
      draw();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      Object.assign(mouse, {
        tx: event.clientX - box.left,
        ty: event.clientY - box.top,
        target: 1,
      });
      if (mouse.x < -999) Object.assign(mouse, { x: mouse.tx, y: mouse.ty });
    };
    const leave = () => (mouse.target = 0);
    const onResize = () => (resize(), still && draw());
    resize();
    window.addEventListener('resize', onResize);
    if (still) {
      draw();
      return () => window.removeEventListener('resize', onResize);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    const watch = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    watch.observe(el);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', onResize);
    };
  }, [host]);
  return <canvas ref={canvasRef} className="mesh" aria-hidden="true" />;
}
