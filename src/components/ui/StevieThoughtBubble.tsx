import type { ReactNode } from 'react';

const DOTS_FROM_ABOVE = [
  { cx: 34, cy: 10, r: 3.2 },
  { cx: 46, cy: 24, r: 4.6 },
  { cx: 58, cy: 42, r: 6.4 },
] as const;

/** Trail starts at the logo-side edge of the artboard (smallest dot “on” Stevie’s head), then steps into the cloud. */
const DOTS_FROM_LEFT = [
  { cx: -2, cy: 86, r: 3.2 },
  { cx: 12, cy: 84, r: 4.6 },
  { cx: 30, cy: 79, r: 6.4 },
] as const;

/** Cloud + dot trail (cartoon thought bubble) behind Stevie’s popover text. */
export function StevieThoughtBubble({
  children,
  variant = 'header',
}: {
  children: ReactNode;
  /** `header`: dots rise toward the avatar above. `login`: dots run in from the left (toward Stevie on the card). */
  variant?: 'header' | 'login';
}) {
  const dots = variant === 'login' ? DOTS_FROM_LEFT : DOTS_FROM_ABOVE;
  const thoughtClass =
    variant === 'login'
      ? 'stevie-mood-popover stevie-mood-popover--thought stevie-mood-popover--thought-login'
      : 'stevie-mood-popover stevie-mood-popover--thought';

  return (
    <div className={thoughtClass} role="dialog" aria-label="Stevie says">
      <svg
        className="stevie-thought-svg"
        viewBox="0 0 320 168"
        overflow={variant === 'login' ? 'visible' : undefined}
        aria-hidden
      >
        {dots.map((d) => (
          <circle
            key={`${d.cx}-${d.cy}`}
            className="stevie-thought-dot"
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill="var(--bg-card)"
            stroke="currentColor"
            strokeWidth={2.4}
          />
        ))}
        <path
          fill="var(--bg-card)"
          stroke="currentColor"
          strokeWidth={2.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          d="M 62 54
            C 44 52 28 64 30 82
            C 22 94 26 114 44 120
            C 48 138 78 148 104 138
            C 124 152 168 150 192 132
            C 218 144 262 130 272 100
            C 292 88 288 58 262 48
            C 252 30 218 28 192 38
            C 172 26 138 30 118 42
            C 96 36 72 42 62 54 Z"
        />
      </svg>
      <div className="stevie-mood-popover-content">{children}</div>
    </div>
  );
}
