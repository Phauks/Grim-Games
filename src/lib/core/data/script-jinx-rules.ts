/**
 * Rules on a script's own jinxes (M40). A script entry's `jinxes` list may give each jinx a
 * `rules` object as well as its `reason`:
 *
 * ```json
 * { "id": "lamplighter", "team": "townsfolk", "ability": "…",
 *   "jinxes": [{ "id": "fortuneteller", "reason": "…",
 *                "rules": { "impairs": { "who": "partner", "kind": "drunk", "when": ["self-in-play"] } } }] }
 * ```
 *
 * `rules` is one entry of a rules block's `jinxes` (`jinx-rules.ts`): the same verbs, `who` and
 * `when`, read by the same `readJinxRules`. `self` is the character whose entry holds the jinx
 * (a custom character, or an official one listed as `{ "id": "spy", "jinxes": […] }`), and
 * `partner` the jinx's `id`. A script's jinx replaces TPI's for that pair, so the app uses only
 * these rules for it, and a script jinx with no `rules` is text only (`rules/jinx-pairs.ts`,
 * `rulesForJinx`). A custom character's own `rules.jinxes` is read the same way.
 *
 * A jinx with no `rules` whose wording is TPI's own for the pair is a copy, not a script's
 * jinx, so TPI's stays in effect with its rules (`officialReason`).
 *
 * Rules the app can't use never block the script: each is dropped with a load warning, and the
 * jinx stays as text. That covers a bad shape, and a verb whose prerequisite is missing on
 * either character (`JINX_NEEDS`: `carriedBy` needs a `carrierIsDemon` token). Rules that load
 * but can never change anything are kept, with a warning that says why (`jinxNoOps`, M44).
 *
 * Two jinxes for the same pair on one script: the last one counts (`scriptJinxFor`).
 */
import { readableRules, type CharacterRules } from './character-rules.ts';
import { jinxPartnerIssues } from './jinx-needs.ts';
import { jinxNoOps, type NoOpContext } from './jinx-no-ops.ts';
import type { JinxRules } from './jinx-rules.ts';
import { readJinxRules } from './jinx-read.ts';
import type { Character, CharacterId, Jinx } from './types.ts';
import { Issues, isObject, type Json } from './validate.ts';

/** A jinx read from a script entry, with its `rules` not yet checked. */
export interface PendingJinx {
	jinx: Jinx;
	rules?: unknown;
	/** Where the entry is, for the warning ("Entry 4 (lamplighter)"). */
	where: string;
}

type Warn = (where: string, message: string) => void;

/** `obj` without its `key`. */
function without<T extends object>(obj: T, key: string): T {
	const out = { ...obj } as Record<string, unknown>;
	delete out[key];
	return out as T;
}

const plain = (list: readonly string[], prefix: string) =>
	list.map((line) => line.replace(prefix, 'rules')).join('; ');

/**
 * The rules each script character has, as the script's jinxes see them: a custom character's
 * own block, else our overlay file. `jinxes` holds only the script's own, since a script's jinx
 * ignores our files for its pair.
 */
function scriptRules(
	characters: readonly Character[],
	homebrew: ReadonlySet<CharacterId>
): (id: CharacterId) => Json | undefined {
	const byId = new Map(characters.map((c) => [c.id, c]));
	return (id) => {
		const c = byId.get(id);
		if (!c) return undefined;
		const rules = c.rules ?? ({} as CharacterRules);
		const rest = without(rules, 'jinxes');
		const own = homebrew.has(id) ? c.rules?.jinxes : undefined;
		return { ...rest, ...(own ? { jinxes: own } : {}) } as Json;
	};
}

/** The problems with one jinx's `rules` between `self` and `partner`, or none. */
function issuesOf(
	raw: unknown,
	self: CharacterId,
	partner: CharacterId,
	rulesFor: (id: CharacterId) => Json | undefined
): { rules?: JinxRules; issues: string[] } {
	const issues = new Issues();
	const read = readJinxRules({ [partner]: raw }, 'rules', issues, rulesFor(self) ?? {});
	const rules = read?.[partner];
	if (rules && issues.list.length === 0) {
		const lookup = (id: CharacterId) =>
			(id === partner ? rulesFor(id) : undefined) as
				{ jinxes?: Readonly<Record<CharacterId, JinxRules>> } | undefined;
		jinxPartnerIssues(self, { [partner]: rules }, lookup, 'rules', issues);
	}
	return issues.list.length > 0 ? { issues: issues.list } : { rules, issues: [] };
}

/**
 * The script's jinxes with their `rules` checked: a jinx keeps rules the app can use, and loses
 * any it can't, with a warning that it is text only. Custom characters' own `rules.jinxes`
 * entries are checked against their partners too, and one that fails is dropped the same way.
 */
