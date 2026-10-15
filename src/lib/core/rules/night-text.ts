/**
 * TPI's Storyteller night text has two kinds of markup (botc-release `roles.json`):
 * - `:reminder:` marks where a reminder token is placed;
 * - `*WORD*` names a token: one of the character's reminder tokens ("*CURSED*") or an
 *   info token shown to a player ("*YOU ARE*", "*THIS CHARACTER SELECTED YOU*").
 *
 * `nightTextSegments` splits the text so the UI can draw tokens as badges instead of the
 * raw markup. A `:reminder:` is matched to a token only when the character's tokens leave
 * no doubt; otherwise it stays a generic reminder that lists the options.
 */
import type { Character } from '#lib/core/data/types.ts';

export type NightTextSegment =
	| { kind: 'text'; text: string }
	/** One of the character's reminder tokens; `label` absent when it cannot be told which. */
	| { kind: 'reminder'; label?: string; options: readonly string[] }
	/** An info token shown to a player ("You are"). */
	| { kind: 'info'; label: string };

const MARKUP = /:reminder:|\*([^*]+)\*/g;

/** "THIS CHARACTER SELECTED YOU" -> "This character selected you". */
function sentenceCase(text: string): string {
	const lower = text.trim().toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function nightTextSegments(
	text: string,
	character: Pick<Character, 'reminders' | 'remindersGlobal'>
): NightTextSegment[] {
	const tokens = [...character.reminders, ...character.remindersGlobal];
	const distinct = [...new Set(tokens)];
	const placeholders = text.match(/:reminder:/g)?.length ?? 0;
	// Which token each `:reminder:` is: the only one there is, or one each in data order.
	const labelFor = (index: number): string | undefined => {
		if (distinct.length === 1) return distinct[0];
		if (placeholders > 1 && placeholders === character.reminders.length)
			return character.reminders[index];
		return undefined;
	};

	const out: NightTextSegment[] = [];
	const pushText = (value: string) => {
		if (!value) return;
		const last = out[out.length - 1];
		if (last?.kind === 'text') last.text += value;
		else out.push({ kind: 'text', text: value });
	};
	let at = 0;
	let reminderIndex = 0;
	for (const match of text.matchAll(MARKUP)) {
		pushText(text.slice(at, match.index));
		at = match.index + match[0].length;
		if (match[1] === undefined) {
			const label = labelFor(reminderIndex++);
			out.push({ kind: 'reminder', ...(label !== undefined ? { label } : {}), options: distinct });
		} else {
			const own = tokens.find((t) => same(t, match[1]));
			if (own !== undefined) out.push({ kind: 'reminder', label: own, options: distinct });
			else out.push({ kind: 'info', label: sentenceCase(match[1]) });
		}
	}
	pushText(text.slice(at));
	// Trim the spaces left around a placeholder at either end.
	const first = out[0];
	if (first?.kind === 'text') first.text = first.text.trimStart();
	const last = out[out.length - 1];
	if (last?.kind === 'text') last.text = last.text.trimEnd();
	return out.filter((s) => s.kind !== 'text' || s.text !== '');
}

/** Plain text for tests and search: tokens as [Cursed], info tokens as «You are». */
export function nightTextPlain(segments: readonly NightTextSegment[]): string {
	return segments
		.map((s) =>
			s.kind === 'text'
				? s.text
				: s.kind === 'info'
					? `«${s.label}»`
					: `[${s.label ?? `reminder: ${s.options.join(' / ')}`}]`
		)
		.join('');
}
