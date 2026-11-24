"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Nền lưới chấm li ti, thưa, đều (kiểu giấy chấm) — một dải sáng chậm lướt qua, mờ dần ra rìa, hơi lệch theo con trỏ.
 * Chấm KHÔNG đổi kích thước (chấm to, dày, co giãn dễ gây khó chịu kiểu "sợ lỗ").
 * Chuyển từ hiệu ứng `dot-matrix` của bộ threeui sang WebGL thuần (không cần three.js).
 * Màu lấy từ token --color-brand-500 → tự hợp chế độ sáng / tối.
 * Tôn trọng prefers-reduced-motion (vẽ 1 khung tĩnh), dừng khi tab ẩn / cuộn khuất.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uCell;
uniform float uDot;
uniform float uOpacity;
uniform vec3 uColor;
void main() {
  // Chấm kích thước cố định (px) trên lưới thưa — chỉ đổi độ sáng, không phình to.
  vec2 p = gl_FragCoord.xy + uMouse * uCell * 0.35;
  vec2 local = mod(p, uCell) - uCell * 0.5;
  float shape = 1.0 - smoothstep(uDot - 0.6, uDot + 0.6, length(local));
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Một dải sáng rất chậm lướt chéo qua lưới.
  float wave = sin(uTime * 0.35 - (uv.x + uv.y) * 3.0) * 0.5 + 0.5;
  float fade = smoothstep(0.95, 0.15, length((uv - 0.5) * vec2(1.0, 1.2)));
  float alpha = shape * fade * uOpacity * (0.45 + 0.55 * wave);
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

type Props = {
  className?: string;
  /** Khoảng cách giữa 2 chấm (px). */
  spacing?: number;
  /** Bán kính chấm (px). */
  dotRadius?: number;
  /** Độ đậm ở chế độ sáng / tối. */
  opacity?: { light: number; dark: number };
};

/** Đọc màu CSS bất kỳ (hex, rgb, oklch…) thành [r, g, b] 0–1 bằng canvas 2D. */
function cssColorToRgb(value: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [0.23, 0.51, 0.96];
  ctx.fillStyle = "#3b82f6";
  ctx.fillStyle = value || "#3b82f6";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function isDarkTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function DotMatrixBackground({ className, spacing = 26, dotRadius = 1.1, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightOpacity = opacity?.light ?? 0.5;
  const darkOpacity = opacity?.dark ?? 0.6;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return; // Máy không có WebGL → để trống, trang vẫn bình thường.

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const u = {
      time: gl.getUniformLocation(program, "uTime"),
      resolution: gl.getUniformLocation(program, "uResolution"),
      mouse: gl.getUniformLocation(program, "uMouse"),
      cell: gl.getUniformLocation(program, "uCell"),
      dot: gl.getUniformLocation(program, "uDot"),
      opacity: gl.getUniformLocation(program, "uOpacity"),
      color: gl.getUniformLocation(program, "uColor"),
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let color = cssColorToRgb(getComputedStyle(document.documentElement).getPropertyValue("--color-brand-500").trim());
    let dark = isDarkTheme();
    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = 0;
    let visible = true;
    const startedAt = performance.now();

    const draw = (now: number) => {
      mouse.x += (target.x - mouse.x) * 0.05;
      mouse.y += (target.y - mouse.y) * 0.05;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.time, reducedMotion.matches ? 2 : (now - startedAt) / 1000);
      gl.uniform2f(u.resolution, canvas.width, canvas.height);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      const ratio = canvas.width / Math.max(1, canvas.clientWidth);
      gl.uniform1f(u.cell, spacing * ratio);
      gl.uniform1f(u.dot, dotRadius * ratio);
      gl.uniform1f(u.opacity, dark ? darkOpacity : lightOpacity);
      gl.uniform3f(u.color, color[0], color[1], color[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      draw(now);
      frame = visible && !document.hidden && !reducedMotion.matches ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      kick();
    };

    // Canvas không nhận chuột (pointer-events: none) → nghe ở window.
    const onPointer = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      target.x = ((e.clientX - b.left) / Math.max(1, b.width)) * 2 - 1;
      target.y = -(((e.clientY - b.top) / Math.max(1, b.height)) * 2 - 1);
    };

    const onTheme = () => {
      dark = isDarkTheme();
      color = cssColorToRgb(getComputedStyle(document.documentElement).getPropertyValue("--color-brand-500").trim());
      kick();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) kick();
    });
    intersection.observe(canvas);
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    schemeQuery.addEventListener("change", onTheme);
    reducedMotion.addEventListener("change", kick);
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("pointermove", onPointer, { passive: true });
    resize();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      schemeQuery.removeEventListener("change", onTheme);
      reducedMotion.removeEventListener("change", kick);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener("pointermove", onPointer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [spacing, dotRadius, lightOpacity, darkOpacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 size-full", className)}
    />
  );
}
