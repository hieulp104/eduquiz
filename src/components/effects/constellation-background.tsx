"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Nền "chòm sao": các điểm trôi chậm, nối nhau bằng đường mảnh khi ở gần, hơi bị hút về phía con trỏ.
 * Chuyển từ `constellation-field` của bộ threeui sang Canvas 2D (không cần thư viện).
 * Màu theo token: chế độ sáng --color-brand-500, chế độ tối --color-brand-300.
 * prefers-reduced-motion → vẽ 1 khung tĩnh; dừng khi tab ẩn.
 */

type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number };

type Props = {
  className?: string;
  /** Khoảng cách tối đa (px) để 2 điểm được nối. */
  linkDistance?: number;
  /** Số điểm trên mỗi 10.000 px² — tự giới hạn 30–90 điểm. */
  density?: number;
  /** Độ đậm chung ở chế độ sáng / tối. */
  opacity?: { light: number; dark: number };
};

function isDarkTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readColor(dark: boolean) {
  const style = getComputedStyle(document.documentElement);
  const value = style.getPropertyValue(dark ? "--color-brand-300" : "--color-brand-500").trim();
  return value || (dark ? "#93c5fd" : "#3b82f6");
}

export function ConstellationBackground({ className, linkDistance = 150, density = 0.55, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightOpacity = opacity?.light ?? 0.55;
  const darkOpacity = opacity?.dark ?? 0.75;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dark = isDarkTheme();
    let color = readColor(dark);
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let frame = 0;
    const pointer = { x: -9999, y: -9999 };

    const initNodes = () => {
      const count = Math.round(Math.min(90, Math.max(30, ((width * height) / 10000) * density)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.2 + 1.2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const resized = Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (resized || nodes.length === 0) initNodes();
      draw(performance.now(), false);
    };

    const draw = (now: number, move: boolean) => {
      const base = dark ? darkOpacity : lightOpacity;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;

      if (move) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          if (dx * dx + dy * dy < 200 * 200) {
            n.x += dx * 0.004;
            n.y += dy * 0.004;
          }
        }
      }

      // Đường nối trước, điểm vẽ đè lên.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDistance) {
            ctx.globalAlpha = base * (0.12 + (1 - d / linkDistance) * 0.5);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const pulse = 0.8 + Math.sin(now * 0.001 + n.phase) * 0.2;
        ctx.globalAlpha = base * pulse * 0.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = base * pulse;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now, true);
      frame = !document.hidden && !reducedMotion.matches ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (frame) return;
      if (reducedMotion.matches) draw(performance.now(), false);
      else frame = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onTheme = () => {
      dark = isDarkTheme();
      color = readColor(dark);
      draw(performance.now(), false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    schemeQuery.addEventListener("change", onTheme);
    reducedMotion.addEventListener("change", kick);
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    resize();
    kick();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      schemeQuery.removeEventListener("change", onTheme);
      reducedMotion.removeEventListener("change", kick);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [linkDistance, density, lightOpacity, darkOpacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 size-full", className)}
    />
  );
}
