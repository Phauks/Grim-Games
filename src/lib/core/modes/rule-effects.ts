/**
 * What a game's rule sources change on the board, worked out from the game. A rule source is a
 * Fabled or Loric in play, or the game mode and special rules the game is played with: each has
 * a rules block (M61e, the same parts a character's has, `data/parts/`), read here the same way
 * for all of them, so a homebrew Fabled can do what a special rule does and the other way
 * round. The board shows them; the Storyteller decides (warn, never lock).
 */
import type {
	CharacterRules,
	DeadKeepAbilities,
	NightWake
} from '#lib/core/data/character-rules.ts';
import type { CharacterId, CharacterName, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { nominatedEffectHolds } from '#lib/core/rules/nominations.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** One rule source in a game: a Fabled or Loric in play, or a mode or special rule file. */
export interface RuleSource {
	/** The character's id, or the file's. */
	id: string;
	/** Shown at the top of whatever the source sets off: a character's name, or a file's. */
	name: CharacterName | string;
	/** Text the source shows with a step it adds (a rule's own lines). */
	text?: readonly string[];
	rules: CharacterRules;
}

/** A mode or special rule file with a rules block, as the game keeps it. */
export interface RuleFile {
	id: string;
	name: string;
	rules?: CharacterRules;
	setup: { text?: string[] };
}

/**
 * The game's rule sources, in order: each Fabled and Loric in play with a rules block (as it
 * is in the game, `rulesFor`), then each file with one, in the order given.
 */
export function ruleSources(
	game: Game,
	characters: CharacterLookup,
	files: readonly RuleFile[]
): RuleSource[] {
	const characterSources = game.ruleCharacters.flatMap((id): RuleSource[] => {
		const rules = rulesFor(game, id, characters);
		return rules ? [{ id, name: characters.get(id)?.name ?? id, rules }] : [];
	});
	const fileSources = files.flatMap((file): RuleSource[] =>
		file.rules
			? [
					{
						id: file.id,
						name: file.name,
						...(file.setup.text?.length ? { text: file.setup.text } : {}),
						rules: file.rules
					}
				]
			: []
	);
	return [...characterSources, ...fileSources];
}

/** The first rule source's `deadKeepAbilities`, if any (The Phantom Detectives). */
export function deadKeepRule(sources: readonly RuleSource[]): DeadKeepAbilities | undefined {
	return sources.find((s) => s.rules.deadKeepAbilities)?.rules.deadKeepAbilities;
}

/**
 * Whether a player has their ability: alive, as usual; under `deadKeepAbilities`, dead players
 * keep it except `deadLose` types, and living `livingLose` types have none until they die
 * (https://schnauzerclub.neocities.org/scripts/thephantomdetectives).
 */
export function hasAbilityUnder(
	rule: DeadKeepAbilities | undefined,
	dead: boolean,
	type: CharacterType | undefined
): boolean {
	if (!rule) return !dead;
	const lost = dead ? rule.deadLose : rule.livingLose;
	return type === undefined || !(lost as readonly string[]).includes(type);
}

/** Whether this seat's player has their ability under the rule, by their true character. */
export function seatHasAbility(
	rule: DeadKeepAbilities | undefined,
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): boolean {
	return hasAbilityUnder(rule, !!game.seats[seatId]?.dead, typeOf(game, seatId, characters));
}

/** The first rule source whose Demon attacks in script order (`demonAttack.target`). */
export function scriptOrderSource(sources: readonly RuleSource[]): RuleSource | undefined {
	return sources.find((s) => s.rules.demonAttack?.target === 'script-order');
}

const scriptIds = (game: Game): CharacterId[] =>
	game.script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id));

/**
 * Trained Killer (https://beardytas.com/garden-of-djinn/trained-killer/): the next living
 * in-play character in script order. The page recommends carrying on from the furthest point
 * reached, so it starts after the furthest character the Demon killed (dead with the death
 * cause "demon"), from the top when none, and wraps round at the end (the page doesn't say).
 * Characters off the script are skipped, and so are Demons (our reading: the Demon attacks
 * others). Undefined when no one is left.
 */
export function nextScriptOrderTarget(game: Game, characters: CharacterLookup): SeatId | undefined {
	const order = scriptIds(game);
	const seats = game.seating
		.map((seatId) => {
			const id = trueCharacter(game, seatId, characters);
			return { seatId, at: id === undefined ? -1 : order.indexOf(id) };
		})
		.filter(({ seatId, at }) => at >= 0 && typeOf(game, seatId, characters) !== 'demon')
		.sort((a, b) => a.at - b.at);
	const killed = seats.filter(
		({ seatId }) => game.seats[seatId].dead && game.seats[seatId].deathCause === 'demon'
	);
	const furthest = killed.length ? Math.max(...killed.map((s) => s.at)) : -1;
	const living = seats.filter(({ seatId }) => !game.seats[seatId].dead);
	return (living.find((s) => s.at > furthest) ?? living[0])?.seatId;
}

/** Each rule source's night wakes for the dead on night `number` (Council of the Dead). */
export function deadWakesOn(
	sources: readonly RuleSource[],
	number: number
): { source: RuleSource; wake: NightWake; index: number }[] {
	return sources.flatMap((source) =>
		(source.rules.nightWakes ?? []).flatMap((wake, index) =>
			wake.when === 'one-night' && wake.night === number && wake.dead
				? [{ source, wake, index }]
				: []
		)
	);
}

/** The rule source's effects a nomination sets off for every nomination. */
const ANY_NOMINATION = ['evil-swap', 'nominator-may-die'] as const;
type AnyNominationEffect = (typeof ANY_NOMINATION)[number];

/** A nomination's effect the board offers the Storyteller, from the rule source named `rule`. */
export interface NominationPrompt {
	kind: AnyNominationEffect;
	/** The rule source's name: a Fabled's or Loric's, or a file's. */
	rule: CharacterName | string;
	nominator: SeatId;
	nominee: SeatId;
}

/**
 * What this nomination sets off under the game's rule sources (`onNominated`), each only while
 * it can happen (`nominatedEffectHolds`), so a prompt never asks about something that can't:
 * - The Warrens (https://beardytas.com/garden-of-djinn/the-warrens/): `evil-swap`.
 * - The Djinn's Bargain (https://beardytas.com/garden-of-djinn/the-djinns-bargain/):
 *   `nominator-may-die`.
 * A rule source has no player of its own, so only these effects, about any nomination, apply.
 */
export function nominationPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	sources: readonly RuleSource[],
	characters: CharacterLookup
): NominationPrompt[] {
	return sources.flatMap((source): NominationPrompt[] => {
		const rule = source.rules.onNominated;
		if (!rule || !(ANY_NOMINATION as readonly string[]).includes(rule.effect)) return [];
		if (!nominatedEffectHolds(game, nomination, rule, characters)) return [];
		return [{ kind: rule.effect as AnyNominationEffect, rule: source.name, ...nomination }];
	});
}
