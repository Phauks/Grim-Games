/**
 * Kills that were tried at night but didn't happen, for the day screen's "what didn't
 * happen" view (Trevor, 2026-10-16: "as a storyteller, i would put the imp dead token on
 * the soldier, and then would calculate after that they did not die").
 *
 * The record is the killer's own "Dead" reminder: a player who carries it but is still
 * alive was chosen and survived. For each one, the grimoire says why, from the same rules
 * the night alerts use:
 * - `protected`: the Storyteller's "can't die" override, the Sailor, the Soldier or Monk
 *   against the Demon, the Tea Lady or the Innkeeper (`protection`);
 * - `killer-impaired`: the killer was drunk, poisoned or had no ability, so its ability did
 *   nothing (https://wiki.bloodontheclocktower.com/Glossary: drunk and poisoned players
 *   have no ability);
 * - `fool`: the Fool survives their first death (https://wiki.bloodontheclocktower.com/Fool);
 * - `mayor`: a Demon kill on the Mayor may land on someone else
 *   (https://wiki.bloodontheclocktower.com/Mayor).
 * Several reasons can apply at once; none means the Storyteller made a call the board
 * doesn't show (`because` is empty). Data only, no wording: the UI shows the characters'
 * TPI ability text.
 *
 * The Zombuul's "Dead" is not a kill marker: it marks the Zombuul registering as dead
 * (`REGISTERS_AS_DEAD_REMINDERS`), so it is skipped.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { REGISTERS_AS_DEAD_REMINDERS, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { abilityState, protection, type AbilitySource, type Impairment } from './ability.ts';
import { NIGHT_KILLERS } from './night-alerts.ts';

export type PreventedBecause =
	| { kind: 'protected'; source: AbilitySource | 'override' }
	| { kind: 'killer-impaired'; seatId: SeatId; impairments: Impairment[] }
	| { kind: 'fool'; seatId: SeatId }
	| { kind: 'mayor'; seatId: SeatId };

export interface PreventedDeath {
	/** The character whose "Dead" token is on the survivor. */
	killer: CharacterId;
	/** Seats holding the killer (true character or token); empty when it is out of play. */
	killerSeats: SeatId[];
	seatId: SeatId;
	reminderId: ReminderId;
	because: PreventedBecause[];
}

function seatsOf(game: Game, id: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(s) => game.seats[s].characterId === id || trueCharacter(game, s, characters) === id
	);
}

/** Survivors of tonight's kills, in seating order. */
export function preventedDeaths(game: Game, characters: CharacterLookup): PreventedDeath[] {
	const out: PreventedDeath[] = [];
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		if (seat.dead) continue;
		for (const reminder of seat.reminders) {
			const killer = NIGHT_KILLERS[reminder.characterId];
			if (!killer || reminder.label !== 'Dead') continue;
			if (
				REGISTERS_AS_DEAD_REMINDERS.some(
					(r) => r.characterId === reminder.characterId && r.label === reminder.label
				)
			)
				continue;

			const killerSeats = seatsOf(game, reminder.characterId, characters);
			const because: PreventedBecause[] = [];
			for (const s of killerSeats) {
				const state = abilityState(game, s, characters);
				if (state.impairments.length > 0)
					because.push({ kind: 'killer-impaired', seatId: s, impairments: state.impairments });
			}
			if (!killer.ignoresProtection) {
				const source = protection(game, seatId, characters, killer.by);
				if (source) because.push({ kind: 'protected', source });
			}
			const target = trueCharacter(game, seatId, characters);
			const works = abilityState(game, seatId, characters).works;
			if (target === 'fool' && works) because.push({ kind: 'fool', seatId });
			if (target === 'mayor' && killer.by === 'demon' && works)
				because.push({ kind: 'mayor', seatId });

			out.push({
				killer: reminder.characterId,
				killerSeats,
				seatId,
				reminderId: reminder.reminderId,
				because
			});
		}
	}
	return out;
}
