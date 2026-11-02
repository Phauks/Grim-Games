import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	OVERRIDE_FIELDS,
	isOnScript,
	registersAsDead,
	scriptCharacterIds,
	typeOf
} from '#lib/core/model/index.ts';
import { cantTurnGood } from '#lib/core/rules/becomes.ts';
import { barredAbilities, givenInstead } from '#lib/core/rules/jinxes.ts';
import type { GameEvent } from '../events.ts';
import {
	allowsDuplicates,
	characterOf,
	deathCause,
	refuse,
	seatOf,
	seatableCharacter,
	trulyInPlay,
	type Deciders
} from './shared.ts';

/** Characters on seats, alignment, death, ghost votes, overrides and Fabled or Loric in play. */
export const CHARACTERS_DECIDERS: Deciders<
	| 'AssignCharacter'
	| 'ClearCharacter'
	| 'SwapCharacters'
	| 'SetAlignment'
	| 'SetHeldAbility'
	| 'SetStorytellerAbility'
	| 'Reincarnate'
	| 'SetOptionalRule'
	| 'SetDead'
	| 'SetDeathCause'
	| 'SpendGhostVote'
	| 'RestoreGhostVote'
	| 'SetOverride'
	| 'ClearOverride'
	| 'AddRuleCharacter'
	| 'RemoveRuleCharacter'
