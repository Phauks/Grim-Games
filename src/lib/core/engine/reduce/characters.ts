/**
 * The reducers for characters on seats, their alignment, abilities and deaths, and the Fabled and
 * Loric in play, one for each event type (`reducer.ts` looks them up).
 */
import { withGiven } from '#lib/core/model/given-abilities.ts';
import type { Game, Seat } from '#lib/core/model/index.ts';
import { updateSeat, omit, type Reducers } from '#lib/core/engine/reduce/shared.ts';

export const CHARACTERS_REDUCERS: Reducers<
	| 'CharacterAssigned'
	| 'CharacterCleared'
	| 'AlignmentSet'
	| 'StorytellerAbilitySet'
	| 'SeatReincarnated'
	| 'OptionalRuleSet'
	| 'HeldAbilitySet'
	| 'AbilityGiven'
	| 'AbilityRemoved'
	| 'DeathSet'
	| 'DeathCauseSet'
	| 'OverrideSet'
	| 'OverrideCleared'
	| 'RuleCharacterAdded'
	| 'RuleCharacterRemoved'
> = {
	CharacterAssigned(game, event) {
		return updateSeat(game, event.seatId, (seat) => {
			const rest = omit(seat, 'changedBy');
			const next: Seat =
				event.alignment === undefined
					? { ...omit(rest, 'alignment'), characterId: event.characterId }
					: { ...rest, characterId: event.characterId, alignment: event.alignment };
			if (event.by === undefined) return next;
			const changedBy = {
				via: event.by,
				...(next.alignment !== undefined ? { alignment: next.alignment } : {})
			};
			return { ...next, changedBy };
		});
	},
	CharacterCleared(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			omit(seat, 'characterId', 'alignment', 'changedBy')
		);
	},
	AlignmentSet(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({ ...seat, alignment: event.alignment }));
	},
	StorytellerAbilitySet(game, event) {
		const others = (game.storytellerAbilities ?? []).filter((a) => a.via !== event.via);
		const storytellerAbilities =
			event.characterId === undefined
				? others
				: [...others, { characterId: event.characterId, via: event.via }];
		return storytellerAbilities.length > 0
			? { ...game, storytellerAbilities }
			: omit(game, 'storytellerAbilities');
	},
	SeatReincarnated(game, event) {
		return { ...game, reincarnated: [...(game.reincarnated ?? []), event.seatId] };
	},
	OptionalRuleSet(game, event) {
		const others = (game.optionalRules ?? []).filter((id) => id !== event.characterId);
		const optionalRules = event.on ? [...others, event.characterId] : others;
		return optionalRules.length > 0 ? { ...game, optionalRules } : omit(game, 'optionalRules');
	},
	HeldAbilitySet(game, event) {
		return updateSeat(game, event.seatId, (seat) => {
			const others = (seat.abilities ?? []).filter((a) => a.via !== event.via);
			const abilities =
				event.characterId === undefined
					? others
					: [...others, { characterId: event.characterId, via: event.via }];
			return abilities.length > 0 ? { ...seat, abilities } : omit(seat, 'abilities');
		});
	},
	AbilityGiven(game, event) {
		return updateSeat(game, event.seatId, (seat) => withGiven(seat, event.ability, true));
	},
	AbilityRemoved(game, event) {
		return updateSeat(game, event.seatId, (seat) => withGiven(seat, event.ability, false));
	},
	DeathSet(game, event) {
		return updateSeat(game, event.seatId, (seat) => {
			const next = omit(seat, 'deathCause', 'impairedAtDeath');
			if (!event.dead) return { ...next, dead: false };
			return {
				...next,
				dead: true,
				...(event.cause !== undefined ? { deathCause: event.cause } : {}),
				...(event.impaired ? { impairedAtDeath: true as const } : {})
			};
		});
	},
	DeathCauseSet(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			event.cause === undefined ? omit(seat, 'deathCause') : { ...seat, deathCause: event.cause }
		);
	},
	OverrideSet(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({
			...seat,
			overrides: [
				...seat.overrides.filter((o) => o.field !== event.override.field),
				{ ...event.override }
			]
		}));
	},
	OverrideCleared(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({
			...seat,
			overrides: seat.overrides.filter((o) => o.field !== event.field)
		}));
	},
	RuleCharacterAdded(game, event) {
		if (game.ruleCharacters.includes(event.characterId)) return game;
		return { ...game, ruleCharacters: [...game.ruleCharacters, event.characterId] };
	},
	RuleCharacterRemoved(game, event) {
		const removed: Game = {
			...game,
			ruleCharacters: game.ruleCharacters.filter((id) => id !== event.characterId)
		};
		// Its reminders go back off the board with it.
		if (!game.ruleReminders || !Object.hasOwn(game.ruleReminders, event.characterId)) {
			return removed;
		}
		const ruleReminders = { ...game.ruleReminders };
		delete ruleReminders[event.characterId];
		return { ...removed, ruleReminders };
	}
};
