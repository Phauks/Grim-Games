/**
 * Marks inside a character token, as on the printed tokens: one leaf on the left when the
 * character acts on the first night, one on the right when it acts on other nights, and
 * leaves across the top, one per reminder token
 * (rulebook; https://wiki.bloodontheclocktower.com/Setup for the top leaves). A character
 * that changes setup gets a flower at the bottom right instead (Trevor, 2026-10-15). Every
 * mark sits inside the token. Our own simple drawing, not TPI's artwork.
 */
export interface LeafMarks {
	firstNight: boolean;
	otherNight: boolean;
	/** Reminder tokens the character has. */
	reminders: number;
	/** Changes setup ([bracketed] ability text). */
	setup: boolean;
}

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

/** Where the setup flower sits: bottom right, inside the face. */
export const FLOWER_ANGLE = 45;

/** Words for the leaves, for screen readers. */
export function describeLeaves(marks: LeafMarks): string {
	const parts: string[] = [];
	if (marks.firstNight) parts.push('wakes on the first night');
	if (marks.otherNight) parts.push('wakes on other nights');
	if (marks.reminders > 0)
		parts.push(`${marks.reminders} reminder token${marks.reminders === 1 ? '' : 's'}`);
	if (marks.setup) parts.push('changes setup');
	return parts.join(', ');
}
