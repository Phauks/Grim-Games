/**
 * Registration: a player who may register as another alignment or character type, by their
 * own or another character's ability (the Spy, the Recluse, the Lycanthrope's Faux Paw), and
 * the combined worlds of every player's registration that night info is checked against.
 */
import {
	ALIGNMENTS,
	SEATED_TYPES,
	type Alignment,
	type CharacterId,
	type CharacterType
} from '#lib/core/data/types.ts';
import { type CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilitiesOfSeat, hasAbilityOf } from './gained-abilities.ts';
import { ownJinxRules, registeredTo } from '#lib/core/rules/jinxes/jinxes.ts';
import { jinxApplies } from '#lib/core/rules/jinxes/jinx-when.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

import { abilityState, type AbilitySource, wikiOf } from './ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * A player who may register as another alignment or character type, by their own or
 * another character's ability. The first alignment and type are the true ones, except
 * where registration is fixed (the Lycanthrope's Faux Paw player always registers evil).
 */
export interface Registration {
	seatId: SeatId;
	alignments: Alignment[];
	types: CharacterType[];
	source: AbilitySource;
	wiki: string;
}

/**
 * Players whose registration is the Storyteller's choice, or fixed by an ability, as each
 * character's `registersAs` rules say:
 * - the Recluse might register as evil and as a Minion or Demon, even if dead
 *   (https://wiki.bloodontheclocktower.com/Recluse);
 * - the Spy might register as good and as a Townsfolk or Outsider, even if dead
 *   (https://wiki.bloodontheclocktower.com/Spy);
 * - the Lycanthrope's Faux Paw player is good but registers as evil
 *   (https://wiki.bloodontheclocktower.com/Lycanthrope);
 * - the Revolutionary's two "Aligned" players might register as anything while "Register
 *   Falsely?" is still in play: once it has been used, it comes off
 *   (https://wiki.bloodontheclocktower.com/Revolutionary).
 * A drunk or poisoned Recluse or Spy registers truly: they have no ability.
 * A player holding such an ability registers by it too (the Hermit with the Recluse's,
 * https://wiki.bloodontheclocktower.com/Hermit).
 *
 * With `viewer`, the character whose ability is asking, a jinx with it may change how a
 * player registers (`registersTo`, whatever that player's own ability's state): the
 * Politician might register as evil to Legion
 * (https://wiki.bloodontheclocktower.com/Politician#Related_Jinxes), the Summoner registers as
 * the Demon to the Clockmaker (https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes).
 */
export function registrations(
	game: Game,
	characters: CharacterLookup,
	viewer?: CharacterId
): Registration[] {
	const out: Registration[] = [];
	for (const seatId of game.seating) {
		const own = ownRegistration(game, seatId, characters);
		const id = trueCharacter(game, seatId, characters);
		const jinx = viewer && id ? ownJinxRules(game, id, viewer, characters)?.registersTo : undefined;
		// Its `when` is about this player (a third character in play, M44).
		const rule =
			jinx && jinxApplies(game, id!, viewer!, jinx, characters, { seatId }) ? jinx : undefined;
		const alignment = alignmentOf(game, seatId);
		const type = typeOf(game, seatId, characters);
		if (!rule || !id || !alignment || !type) {
			if (own) out.push(own);
			continue;
		}
		const to = registeredTo(own ?? { alignments: [alignment], types: [type] }, rule);
		// Registering only as they truly are is no registration at all.
		const truly = (list: readonly string[], value: string) =>
			list.length === 1 && list[0] === value;
		if (truly(to.alignments, alignment) && truly(to.types, type)) continue;
		out.push({
			seatId,
			...to,
			source: own?.source ?? { characterId: id, seatId },
			wiki: own?.wiki ?? wikiOf(id, characters)
		});
	}
	return out;
}

/** How one player may register to everyone, by their own or another character's ability. */
function ownRegistration(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): Registration | undefined {
	const id = trueCharacter(game, seatId, characters);
	const alignment = alignmentOf(game, seatId);
	const type = typeOf(game, seatId, characters);
	if (!alignment || !type) return undefined;
	// Their own character's, else another ability they have: held (the Hermit's Recluse) or
	// gained (the Cannibal who ate the Recluse, https://wiki.bloodontheclocktower.com/Cannibal).
	const mine = id ? rulesFor(game, id, characters)?.registersAs?.self : undefined;
	const by =
		id && mine && abilityState(game, seatId, characters).works
			? id
			: abilitiesOfSeat(game, seatId, characters).find(
					(a) =>
						a.how !== 'own' &&
						rulesFor(game, a.characterId, characters)?.registersAs?.self &&
						hasAbilityOf(game, seatId, a.characterId, characters)
				)?.characterId;
	const self = by ? rulesFor(game, by, characters)?.registersAs?.self : undefined;
	if (by && self) {
		return {
			seatId,
			alignments: [alignment, ...(self.alignments ?? [])].filter(
				(a, i, all): a is Alignment => all.indexOf(a) === i
			),
			types: [type, ...(self.types ?? [])].filter(
				(t, i, all): t is CharacterType => all.indexOf(t) === i
			),
			source: { characterId: by, seatId },
			wiki: wikiOf(by, characters)
		};
	}
	for (const token of game.seats[seatId].reminders) {
		const rule = rulesFor(game, token.characterId, characters)?.registersAs?.tokens?.[token.label];
		if (!rule || (rule.carrierAlignment && rule.carrierAlignment !== alignment)) continue;
		if (rule.whileToken && !inPlayToken(game, token.characterId, rule.whileToken)) continue;
		const source = game.seating.find(
			(s) =>
				trueCharacter(game, s, characters) === token.characterId &&
				abilityState(game, s, characters).works
		);
		// A Fabled has no seat: its tokens work while it is in play.
		if (!source && !game.ruleCharacters.includes(token.characterId)) continue;
		const fixed = rule.asAnything
			? { alignments: [alignment, ...ALIGNMENTS], types: [type, ...SEATED_TYPES] }
			: { alignments: rule.alignments ?? [alignment], types: rule.types ?? [type] };
		return {
			seatId,
			alignments: fixed.alignments.filter((a, i, all): a is Alignment => all.indexOf(a) === i),
			types: fixed.types.filter((t, i, all): t is CharacterType => all.indexOf(t) === i),
			source: {
				characterId: token.characterId,
				...(source ? { seatId: source } : {}),
				reminderId: token.reminderId
			},
			wiki: wikiOf(token.characterId, characters)
		};
	}
	return undefined;
}

/** Whether `characterId`'s reminder `label` is on any seat. */
function inPlayToken(game: Game, characterId: CharacterId, label: string): boolean {
	return game.seating.some((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
}

/** How every player registers in one possible world. */
export interface RegistrationWorld {
	alignment: (seatId: SeatId) => Alignment | undefined;
	type: (seatId: SeatId) => CharacterType | undefined;
	/**
	 * Seats registering as something other than their true alignment or type here, and
	 * players whose alignment is not set yet (a Traveller's) when this world gives it one.
	 */
	misregistered: SeatId[];
}

/** At most this many worlds are enumerated; beyond it, the rest are not considered. */
const MAX_WORLDS = 4096;

/**
 * Every way the players may register. The first world is the default: everyone as they
 * truly are, apart from fixed registrations (Faux Paw), so it gives the true answer.
 *
 * A player with a character but no alignment yet (a Traveller whose alignment the
 * Storyteller has not chosen, https://wiki.bloodontheclocktower.com/Travellers) is
 * unknown: no alignment in the default world, then good and evil in the others, where they
 * count as `misregistered` so answers that depend on them are marked.
 */
export function registrationWorlds(
	game: Game,
	characters: CharacterLookup,
	regs: readonly Registration[] = registrations(game, characters)
): RegistrationWorld[] {
	type Choice = { seatId: SeatId; alignment?: Alignment; type: CharacterType };
	const unset: Registration[] = game.seating.flatMap((seatId) => {
		const type = typeOf(game, seatId, characters);
		const id = trueCharacter(game, seatId, characters);
		if (alignmentOf(game, seatId) !== undefined || !type || !id) return [];
		return [
			{
				seatId,
				alignments: ['good', 'evil'],
				types: [type],
				source: { characterId: id, seatId },
				wiki: `${W}Travellers`
			}
		];
	});
	let combos: Choice[][] = [[]];
	for (const reg of [...regs, ...unset]) {
		const options: (Alignment | undefined)[] = unset.includes(reg)
			? [undefined, ...reg.alignments]
			: reg.alignments;
		const next: Choice[][] = [];
		for (const combo of combos) {
			for (const alignment of options) {
				for (const type of reg.types) {
					if (next.length < MAX_WORLDS)
						next.push([
							...combo,
							{ seatId: reg.seatId, ...(alignment ? { alignment } : {}), type }
						]);
				}
			}
		}
		combos = next;
	}
	return combos.map((combo) => {
		const bySeat = new Map(combo.map((c) => [c.seatId, c]));
		return {
			alignment: (s) => bySeat.get(s)?.alignment ?? alignmentOf(game, s),
			type: (s) => bySeat.get(s)?.type ?? typeOf(game, s, characters),
			misregistered: combo
				.filter(
					(c) =>
						c.alignment !== alignmentOf(game, c.seatId) ||
						c.type !== typeOf(game, c.seatId, characters)
				)
				.map((c) => c.seatId)
		};
	});
}
