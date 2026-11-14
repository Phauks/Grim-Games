/**
 * Plain text of the app's rich sentences, for tests: a night step's text, a day reminder and a
 * reference sentence, each with characters and tokens in brackets.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { PlaceholderAction } from '#lib/core/data/parts/reminder-placeholders.ts';
import type { NightTextSegment } from '#lib/core/rules/night/night-text.ts';
import type { ReminderSegment } from '#lib/core/rules/day/day-reminders.ts';
import type { ReferenceSegment } from '#lib/core/rules/reference.ts';

/**
 * Plain text of a night step: tokens as [Cursed] (+ placed, - removed), the death
 * marker as [Dead], info tokens as «You are», characters as {King}.
 */
export function nightTextPlain(
	segments: readonly NightTextSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	const sign = (action?: PlaceholderAction) =>
		action === 'place' ? '+' : action === 'remove' ? '-' : '';
	return segments
		.map((s) => {
			switch (s.kind) {
				case 'text':
					return s.text;
				case 'character':
					return `{${name(s.id)}}`;
				case 'info':
					return `«${s.label}»`;
				case 'dead':
					return `[${sign(s.action)}Dead]`;
				case 'reminder':
					return `[${sign(s.action)}${s.label ?? `reminder: ${s.options.join(' / ')}`}]`;
			}
		})
		.join('');
}

/** Plain text of a day reminder: "[Witch · Sam] has chosen [Librarian]". */
export function renderReminder(
	segments: readonly ReminderSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	return segments
		.map((s) =>
			s.kind === 'text'
				? s.text
				: s.kind === 'value'
					? `(${s.value ?? s.placeholder})`
					: `[${name(s.ref.characterId)}${s.ref.playerName ? ` · ${s.ref.playerName}` : ''}]`
		)
		.join(' ');
}

/** Plain text of a reminder sentence: "[Witch] has chosen [player with “Cursed”]". */
export function referenceText(
	segments: readonly ReferenceSegment[],
	name: (id: CharacterId) => string = (id) => id
): string {
	return segments
		.map((s) =>
			s.kind === 'text'
				? s.text
				: s.kind === 'character'
					? `[${name(s.characterId)}]`
					: s.kind === 'value'
						? `(${s.placeholder})`
						: s.kind === 'nomination'
							? s.who === 'chosen'
								? '[the player the nominee chose]'
								: '[the nominee]'
							: `[player with “${s.token}”]`
		)
		.join(' ');
}
