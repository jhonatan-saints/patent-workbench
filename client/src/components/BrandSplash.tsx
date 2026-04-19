import { useI18n } from '@/i18n';
import { useEffect, useRef, useState } from 'react';

// Timing
const CELL_INTERVAL_MS = 360; // matches OAuthLoginDemo HeroGrid interval
const POST_BUILD_MS = 500; // matches OAuthLoginDemo t1 delay
const SPIN_MS = 1400; // matches OAuthLoginDemo spin-grid duration
const PRE_REVEAL_MS = 200; // pause after spin settles before text
const REVEAL_HOLD_MS = 3800; // text fully in at ~2000ms; holds ~1800ms more before fade
const FADE_MS = 500; // matches OAuthLoginDemo exit transition

// Layout — kept as JS constants for grid template literals
const CELL_PX = 96;
const GAP_PX = 12;

type Phase = 'build' | 'spin' | 'reveal' | 'out';

interface BrandSplashProps {
  readonly onDone: () => void;
}

export function BrandSplash({ onDone }: BrandSplashProps) {
  const [revealed, setRevealed] = useState(0);
  const [activeCell, setActiveCell] = useState(-1);
  const [phase, setPhase] = useState<Phase>('build');
  const onDoneRef = useRef(onDone);
  const { t } = useI18n();

  onDoneRef.current = onDone;

  useEffect(() => {
    let count = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const interval = setInterval(() => {
      setRevealed(count + 1);
      setActiveCell(count);
      count += 1;

      if (count >= 9) {
        clearInterval(interval);

        const t0 = POST_BUILD_MS;
        const t1 = t0 + SPIN_MS + PRE_REVEAL_MS;
        const t2 = t1 + REVEAL_HOLD_MS;
        timers.push(
          setTimeout(() => {
            setActiveCell(-1);
            setPhase('spin');
          }, t0),
          setTimeout(() => setPhase('reveal'), t1),
          setTimeout(() => setPhase('out'), t2),
          setTimeout(() => onDoneRef.current(), t2 + FADE_MS)
        );
      }
    }, CELL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  const spinning = phase === 'spin';
  const revealing = phase === 'reveal' || phase === 'out';
  const fading = phase === 'out';

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-(--bg)"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_MS}ms ease` : undefined,
      }}
    >
      {/* Ambient blobs — mirrors OAuthLoginDemo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="animate-blob-1 absolute top-[20%] left-[15%] w-120 h-110 rounded-full opacity-[0.09] blur-[110px]"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div
          className="animate-blob-2 absolute bottom-[10%] right-[5%] w-70 h-70 rounded-full opacity-[0.07] blur-[90px]"
          style={{ background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)' }}
        />
      </div>

      {/*
        Stage — the grid is in normal flow (centered by parent flex).
        On reveal the whole stage slides left via transform so the combined
        grid + text composition appears centered. Text is position:absolute
        so it has zero layout impact and never causes a reflow jump.
      */}
      <div
        className="relative"
        style={{
          transform: revealing ? 'translateX(-155px)' : 'translateX(0)',
          transition: revealing ? 'transform 1400ms cubic-bezier(0.16,1,0.3,1)' : undefined,
        }}
      >
        {/* Spin wrapper */}
        <div
          style={{
            animation: spinning
              ? `splash-spin-grid ${SPIN_MS}ms cubic-bezier(0.16,1,0.3,1) both`
              : 'none',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CELL_PX}px)`,
              gridTemplateRows: `repeat(3, ${CELL_PX}px)`,
              gap: GAP_PX,
            }}
          >
            {Array.from({ length: 9 }, (_, i) => {
              const visible = i < revealed;
              const on = activeCell === i;
              const litOpacity = on ? 1 : 0.72;
              const opacity = visible ? litOpacity : 0;
              return (
                <div
                  key={i}
                  className="rounded-xl"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--border)',
                    opacity,
                    transform: visible ? 'scale(1)' : 'scale(0.75)',
                    boxShadow: on ? '0 0 6px 2px var(--accent-glow)' : 'none',
                    transition:
                      'opacity 220ms ease, transform 260ms cubic-bezier(0.34,1.56,0.64,1), background 600ms ease, box-shadow 600ms ease',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Brand text — absolutely positioned, zero layout impact */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-6 whitespace-nowrap flex flex-col gap-0.5">
          <span
            className="text-5xl block font-semibold uppercase tracking-[0.14em]"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              opacity: revealing ? 0.82 : 0,
              transition: revealing ? 'opacity 1200ms ease 300ms' : undefined,
            }}
          >
            {t('res_Patent')}
          </span>
          <span
            className="text-6xl block font-bold uppercase leading-none tracking-[0.06em]"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--accent)',
              opacity: revealing ? 1 : 0,
              transition: revealing ? 'opacity 1400ms ease 600ms' : undefined,
            }}
          >
            {t('res_Workbench')}
          </span>
        </div>
      </div>

      {/* Tagline — appears after brand text settles */}
      <div
        className="absolute bottom-[14%] inset-x-0 text-center text-[11px] uppercase tracking-[0.22em] pointer-events-none select-none"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--text-muted)',
          opacity: revealing ? 0.45 : 0,
          transition: revealing ? 'opacity 900ms ease 1500ms' : undefined,
        }}
      >
        {t('res_SecureDrivenTagline')}
      </div>

      <style>{`
        @keyframes splash-spin-grid {
          0%   { transform: rotate(0deg);  }
          100% { transform: rotate(90deg); }
        }
      `}</style>
    </div>
  );
}
