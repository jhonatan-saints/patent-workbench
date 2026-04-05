import { useEffect, useRef, useState } from 'react';
import { Text } from '@mantine/core';

const GRID_SIZE = 9;
const GLOW_START_MS = 400;
const GLOW_END_MS = 2500;
const GLOW_INTERVAL_MS = 230;

const clearActive = (setter: (s: ReadonlySet<number>) => void) => setter(new Set());

function pickRandom(exclude: number): number {
  let next: number;
  do {
    next = Math.floor(Math.random() * GRID_SIZE);
  } while (next === exclude);
  return next;
}

export function AppLoader() {
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  const [fading, setFading] = useState(false);
  const lastRef = useRef<number>(-1);
  const clearGlowRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    let stopHandle: ReturnType<typeof setTimeout>;

    const startHandle = setTimeout(() => {
      intervalId = setInterval(() => {
        const primary = pickRandom(lastRef.current);
        lastRef.current = primary;
        setActive(new Set([primary]));

        clearTimeout(clearGlowRef.current);
        // vary clear duration 180–300ms for organic feel
        clearGlowRef.current = setTimeout(
          clearActive.bind(null, setActive),
          180 + Math.floor(Math.random() * 120),
        );
      }, GLOW_INTERVAL_MS);

      stopHandle = setTimeout(() => {
        clearInterval(intervalId);
        clearTimeout(clearGlowRef.current);
        clearActive(setActive);
        setFading(true);
      }, GLOW_END_MS - GLOW_START_MS);
    }, GLOW_START_MS);

    return () => {
      clearTimeout(startHandle);
      clearInterval(intervalId);
      clearTimeout(stopHandle);
      clearTimeout(clearGlowRef.current);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-9999 flex min-h-screen w-screen flex-col items-center justify-center gap-5 bg-bg"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.45s ease' : undefined,
      }}
    >
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-blob-1 absolute top-[35%] left-[40%] h-80 w-[320px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            filter: 'blur(80px)',
            opacity: 0.12,
          }}
        />
        <div
          className="animate-blob-2 absolute top-[45%] left-[45%] h-50 w-50 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)',
            filter: 'blur(60px)',
            opacity: 0.08,
          }}
        />
      </div>

      {/* 3×3 grid logo */}
      <div className="animate-grid-in">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            width: '72px',
            height: '72px',
          }}
        >
          {Array.from({ length: GRID_SIZE }, (_, i) => (
            <div
              key={i}
              style={{
                borderRadius: '4px',
                background: 'var(--accent)',
                opacity: active.has(i) ? 0.95 : 0.14,
                boxShadow: active.has(i)
                  ? '0 0 6px 2px var(--accent), 0 0 18px 4px var(--accent-glow)'
                  : 'none',
                transition: 'opacity 220ms ease-in-out, box-shadow 220ms ease-in-out',
              }}
            />
          ))}
        </div>
      </div>

      {/* Product name */}
      <div className="animate-fade-up" style={{ animationDelay: '250ms' }}>
        <Text
          fw={700}
          size="sm"
          className="font-display tracking-[0.12em] text-fg uppercase"
          style={{ opacity: 0.85 }}
        >
          Patent Workbench
        </Text>
      </div>

      {/* Loading bar */}
      <div
        className="animate-fade-up h-px w-36 overflow-hidden rounded-full bg-stroke"
        style={{ animationDelay: '450ms' }}
      >
        <div className="animate-load-bar h-full rounded-full bg-accent" />
      </div>
    </div>
  );
}