> = {
	AssignCharacter(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const character = seatableCharacter(ctx, command.characterId);
		if (character.type !== 'traveller' && !isOnScript(game.script, character.id)) {
			warn('not-on-script', `${character.name} is not on the script`, [character.id]);
		}
		const elsewhere = game.seating.some(
			(id) => id !== seat.seatId && game.seats[id].characterId === character.id
		);
		if (elsewhere && !allowsDuplicates(character)) {
			warn('already-in-play', `${character.name} is already on another seat`, [character.id]);
		}
		const typeDefault = defaultAlignment(character.type);
		let alignment = command.alignment;
		if (alignment === undefined && seat.characterId !== undefined) {
			alignment = seat.alignment;
			if (alignment !== undefined && typeDefault !== undefined && alignment !== typeDefault) {
				warn('kept-alignment', `kept ${alignment}: a character change does not change alignment`);
			}
		}
		alignment ??= typeDefault;
		// A Traveller's alignment may be chosen later: the first night step asks for it
		// (Trevor, 2026-10-16).
		const assigned: GameEvent = {
			type: 'CharacterAssigned',
			seatId: seat.seatId,
			characterId: character.id
		};
		if (alignment !== undefined) assigned.alignment = alignment;
		if (command.by !== undefined) assigned.by = characterOf(ctx, command.by).id;
		return [assigned];
	},

	ClearCharacter(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (seat.characterId === undefined) {
			warn('no-change', 'the seat has no character');
			return [];
		}
		return [{ type: 'CharacterCleared', seatId: seat.seatId }];
	},

	SwapCharacters(game, command, ctx, warn) {
		const a = seatOf(game, command.seatId);
		const b = seatOf(game, command.withSeatId);
		if (a.seatId === b.seatId) refuse('same-seat', 'a player cannot swap with themselves');
		if (a.characterId === undefined || b.characterId === undefined) {
			refuse('unknown-character', 'both players need a character to swap');
		}
		const keep = command.keepAlignments === true;
		if (a.characterId === b.characterId && (keep || a.alignment === b.alignment)) {
			warn('no-change', 'they have the same character and alignment');
			return [];
		}
		const to = (seat: typeof a, from: typeof b): GameEvent => {
			const alignment = keep ? seat.alignment : from.alignment;
			return {
				type: 'CharacterAssigned',
				seatId: seat.seatId,
				characterId: from.characterId!,
				...(alignment !== undefined ? { alignment } : {})
			};
		};
		return [to(a, b), to(b, a)];
	},

	SetAlignment(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (seat.alignment === command.alignment) {
			warn('no-change', `already ${command.alignment}`);
			return [];
		}
		// A jinx may say they can't turn good by an ability they have (the Boffin's Demon with the
		// Goon ability, an evil player the Pit-Hag turned into the Cult Leader): warn, never lock,
		// as something else may turn them good.
		const stays =
			command.alignment === 'good' ? cantTurnGood(game, seat.seatId, ctx.characters) : undefined;
		if (stays) {
			const ability = ctx.characters.get(stays.characterId)?.name ?? stays.characterId;
			const via = ctx.characters.get(stays.via)?.name ?? stays.via;
			warn(
				'jinxed-alignment',
				`${via} and ${ability} are jinxed: this player can't turn good by the ${ability} ability`,
				[stays.via, stays.characterId]
			);
		}
		if (command.alignment === 'evil') {
			const limiter = [...trulyInPlay(game, ctx)].find(
				(id) => rulesOf(id, ctx.characters)?.limitsExtraEvil
			);
			// Good-type players who are evil, counting this one: each is an extra evil player.
			const extra = game.seating.filter((id) => {
				const type = typeOf(game, id, ctx.characters);
				const evil = id === seat.seatId || game.seats[id].alignment === 'evil';
				return evil && (type === 'townsfolk' || type === 'outsider');
			});
			if (limiter && extra.length > 1) {
				const name = ctx.characters.get(limiter)?.name ?? limiter;
				warn('extra-evil-limit', `${name}: there can't be more than 1 extra evil player`);
			}
		}
		return [{ type: 'AlignmentSet', seatId: seat.seatId, alignment: command.alignment }];
	},

	SetHeldAbility(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const via = characterOf(ctx, command.via);
		if (command.characterId !== undefined) {
			const given = seatableCharacter(ctx, command.characterId);
			// A jinx may bar the ability (the Boffin's Demon cannot have the Drunk ability,
			// https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes): warn, never lock.
			const script = scriptCharacterIds(game.script);
			if (barredAbilities(via.id, script, ctx.characters).includes(given.id))
				warn(
					'jinxed-ability',
					`${via.name} and ${given.name} are jinxed: the ${via.name} cannot give that ability`,
					[via.id, given.id]
				);
			// An ability meant for the Storyteller goes to a player only by a jinx that sends it
			// to a Minion (the Plague Doctor's Spy).
			const rule = rulesOf(via.id, ctx.characters)?.givesAbility;
			const toMinion = givenInstead(via.id, given.id, script, ctx.characters) === 'a-minion';
			if (rule?.to === 'storyteller' && !toMinion)
				warn('not-given-to-player', `the ${via.name} gives this ability to the Storyteller`, [
					via.id,
					given.id
				]);
			if (toMinion && typeOf(game, seat.seatId, ctx.characters) !== 'minion')
				warn('not-minion', `${via.name} and ${given.name} are jinxed: a Minion gains it`, [
					via.id,
					given.id
				]);
		}
		const held = seat.abilities?.find((a) => a.via === command.via)?.characterId;
		if (held === command.characterId) {
			warn('no-change', command.characterId ? 'already has that ability' : 'has no such ability');
			return [];
		}
		return [
			{
				type: 'HeldAbilitySet',
				seatId: seat.seatId,
				via: command.via,
				...(command.characterId !== undefined ? { characterId: command.characterId } : {})
			}
		];
	},

	SetStorytellerAbility(game, command, ctx, warn) {
		const via = characterOf(ctx, command.via);
		if (command.characterId !== undefined) {
			const given = seatableCharacter(ctx, command.characterId);
			// A jinx may send the ability elsewhere (the Plague Doctor's Spy goes to a Minion,
			// https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes): warn, never lock.
			const script = scriptCharacterIds(game.script);
			if (givenInstead(via.id, given.id, script, ctx.characters))
				warn(
					'jinxed-ability',
					`${via.name} and ${given.name} are jinxed: the Storyteller does not gain that ability`,
					[via.id, given.id]
				);
		}
		const held = game.storytellerAbilities?.find((a) => a.via === command.via)?.characterId;
		if (held === command.characterId) {
			warn('no-change', command.characterId ? 'already has that ability' : 'has no such ability');
			return [];
		}
		return [
			{
				type: 'StorytellerAbilitySet',
				via: command.via,
				...(command.characterId !== undefined ? { characterId: command.characterId } : {})
			}
		];
	},

	Reincarnate(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const character = seatableCharacter(ctx, command.characterId);
		if (!seat.dead) refuse('not-dead', 'only a dead player is reincarnated');
		if (character.type !== 'traveller')
			warn('not-traveller', `${character.name} is not a Traveller`);
		const elsewhere = game.seating.some(
			(id) => id !== seat.seatId && game.seats[id].characterId === character.id
		);
		if (elsewhere && !allowsDuplicates(character)) {
			warn('already-in-play', `${character.name} is already on another seat`, [character.id]);
		}
		const events: GameEvent[] = [
			{
				type: 'CharacterAssigned',
				seatId: seat.seatId,
				characterId: character.id,
				...(seat.alignment !== undefined ? { alignment: seat.alignment } : {})
			},
			{ type: 'DeathSet', seatId: seat.seatId, dead: false }
		];
		if (seat.ghostVoteUsed) events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
		events.push({ type: 'SeatReincarnated', seatId: seat.seatId });
		return events;
	},

	SetDead(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const cause = command.cause === undefined ? undefined : deathCause(ctx, command.cause);
		if (!command.dead && cause !== undefined) {
			warn('cause-ignored', 'a living player has no cause of death');
		}
		// Every death has a cause (Trevor, 2026-10-16): still allowed, as an override.
		if (command.dead && cause === undefined && !seat.dead) {
			warn('no-cause', 'every death has a cause; record one');
		}
		if (seat.dead === command.dead) {
			// Marking a dead player dead again with a new cause records the cause.
			if (command.dead && cause !== undefined && cause !== seat.deathCause) {
				return [{ type: 'DeathCauseSet', seatId: seat.seatId, cause }];
			}
			warn('no-change', command.dead ? 'already dead' : 'already alive');
			return [];
		}
		const death: GameEvent = { type: 'DeathSet', seatId: seat.seatId, dead: command.dead };
		if (command.dead && cause !== undefined) death.cause = cause;
		const events: GameEvent[] = [death];
		// A player who comes back to life has their vote again.
		if (!command.dead && seat.ghostVoteUsed) {
			events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
		}
		return events;
	},

	SetDeathCause(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const cause = command.cause === undefined ? undefined : deathCause(ctx, command.cause);
		if (cause === seat.deathCause) {
			warn('no-change', cause === undefined ? 'no cause is recorded' : `already ${cause}`);
			return [];
		}
		if (!seat.dead) refuse('not-dead', 'only a dead player has a cause of death');
		const event: GameEvent = { type: 'DeathCauseSet', seatId: seat.seatId };
		if (cause !== undefined) event.cause = cause;
		return [event];
	},

	SpendGhostVote(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (seat.ghostVoteUsed) {
			warn('no-change', 'the ghost vote is already used');
			return [];
		}
		if (!registersAsDead(game, seat.seatId)) {
			warn('ghost-vote-while-alive', 'living players do not use their ghost vote');
		}
		return [{ type: 'GhostVoteSpent', seatId: seat.seatId }];
	},

	RestoreGhostVote(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (!seat.ghostVoteUsed) {
			warn('no-change', 'the ghost vote is not used');
			return [];
		}
		return [{ type: 'GhostVoteRestored', seatId: seat.seatId }];
	},

	SetOverride(game, command, ctx) {
		const seat = seatOf(game, command.seatId);
		const { override } = command;
		if (!(OVERRIDE_FIELDS as readonly string[]).includes(override.field)) {
			refuse('unknown-override', `no override ${String(override.field)}`);
		}
		if (override.field === 'character') characterOf(ctx, override.value);
		const copy = { ...override };
		const note = copy.note?.trim();
		if (note) copy.note = note;
		else delete copy.note;
		return [{ type: 'OverrideSet', seatId: seat.seatId, override: copy }];
	},

	ClearOverride(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (!seat.overrides.some((o) => o.field === command.field)) {
			warn('no-change', `no ${command.field} override`);
			return [];
		}
		return [{ type: 'OverrideCleared', seatId: seat.seatId, field: command.field }];
	},

	SetOptionalRule(game, command, ctx, warn) {
		const character = characterOf(ctx, command.characterId);
		if (!rulesOf(character.id, ctx.characters)?.optionalRule)
			refuse('no-optional-rule', `${character.name} has no optional rule`);
		if ((game.optionalRules?.includes(character.id) ?? false) === command.on) {
			warn(
				'no-change',
				`${character.name}'s optional rule is already ${command.on ? 'on' : 'off'}`
			);
			return [];
		}
		return [{ type: 'OptionalRuleSet', characterId: character.id, on: command.on }];
	},

	AddRuleCharacter(game, command, ctx, warn) {
		const character = characterOf(ctx, command.characterId);
		if (character.type !== 'fabled' && character.type !== 'loric') {
			refuse('not-rule-character', `${character.name} is not a Fabled or Loric`);
		}
		if (game.ruleCharacters.includes(character.id)) {
			warn('no-change', `${character.name} is already in play`);
			return [];
		}
		return [{ type: 'RuleCharacterAdded', characterId: character.id }];
	},

	RemoveRuleCharacter(game, command, ctx, warn) {
		if (!game.ruleCharacters.includes(command.characterId)) {
			warn('no-change', `${command.characterId} is not in play`);
			return [];
		}
		return [{ type: 'RuleCharacterRemoved', characterId: command.characterId }];
	}
};
