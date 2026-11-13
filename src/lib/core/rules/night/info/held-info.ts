/**
 * One Day More's Signal Failure (https://beardytas.com/garden-of-djinn/one-day-more/): "There is
 * a 24 hour delay impacting all characters with abilities that know or learn information." A
 * rule source's `infoDelay` part says so; this file says which steps it holds back and what
 * each player receives the night after. The author's notes: "Information is backwards looking to
 * when the ability was used", and "Droisoning only affects the receiving of information".
 */
import type { InfoDelay } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import type { NightStep } from '#lib/core/rules/night/night-order.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import type { RuleSource } from '#lib/core/rules/rule-sources.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

type Info = Extract<DayEntry, { kind: 'info' }>;

/** The first rule source's `infoDelay` and its name, if any. */
export function infoDelayOf(
	sources: readonly RuleSource[]
): { rule: InfoDelay; by: string } | undefined {
	const source = sources.find((s) => s.rules.infoDelay);
	return source?.rules.infoDelay ? { rule: source.rules.infoDelay, by: source.name } : undefined;
}

/**
 * Whether the delay holds back this character's information: it gives some (`answers` or
 * `learns`), and the rule doesn't leave it out (the author's "The artist is also immune").
 */
export function delaysInfo(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: InfoDelay | undefined
): boolean {
	if (!rule || rule.except?.includes(characterId)) return false;
	const rules = rulesFor(game, characterId, characters);
	return !!(rules?.answers || rules?.learns);
}

/** One piece of information a player receives tonight, worked out last night. */
export interface HeldInfo {
	entryId: Info['entryId'];
	/** The day log's record of it ("Shown 0"). */
	text: string;
	/** What the player is shown: the record without its leading "Shown" ("0"). */
	shows: string;
	/**
	 * They are drunk or poisoned now, so what they receive may be false, whatever they were when
	 * it was worked out ("Droisoning only affects the receiving of information").
	 */
	impaired: boolean;
}

/**
 * What the player in `seatId` receives tonight for `characterId`: the information recorded for
 * them last night (the log the last dawn closed), oldest first. Nothing on the first night.
 */
export function heldInfo(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): HeldInfo[] {
	const last = game.pastDays.at(-1);
	if (!last) return [];
	const impaired = abilityState(game, seatId, characters).impairments.length > 0;
	return last.entries
		.filter((e): e is Info => e.kind === 'info')
		.filter((e) => e.seatId === seatId && e.characterId === characterId)
		.map((e) => ({
			entryId: e.entryId,
			text: e.text,
			shows: e.text.replace(/^Shown /, ''),
			impaired
		}));
}

/**
 * Tonight's steps with one more, before Dawn, for each character that received nothing tonight
 * but has information kept from last night: a first-night-only character such as the Chef
 * learns its number on the second night. Only while a rule delays its information.
 */
export function withHeldInfoSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	rule: InfoDelay | undefined
): (T | NightStep)[] {
	const last = game.pastDays.at(-1);
	if (!rule || !last) return [...steps];
	const out: (T | NightStep)[] = [...steps];
	const held = new Set(
		last.entries.flatMap((e) => (e.kind === 'info' && game.seats[e.seatId] ? [e.characterId] : []))
	);
	for (const id of held) {
		if (out.some((s) => s.character?.id === id) || !delaysInfo(game, id, characters, rule))
			continue;
		const character = characters.get(id);
		if (!character) continue;
		const dawn = out.findIndex((s) => s.id === 'dawn');
		out.splice(dawn >= 0 ? dawn : out.length, 0, {
			id: character.id,
			kind: 'character',
			character,
			afterDawn: false,
			placement: 'unplaced',
			heldInfo: true,
			notes: []
		});
	}
	return out;
}
