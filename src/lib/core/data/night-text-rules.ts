/**
 * Our own Storyteller night text in place of the character's: the `nightText` part of its
 * rules block, read here and used by `rules/night-text.ts`. Per night (`first`, `other`):
 * - `reviewed`: Trevor's reviewed edit, always used;
 * - `full`: fuller text where TPI's does not say which reminder tokens to place or remove and
 *   when (Trevor asked for it, then parked it: shown only while `FULL_NIGHT_INSTRUCTIONS` is on).
 *
 * Text uses TPI's markup: `*TOKEN*` for one of the character's reminder tokens or an info token,
 * `*DEAD*` for the death marker. `full` text never uses `:reminder:` (it names the token
 * instead); a reviewed edit may keep the original's `:reminder:`s, mapped by its
 * `reminderPlaceholders`. Character names need no markup: they are always drawn as badges.
 *
 * Wording is short and our own, paraphrasing the character's wiki page; `reason` says in one
 * line why ours differs.
 */
import { checkKeys, describe, isObject, readString, type Issues } from './validate.ts';

export interface NightTextOverride {
	text: string;
	/** One line: why our text differs from the original. */
	reason: string;
}

export const NIGHT_TEXT_KINDS = ['reviewed', 'full'] as const;
export type NightTextKind = (typeof NIGHT_TEXT_KINDS)[number];

export type NightTextRules = Readonly<
	Partial<Record<'first' | 'other', Partial<Record<NightTextKind, NightTextOverride>>>>
>;

function readOverride(raw: unknown, path: string, issues: Issues): NightTextOverride | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['text', 'reason'], path, issues);
	const text = readString(raw, 'text', path, issues, true);
	const reason = readString(raw, 'reason', path, issues, true);
	return text === undefined || reason === undefined ? undefined : { text, reason };
}

/** Reads a `nightText` block. */
export function readNightText(
	raw: unknown,
	path: string,
	issues: Issues
): NightTextRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['first', 'other'], path, issues);
	const out: Partial<Record<'first' | 'other', Partial<Record<NightTextKind, NightTextOverride>>>> =
		{};
	for (const night of ['first', 'other'] as const) {
		const entry = raw[night];
		if (entry === undefined) continue;
		const at = `${path}.${night}`;
		if (!isObject(entry)) {
			issues.add(at, `expected object, got ${describe(entry)}`);
			continue;
		}
		checkKeys(entry, NIGHT_TEXT_KINDS, at, issues);
		const read: Partial<Record<NightTextKind, NightTextOverride>> = {};
		for (const kind of NIGHT_TEXT_KINDS) {
			if (entry[kind] === undefined) continue;
			const override = readOverride(entry[kind], `${at}.${kind}`, issues);
			if (override) read[kind] = override;
		}
		if (read.full?.text.includes(':reminder:')) {
			issues.add(`${at}.full.text`, 'uses :reminder:; name the token instead');
		}
		out[night] = read;
	}
	return out;
}
