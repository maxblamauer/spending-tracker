export type StevieMoodKind = 'neutral' | 'good' | 'bad';

/** Spending trend for the header mascot (good = spending down vs prior, with invert semantics handled by reporters). */
export interface StevieMoodReport {
  kind: StevieMoodKind;
  /** Signed percent vs prior period (e.g. +12.3 = spend up). */
  pct?: number;
  /** Short factual subtitle under the quip. */
  detail?: string;
}

const GOOD_LINES = [
  'Wallet doing a little victory lap.',
  'The treat budget approves of this timeline.',
  'Stevie is doing the zoomies. In a fiscally responsible way.',
  'Down is the new up. Good job.',
  'That’s what we call a soft landing for the card.',
];

const BAD_LINES = [
  'Stevie saw the numbers and needs a minute.',
  'The card heated up. Maybe ice the spending a bit?',
  'Oof. Stevie is pretending not to look.',
  'That trend is giving “second dinner” energy.',
  'We’re not panicking. Stevie might be panicking a little.',
];

/** Upbeat lines when there’s no trend to compare yet (still “happy Stevie”). */
const HAPPY_IDLE_LINES = [
  'No change is good change. WOOF!',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickStevieQuip(kind: StevieMoodKind): string {
  if (kind === 'bad') return pick(BAD_LINES);
  if (kind === 'good') return pick(GOOD_LINES);
  return pick(HAPPY_IDLE_LINES);
}
