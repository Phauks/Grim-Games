/**
 * Leaves around a character token, as on the printed tokens: one leaf on the left when the
 * character acts on the first night, one on the right when it acts on other nights, and
 * leaves across the top, one per reminder token, plus an orange one when it changes setup
 * (rulebook; https://wiki.bloodontheclocktower.com/Setup for the top leaves). Our own
 * simple drawing, not TPI's artwork.
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
	kind: 'night' | 'reminder' | 'setup';
}

/** Top leaves are spread this many degrees apart; more than `MAX_TOP` are not drawn. */
export const TOP_STEP = 20;
export const MAX_TOP = 9;

export function leafLayout(marks: LeafMarks): Leaf[] {
	const top: Leaf['kind'][] = Array.from(
		{ length: Math.max(0, Math.floor(marks.reminders)) },
		() => 'reminder' as const
	);
	// The setup leaf sits in the middle of the top row.
	if (marks.setup) top.splice(Math.floor(top.length / 2), 0, 'setup');
	const shown = top.slice(0, MAX_TOP);
	const start = -90 - ((shown.length - 1) * TOP_STEP) / 2;
	const leaves: Leaf[] = shown.map((kind, i) => ({ angle: start + i * TOP_STEP, kind }));
	if (marks.firstNight) leaves.push({ angle: 180, kind: 'night' });
	if (marks.otherNight) leaves.push({ angle: 0, kind: 'night' });
	return leaves;
}

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
