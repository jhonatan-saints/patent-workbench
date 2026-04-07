import { useState, useEffect, useRef } from 'react';
import { PasswordInput, TextInput, Text } from '@mantine/core';

/*
 * Login screen is always rendered in dark mode regardless of the app theme.
 * Gradient uses hardcoded dark --surface values to avoid banding.
 * Dark --surface: #141414 → rgb(20 20 20)
 */
const SURFACE_TRANSPARENT = 'rgb(20 20 20 / 0)';
const SURFACE_SOLID = 'rgb(20 20 20 / 1)';

// 3×3 hero grid
function HeroGrid() {
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [glowReady, setGlowReady] = useState(false);
  const [active, setActive] = useState(-1);
  const lastRef = useRef(-1);

  // Phase 1 - build grid one cell at a time, each flashes on entry
  useEffect(() => {
    let count = 0;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;

    const id = setInterval(() => {
      setRevealed(count + 1);
      setActive(count);
      count += 1;
      if (count >= 9) {
        clearInterval(id);
        // Phase 2 - clear last flash, then spin all cells
        t1 = setTimeout(() => {
          setActive(-1);
          setSpinning(true);
        }, 500);
        // Phase 3 - after spin completes, start ambient glow
        t2 = setTimeout(() => setSpinning(false), 1950);
        t3 = setTimeout(() => setGlowReady(true), 1967);
      }
    }, 360);

    return () => {
      clearInterval(id);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Phase 3 — ambient glow cycle
  useEffect(() => {
    if (!glowReady) return;
    let cancelled = false;
    const tick = () => {
      setTimeout(
        () => {
          if (cancelled) return;
          let next: number;
          do {
            next = Math.floor(Math.random() * 9);
          } while (next === lastRef.current);
          lastRef.current = next;
          setActive(next);
          tick();
        },
        1100 + Math.random() * 900
      );
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [glowReady]);

  return (
    <>
      {/* Spin wraps the entire grid */}
      <div
        style={{
          animation: spinning ? 'spin-grid 1400ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 96px)',
            gridTemplateRows: 'repeat(3, 96px)',
            gap: 12,
          }}
        >
          {Array.from({ length: 9 }, (_, i) => {
            const visible = i < revealed;
            const on = active === i;
            let opacity = 0;
            if (visible && on) opacity = 1;
            else if (visible) opacity = 0.72;
            return (
              <div
                key={i}
                style={{
                  borderRadius: 12,
                  background: on ? 'var(--accent)' : 'var(--border)',
                  border: 'none',
                  boxShadow: on ? '0 0 6px 2px var(--accent-glow)' : 'none',
                  opacity,
                  transform: visible ? 'scale(1)' : 'scale(0.75)',
                  transition:
                    'opacity 220ms ease, transform 260ms cubic-bezier(0.34,1.56,0.64,1), background 600ms ease, box-shadow 600ms ease',
                }}
              />
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes spin-grid {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(90deg); }
        }
      `}</style>
    </>
  );
}

// Wordmark dots - static, diagonal squares lit (0, 4, 8)
function WordmarkDots() {
  const size = 26;
  const op = [1, 0.22, 0.55, 0.22, 1, 0.22, 0.55, 0.22, 1];
  const box = [
    '0 0 6px 2px var(--accent-glow)',
    '0 0 2px 0.5px var(--accent-glow)',
    '0 0 4px 1px var(--accent-glow)',
    '0 0 2px 0.5px var(--accent-glow)',
    '0 0 6px 2px var(--accent-glow)',
    '0 0 2px 0.5px var(--accent-glow)',
    '0 0 4px 1px var(--accent-glow)',
    '0 0 2px 0.5px var(--accent-glow)',
    '0 0 6px 2px var(--accent-glow)',
  ];

  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 3,
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {op.map((o, i) => (
        <div
          key={ids[i]}
          style={{
            borderRadius: 1.5,
            background: 'var(--accent)',
            opacity: o,
            boxShadow: box[i] || 'none',
            width: '100%',
            height: '100%',
          }}
        />
      ))}
    </div>
  );
}

// Main
interface OAuthLoginDemoProps {
  readonly onAuthenticated: () => void;
}

export function OAuthLoginDemo({ onAuthenticated }: OAuthLoginDemoProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 40);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setExiting(true);
    setTimeout(onAuthenticated, 520);
  };

  const v = entered && !exiting;

  return (
    <div
      data-mantine-color-scheme="dark"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg)',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.5s ease',
        display: 'flex',
      }}
    >
      {/* LEFT PANEL - 60% */}
      <div
        style={{
          flex: '0 0 60%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            className="animate-blob-1"
            style={{
              position: 'absolute',
              top: '20%',
              left: '15%',
              width: 500,
              height: 460,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
              filter: 'blur(110px)',
              opacity: 0.1,
            }}
          />
          <div
            className="animate-blob-2"
            style={{
              position: 'absolute',
              bottom: '10%',
              right: '0%',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)',
              filter: 'blur(90px)',
              opacity: 0.07,
            }}
          />
        </div>

        {/* Logo - top-left */}
        <header
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '1.75rem 2rem',
            opacity: v ? 1 : 0,
            transform: v ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <WordmarkDots />
          <Text
            ff="var(--font-display)"
            fw={700}
            size="lg"
            style={{
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Patent Workbench
          </Text>
        </header>

        {/* Grid - centred */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <HeroGrid />
        </div>

        {/* Tagline - bottom-left */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '1.75rem 2rem',
            opacity: v ? 0.38 : 0,
            transition: 'opacity 0.5s ease 0.35s',
          }}
        >
          <Text
            size="xs"
            ff="var(--font-mono)"
            style={{
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Secure Driven · Built for Inventors
          </Text>
        </div>
      </div>

      {/* RIGHT PANEL - 40% */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 3rem',
          position: 'relative',
          /*
           * Smooth fade: starts fully transparent at left edge (matching --bg),
           * becomes solid --surface by ~40% in. No banding because both stops
           * use the same RGB channels — only alpha changes.
           */
          background: `linear-gradient(to right, ${SURFACE_TRANSPARENT} 0%, ${SURFACE_SOLID} 22%)`,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 340,
            opacity: v ? 1 : 0,
            transform: v ? 'translateY(0)' : 'translateY(18px)',
            transition:
              'opacity 0.65s cubic-bezier(0.16,1,0.3,1) 0.18s, transform 0.65s cubic-bezier(0.16,1,0.3,1) 0.18s',
            ...(shake ? { animation: 'shake 0.42s cubic-bezier(.36,.07,.19,.97)' } : {}),
          }}
        >
          <Text
            component="h1"
            ff="var(--font-display)"
            fw={700}
            style={{
              fontSize: '2.4rem',
              lineHeight: 1.1,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 10,
            }}
          >
            Sign in
          </Text>
          <Text size="sm" mb="xl" style={{ color: 'var(--text-secondary)' }}>
            Use your lab credentials to continue.
          </Text>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
          >
            <TextInput
              label="Username"
              placeholder="lab\username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              autoComplete="username"
              autoFocus
              size="md"
              styles={{
                label: {
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  marginBottom: 5,
                },
                input: {
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                },
              }}
            />
            <PasswordInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              size="md"
              styles={{
                label: {
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  marginBottom: 5,
                },
                input: {
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                },
              }}
            />

            <button
              type="submit"
              className="btn-shimmer"
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '0.75rem 1.25rem',
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Login
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <Text
              size="xs"
              style={{ color: 'var(--text-muted)', opacity: 0.5, whiteSpace: 'nowrap' }}
            >
              Or sign in with
            </Text>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* SSO button */}
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '0.65rem 1.25rem',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              fontWeight: 500,
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'border-color 200ms ease, background 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Authelia icon — shield shape */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="var(--accent)"
                opacity="0.9"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="var(--accent-text)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Authelia SSO
          </button>

          <Text size="xs" mt="lg" style={{ color: 'var(--text-muted)', opacity: 0.35 }}>
            Access is restricted to authorised lab users.
          </Text>
        </div>

        {/* Demo badge - bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            right: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: v ? 0.35 : 0,
            transition: 'opacity 0.5s ease 0.4s',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
            }}
          />
          <Text ff="monospace" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            DEMO PREVIEW · OAuth2 login screen
          </Text>
        </div>
      </main>

      <style>{`
        @keyframes shake {
          10%, 90%  { transform: translateX(-2px); }
          20%, 80%  { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-5px); }
          40%, 60%  { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
