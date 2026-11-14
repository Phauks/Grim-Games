/**
 * What the app assumes about a script's own character before the game (M85, Trevor
 * 2026-11-14: "allow storytellers to verify the functionality they should assume in the
 * game, such as night order and reminder tokens"), so the Storyteller can check it in the
 * setup Verification and correct it. Each part says where it came from: the script, the
 * character's own rules, or a guess the app made from the ability.
 */
import type {
	Character,
	CharacterId,
	NightSheet,
	ReminderLabel,
	Script
} from '#lib/core/data/types.ts';
import { homebrewJson } from '#lib/core/data/script.ts';
import { DAY_GROUP_TITLES } from '#lib/core/data/parts/day-reminders.ts';
import type { Night } from '#lib/core/model/overrides.ts';
import { actsTonight, nightOrder, type NightStep } from '#lib/core/rules/night/night-order.ts';
import { detectDayReminders } from '#lib/core/rules/day/day-reminders.ts';
import { setupModifierFor } from './setup-modifiers.ts';
import { textHash } from '#lib/core/text/hash.ts';

/**
 * Where an assumption came from: the script's own night order, the character's rules block,
 * a guess from its ability text, or nothing the app can work out.
 */
export type CheckSource = 'script' | 'rules' | 'guessed' | 'unknown';

/** Where it wakes on one night: after which step, in this game's order. */
export type NightCheck =
	| { wakes: false }
	| {
			wakes: true;
			after: Pick<NightStep, 'id' | 'kind' | 'character'> | undefined;
			source: CheckSource;
	  };

export interface DayCheck {
	text: string;
	source: CheckSource;
}

export interface CustomCheck {
	first: NightCheck;
	other: NightCheck;
	/** Its reminder tokens, its global ones after them. */
	reminders: readonly ReminderLabel[];
	/** Which seats its tokens go on: its rules, else every seat. Undefined without tokens. */
	placedOn?: CheckSource;
	/** Which of its tokens go out before the game: its rules, else none, which may be wrong. */
	beforeGame?: CheckSource;
	day: readonly DayCheck[];
	setup?: { summary: string; source: CheckSource };
	/** How many parts its own rules block has. */
	rules: number;
	/** How many parts are guesses or unknown, for the Storyteller to look at first. */
	guesses: number;
}

export interface CustomCheckInput {
	sheet: NightSheet;
	official: ReadonlyMap<CharacterId, Character>;
	/** Everything in play, the character included, as the board would run the night. */
	inPlay: readonly Character[];
	players: number;
	script: Script;
}

/** The characters in play that the script defines itself, once each, in play order. */
export function ownCharacters(inPlay: readonly Character[]): Character[] {
	const seen = new Set<CharacterId>();
	return inPlay.filter((c) => {
		if (c.edition !== undefined || seen.has(c.id)) return false;
		seen.add(c.id);
		return true;
	});
}

/**
 * A fingerprint of the character exactly as the script defines it: the Storyteller's check
 * holds while it stays the same, on any game with that script, and lapses once it changes.
 */
export function checkKey(character: Character): string {
	return `${character.id}:${textHash(JSON.stringify(homebrewJson(character)))}`;
}

function nightCheck(character: Character, night: Night, input: CustomCheckInput): NightCheck {
	if (!actsTonight(character, night)) return { wakes: false };
	const { steps } = nightOrder({
		night,
		sheet: input.sheet,
		official: input.official,
		inPlay: input.inPlay.some((c) => c.id === character.id)
			? input.inPlay
			: [...input.inPlay, character],
		players: input.players,
		customOrder: night === 'first' ? input.script.meta?.firstNight : input.script.meta?.otherNight
	});
	const at = steps.findIndex((s) => s.kind === 'character' && s.id === character.id);
	if (at < 0) return { wakes: false };
	const step = steps[at];
	const source: CheckSource =
		step.placement === 'custom-order'
			? 'script'
			: step.placement === 'night-sheet'
				? 'rules'
				: 'guessed';
	const before = steps[at - 1];
	const after = before && {
		id: before.id,
		kind: before.kind,
		...(before.character ? { character: before.character } : {})
	};
	return { wakes: true, after, source };
}

/** Everything the app assumes about one of the script's own characters. */
export function customCheck(character: Character, input: CustomCheckInput): CustomCheck {
	// Its own block as the script has it: no game yet, so no jinx patch or optional rule.
	const rules = character.rules;
	const reminders = [...character.reminders, ...character.remindersGlobal];
	const ruled = rules?.dayReminders?.reminders ?? [];
	const day: DayCheck[] = ruled.length
		? [...new Set(ruled.map((r) => DAY_GROUP_TITLES[r.group]))].map((text) => ({
				text,
				source: 'rules' as const
			}))
		: detectDayReminders(character).map((r) => ({
				text: r.segments.flatMap((s) => (s.kind === 'text' ? [s.text] : [])).join(' '),
				source: 'guessed' as const
			}));
	const modifier = setupModifierFor(character);
	const check: Omit<CustomCheck, 'guesses'> = {
		first: nightCheck(character, 'first', input),
		other: nightCheck(character, 'other', input),
		reminders,
		...(reminders.length
			? {
					placedOn: rules?.reminderTargets ? 'rules' : 'guessed',
					beforeGame: rules?.setupPrep ? 'rules' : 'unknown'
				}
			: {}),
		day,
		rules: Object.keys(rules ?? {}).length,
		...(modifier
			? {
					setup: {
						summary: modifier.summary,
						source: modifier.source === 'table' ? 'rules' : 'guessed'
					}
				}
			: {})
	};
	const sources = [
		check.first.wakes ? check.first.source : undefined,
		check.other.wakes ? check.other.source : undefined,
		check.placedOn,
		check.beforeGame,
		...day.map((d) => d.source),
		check.setup?.source
	];
	return {
		...check,
		guesses: sources.filter((s) => s === 'guessed' || s === 'unknown').length
	};
}
