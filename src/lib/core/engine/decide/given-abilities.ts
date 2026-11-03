/**
 * The Storyteller gives a player an ability without changing their character, or takes it
 * away (M34): a character's ability, by hand or for the character that gave it, or free text.
 */
import { hasGiven } from '#lib/core/model/given-abilities.ts';
import type { GivenAbility } from '#lib/core/model/index.ts';
import type { EngineContext } from '../context.ts';
import { characterOf, refuse, seatOf, seatableCharacter, type Deciders } from './shared.ts';

/** Longest free-text ability, in UTF-16 units. */
export const MAX_CUSTOM_ABILITY = 200;

/** `ability` as stored: a text trimmed, a character's checked against the game's characters. */
function checked(ability: GivenAbility, ctx: EngineContext): GivenAbility {
	if ('text' in ability) {
		const text = typeof ability.text === 'string' ? ability.text.trim() : '';
		if (text.length === 0 || text.length > MAX_CUSTOM_ABILITY)
			refuse('invalid-ability', `an ability text is 1 to ${MAX_CUSTOM_ABILITY} characters`);
		return { text };
	}
	const characterId = seatableCharacter(ctx, ability.characterId).id;
	if (ability.via === undefined) return { characterId };
	return { characterId, via: characterOf(ctx, ability.via).id };
}

export const GIVEN_ABILITY_DECIDERS: Deciders<'GiveAbility' | 'RemoveAbility'> = {
	GiveAbility(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const ability = checked(command.ability, ctx);
		if (hasGiven(seat, ability)) {
			warn('no-change', 'already has that ability');
			return [];
		}
		return [{ type: 'AbilityGiven', seatId: seat.seatId, ability }];
	},

	RemoveAbility(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const ability = checked(command.ability, ctx);
		if (!hasGiven(seat, ability)) {
			warn('no-change', 'has no such ability');
			return [];
		}
		return [{ type: 'AbilityRemoved', seatId: seat.seatId, ability }];
	}
};
