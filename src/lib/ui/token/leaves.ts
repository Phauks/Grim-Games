import { t } from '#lib/i18n/locale.svelte.ts';

/**
 * Marks inside a character token, as on the printed tokens: one leaf on the left when the
 * character acts on the first night, one on the right when it acts on other nights, and
 * leaves across the top, one per reminder token
 * (rulebook; https://wiki.bloodontheclocktower.com/Setup for the top leaves). Every mark sits
 * inside the token. A character that changes setup can show a flower at the bottom right
 * (Settings > Tokens, off by default: Trevor 2026-10-18). Our own simple drawing, not TPI's
 * artwork.
 */
export interface LeafMarks {
	firstNight: boolean;
	otherNight: boolean;
	/** Reminder tokens the character has. */
	reminders: number;
	/** Changes setup ([bracketed] ability text). */
	setup?: boolean;
}

/** Where the setup flower sits: bottom right, inside the face. */
export const FLOWER_ANGLE = 45;

export interface Leaf {
	/** Degrees clockwise from 3 o'clock: -90 is the top, 180 the left, 0 the right. */
	angle: number;
	kind: 'night' | 'reminder';
}

/** Top leaves are spread this many degrees apart; more than `MAX_TOP` are not drawn. */
export const TOP_STEP = 20;
export const MAX_TOP = 9;

export function leafLayout(marks: LeafMarks): Leaf[] {
	const shown = Math.min(MAX_TOP, Math.max(0, Math.floor(marks.reminders)));
	const start = -90 - ((shown - 1) * TOP_STEP) / 2;
	const leaves: Leaf[] = Array.from({ length: shown }, (_, i) => ({
		angle: start + i * TOP_STEP,
		kind: 'reminder' as const
	}));
	if (marks.firstNight) leaves.push({ angle: 180, kind: 'night' });
	if (marks.otherNight) leaves.push({ angle: 0, kind: 'night' });
	return leaves;
}

/** Words for the leaves, for screen readers. */
export function describeLeaves(marks: LeafMarks): string {
	const parts: string[] = [];
	if (marks.firstNight) parts.push(t('characters.marks.firstNight'));
	if (marks.otherNight) parts.push(t('characters.marks.otherNight'));
	if (marks.reminders > 0) parts.push(t('characters.marks.reminders', { count: marks.reminders }));
	return parts.join(', ');
}
