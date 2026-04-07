/**
 * Shared Mantine component style objects.
 *
 * These target Mantine's internal subcomponent slots (input, label, indicator…)
 * which cannot be reached by Tailwind utility classes. Everything here uses
 * CSS custom properties so colors switch automatically with the color scheme.
 *
 * For styles that CAN be expressed as Tailwind classes (bg-*, text-*, border-*),
 * prefer className on the component root instead of adding them here.
 */

/** Label + description + input slot styles shared by all form inputs. */
export const INPUT_STYLES = {
  label: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: 700,
    letterSpacing: '0.02em',
    color: 'var(--text-secondary)',
  },
  description: { color: 'var(--text-muted)', fontSize: 'var(--mantine-font-size-xs)' },
  input: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
} as const;

/** Primary action button (Generate, Start, Select…). */
export const BTN_PRIMARY = {
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 'var(--mantine-font-size-xs)',
  letterSpacing: '0.08em',
  border: 'none',
} as const;

/** Disabled / inactive state for primary action buttons. */
export const BTN_PRIMARY_DISABLED = {
  background: 'var(--surface-raised)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 'var(--mantine-font-size-xs)',
  letterSpacing: '0.08em',
  border: 'none',
} as const;

/** Destructive stop button. */
export const BTN_STOP = {
  background: '#c0392b',
  color: '#fff',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 'var(--mantine-font-size-xs)',
  letterSpacing: '0.08em',
  border: 'none',
} as const;

/** Returns the correct primary button style depending on whether it is enabled. */
export function btnPrimary(enabled: boolean) {
  return enabled ? BTN_PRIMARY : BTN_PRIMARY_DISABLED;
}
