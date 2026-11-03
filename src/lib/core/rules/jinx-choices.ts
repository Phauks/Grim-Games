/**
 * A jinx that gives a character a choice each night but the first (`nightChoice` in its
 * `jinxes` block, `data/jinx-rules.ts`): the Leviathan and Riot choose an alive player (a
 * good one, for most partners) not chosen on an earlier night, and a chosen partner uses its
 * ability without dying, or the Banshee dies and gains its ability
 * (https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes,
 * https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes).
 *
 * The choice is made every night while the jinx is in effect, partner in play or not, so the
 * choice itself gives nothing away. It is a night step of its own, placed before the first of
 * its partners' steps on the night sheet, so a chosen partner still acts in its own step that
 * night. The Storyteller records whom the character chose as an `ability` entry in the day
 * log (`UseAbility` with `on`): tonight's choice is the latest in today's log, and earlier
 * nights' are in the past days' logs. Every check here only warns (faded seats, an alert on
 * the partner's step); the Storyteller can choose anyone.
 */
import type { NightChoice } from '#lib/core/data/jinx-rules.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayEntry, DayEntryId, Game, SeatId } from '#lib/core/model/types.ts';
import { ownJinxEffects } from './jinxes.ts';
import type { Night, NightStep } from './night-order.ts';

/** A character in play whose jinxes give it a night choice, with each partner's rule. */
export interface NightChooser {
	characterId: CharacterId;
	partners: { partner: CharacterId; choice: NightChoice }[];
	/** `good` when any partner's rule limits the choice to good players. */
	who: NightChoice['chooses'];
}

/** What the step for a jinx's night choice carries (`withJinxChoiceSteps`). */
export interface JinxChoiceStep {
	characterId: CharacterId;
	partners: CharacterId[];
	who: NightChoice['chooses'];
}

/** The id of the night step for `characterId`'s jinx choice. */
export const jinxChoiceStepId = (characterId: CharacterId): string => `jinx-choice:${characterId}`;

/**
 * The characters on the board (by token or true character) whose jinxes in effect give them
 * a night choice, in seating order.
 */
export function nightChoosers(game: Game, characters: CharacterLookup): NightChooser[] {
	const ids = new Set<CharacterId>();
	for (const s of game.seating) {
		const token = game.seats[s]?.characterId;
		if (token) ids.add(token);
		const own = trueCharacter(game, s, characters);
		if (own) ids.add(own);
	}
	return [...ids].flatMap((characterId) => {
		const partners = ownJinxEffects(game, characterId, 'nightChoice', characters).map(
			({ partner, effect }) => ({ partner, choice: effect })
		);
		if (partners.length === 0) return [];
		const who = partners.some((p) => p.choice.chooses === 'good') ? 'good' : 'any';
		return [{ characterId, partners, who }];
	});
}

/**
 * Adds a step for each jinx night choice on other nights: the chooser's own character, with
 * our text, before the first step the night sheet (`order`) puts at or after its earliest
 * partner, else before Dawn. A step already there (by id) is left alone.
 */
export function withJinxChoiceSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	order: readonly string[] = []
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	if (night !== 'other') return out;
	for (const chooser of nightChoosers(game, characters)) {
		const character = characters.get(chooser.characterId);
		const id = jinxChoiceStepId(chooser.characterId);
		if (!character || out.some((s) => s.id === id)) continue;
		const step: NightStep = {
			id,
			kind: 'character',
			character,
			reminder: choiceText(character, chooser.who),
			afterDawn: false,
			placement: 'night-sheet',
			notes: [],
			jinxChoice: {
				characterId: chooser.characterId,
				partners: chooser.partners.map((p) => p.partner),
				who: chooser.who
			}
		};
		const sheet = chooser.partners.map((p) => order.indexOf(p.partner)).filter((i) => i >= 0);
		const first = sheet.length > 0 ? Math.min(...sheet) : -1;
		const before = first < 0 ? -1 : out.findIndex((s) => order.indexOf(s.id) >= first);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		out.splice(before >= 0 ? before : dawn >= 0 ? dawn : out.length, 0, step);
	}
	return out;
}

function choiceText(character: Character, who: NightChoice['chooses']): string {
	const player = who === 'good' ? 'an alive good player' : 'an alive player';
	return `Wake the ${character.name}: they choose ${player} not chosen on an earlier night.`;
}

type AbilityEntry = Extract<DayEntry, { kind: 'ability' }>;

const choices = (entries: readonly DayEntry[], chooser: CharacterId) =>
	entries.filter(
		(e): e is AbilityEntry & { on: SeatId } =>
			e.kind === 'ability' && e.characterId === chooser && e.on !== undefined
	);

/** Whom `chooser` chose tonight: the latest such entry in today's log. */
export function jinxChoiceTonight(
	game: Game,
	chooser: CharacterId
): { entryId: DayEntryId; seatId: SeatId; by: SeatId } | undefined {
	const last = choices(game.today.entries, chooser).at(-1);
	return last && { entryId: last.entryId, seatId: last.on, by: last.seatId };
}

/** The players `chooser` chose on earlier nights, from the past days' logs. */
export function chosenBefore(game: Game, chooser: CharacterId): Set<SeatId> {
	return new Set(game.pastDays.flatMap((day) => choices(day.entries, chooser).map((e) => e.on)));
}

/**
 * The seats that don't fit `chooser`'s choice tonight, faded but still choosable: the dead,
 * those chosen on an earlier night, and with `who: "good"` the evil.
 */
export function jinxChoiceMisfits(game: Game, chooser: NightChooser): Set<SeatId> {
	const before = chosenBefore(game, chooser.characterId);
	return new Set(
		game.seating.filter(
			(s) =>
				game.seats[s]?.dead ||
				before.has(s) ||
				(chooser.who === 'good' && alignmentOf(game, s) === 'evil')
		)
	);
}

/** A jinxed partner chosen tonight, who acts or dies by the choice. */
export interface JinxChosen {
	/** The chosen player. */
	seatId: SeatId;
	partner: CharacterId;
	/** The chooser's character, and its player as recorded. */
	by: { characterId: CharacterId; seatId: SeatId };
	outcome: NightChoice['partner'];
}

/**
 * The players chosen tonight whose true character is a partner of the chooser's jinx: each
 * uses its ability without dying, or dies and gains it (`outcome`).
 */
export function jinxChosenTonight(game: Game, characters: CharacterLookup): JinxChosen[] {
	return nightChoosers(game, characters).flatMap((chooser) => {
		const tonight = jinxChoiceTonight(game, chooser.characterId);
		if (!tonight) return [];
		const own = trueCharacter(game, tonight.seatId, characters);
		const hit = chooser.partners.find((p) => p.partner === own);
		if (!hit) return [];
		return [
			{
				seatId: tonight.seatId,
				partner: hit.partner,
				by: { characterId: chooser.characterId, seatId: tonight.by },
				outcome: hit.choice.partner
			}
		];
	});
}