export function checkScriptJinxRules(
	pending: readonly PendingJinx[],
	characters: Character[],
	homebrew: readonly CharacterId[],
	whereOf: ReadonlyMap<CharacterId, string>,
	officialReason: (a: CharacterId, b: CharacterId) => string | undefined,
	warn: Warn
): Jinx[] {
	const custom = new Set(homebrew);
	const rulesFor = scriptRules(characters, custom);
	const name = (id: CharacterId) => characters.find((c) => c.id === id)?.name ?? id;
	const same = (a: string, b: string | undefined) =>
		b !== undefined && a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
	const ids = new Set(characters.map((c) => c.id));
	const noOps: NoOpContext = {
		typeOf: (id) => characters.find((c) => c.id === id)?.type,
		rulesOf: (id) => rulesFor(id) as CharacterRules | undefined,
		onScript: (id) => ids.has(id),
		name
	};
	/** Warns, keeping the rules, about each one of them that can never change anything. */
	const warnNoOps = (
		where: string,
		lead: string,
		rules: JinxRules,
		self: string,
		partner: string
	) =>
		jinxNoOps(rules, self, partner, noOps).forEach((why) =>
			warn(where, `${lead} ${name(partner)} load, but ${why}.`)
		);
	const out = pending.flatMap(({ jinx, rules, where }): Jinx[] => {
		const text = without(jinx, 'rules');
		if (rules === undefined)
			return same(jinx.reason, officialReason(...jinx.characters)) ? [] : [text];
		const [self, partner] = jinx.characters;
		const checked = issuesOf(rules, self, partner, rulesFor);
		if (checked.rules) {
			warnNoOps(where, 'The rules of the jinx with', checked.rules, self, partner);
			return [{ ...text, rules: checked.rules }];
		}
		warn(
			where,
			`The rules of the jinx with ${name(partner)} can't be used, so it is text only: ${plain(checked.issues, `rules.${partner}`)}.`
		);
		return [text];
	});
	characters.forEach((c, i) => {
		const jinxes = custom.has(c.id) ? c.rules?.jinxes : undefined;
		if (!jinxes) return;
		const kept: Record<CharacterId, JinxRules> = {};
		for (const [partner, rules] of Object.entries(jinxes)) {
			const issues = new Issues();
			const lookup = (id: CharacterId) =>
				rulesFor(id) as { jinxes?: Record<CharacterId, JinxRules> } | undefined;
			jinxPartnerIssues(c.id, { [partner]: rules }, lookup, 'rules', issues);
			if (issues.list.length === 0) {
				kept[partner] = rules;
				warnNoOps(whereOf.get(c.id) ?? c.name, 'Its rules for the jinx with', rules, c.id, partner);
			} else
				warn(
					whereOf.get(c.id) ?? c.name,
					`Its rules for the jinx with ${name(partner)} can't be used, so they were left out: ${plain(issues.list, `rules.${partner}`)}.`
				);
		}
		if (Object.keys(kept).length === Object.keys(jinxes).length) return;
		const rest = without(c.rules!, 'jinxes');
		const rules = Object.keys(kept).length > 0 ? { ...rest, jinxes: kept } : rest;
		characters[i] = { ...c, rules };
	});
	return out;
}

/**
 * A custom character's raw `rules` with each `jinxes` entry the app can't read taken out, so
 * one bad jinx never stops the character from loading. Each dropped entry is a warning.
 */
export function withReadableJinxes(raw: unknown, where: string, warn: Warn): unknown {
	if (!isObject(raw) || raw.jinxes === undefined) return raw;
	const kept: Json = {};
	if (!isObject(raw.jinxes)) warn(where, 'Ignored its rules for jinxes: expected an object.');
	else
		for (const [partner, entry] of Object.entries(raw.jinxes)) {
			const issues = new Issues();
			readJinxRules({ [partner]: entry }, 'rules', issues, raw);
			if (issues.list.length === 0) kept[partner] = entry;
			else
				warn(
					where,
					`Its rules for the jinx with ${partner} can't be used, so they were left out: ${plain(issues.list, `rules.${partner}`)}.`
				);
		}
	const rest = without(raw, 'jinxes');
	return Object.keys(kept).length > 0 ? { ...rest, jinxes: kept } : rest;
}

/**
 * A custom character's raw `rules` with every rule the app can't read left out, never the whole
 * character (M58): a jinx rule one partner at a time (`withReadableJinxes`), any other rule key
 * by key. `reminders` are its raw reminder lists, whose labels a rule may name. Each dropped rule is a warning.
 */
export function withReadableRules(
	raw: unknown,
	reminders: readonly unknown[],
	where: string,
	warn: Warn
): unknown {
	const labels = reminders.flatMap((l) =>
		Array.isArray(l) ? l.filter((r): r is string => typeof r === 'string') : []
	);
	const { rules, dropped } = readableRules(withReadableJinxes(raw, where, warn), labels);
	for (const { key, problems } of dropped)
		warn(where, `Ignored its rule "${key}", which this app can't use: ${problems.join('; ')}.`);
	return rules;
}
