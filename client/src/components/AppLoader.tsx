import { IconGavel } from '@tabler/icons-react';
import { Text } from '@mantine/core';

export function AppLoader() {
  return (
    <div className="fixed inset-0 z-9999 flex min-h-screen w-screen flex-col items-center justify-center gap-5 bg-bg">
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

      {/* Icon with glow ring */}
      <div className="relative flex items-center justify-center">
        <div
          className="animate-pulse-glow absolute h-16 w-16 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)' }}
        />
        <span className="animate-gavel relative z-10 text-accent">
          <IconGavel size={30} />
        </span>
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
