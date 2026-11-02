import {
	WISH_EFFECTS,
	type DayEntry,
	type Game,
	type StorytellerPair
} from '#lib/core/model/index.ts';
import { grantedWish, makesWish, switchedPair, twoStorytellersBy } from '#lib/core/rules/index.ts';
import type { EngineContext } from '../context.ts';
import type { GameEvent } from '../events.ts';
import { characterOf, entryOfKind, refuse, seatOf, type Deciders, type Warn } from './shared.ts';

type Wish = Extract<DayEntry, { kind: 'wish' }>;

/** A trimmed text, or undefined when blank. */
const clean = (value: unknown) =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const isPlace = (value: unknown): value is 0 | 1 => value === 0 || value === 1;

function checkPair(game: Game, ctx: EngineContext, warn: Warn) {
	if (!twoStorytellersBy(game, ctx.characters)) {
		warn('no-two-storytellers', 'no character in play makes two Storytellers');
	}
}

/**
 * Wishes (a character's `wish` rule) and two Storytellers (a `twoStorytellers` rule
 * character). The Storyteller decides: a second granted wish or a second switch only warns.
 */
export const STORYTELLERS_WISHES_DECIDERS: Deciders<
	'RecordWish' | 'SetStorytellers' | 'SwitchStorytellers' | 'SetStorytellerVisit'
> = {
	RecordWish(game, command, ctx, warn) {
		const seatId = seatOf(game, command.seatId).seatId;
		const characterId = characterOf(ctx, command.characterId).id;
		if (typeof command.granted !== 'boolean') refuse('invalid-wish', 'granted or declined');
		if (command.effect !== undefined && !WISH_EFFECTS.includes(command.effect)) {
			refuse('invalid-wish', `no wish effect ${String(command.effect)}`);
		}
		if (!makesWish(characterId, ctx.characters)) {
			warn('no-wish-rule', 'this character makes no wish');
		}
		const before = command.entryId ? entryOfKind(game, command.entryId, 'wish') : undefined;
		const granted = grantedWish(game, seatId);
		if (command.granted && granted && granted.entryId !== before?.entryId) {
			warn('already-wished', 'this player already had a wish granted');
		}
		const entry: Wish = {
			kind: 'wish',
			entryId: before?.entryId ?? ctx.newId(),
			seatId,
			characterId,
			text: typeof command.text === 'string' ? command.text.trim() : '',
			granted: command.granted
		};
		const price = clean(command.price);
		const clue = clean(command.clue);
		if (price) entry.price = price;
		if (clue) entry.clue = clue;
		if (command.effect && command.granted) entry.effect = command.effect;
		if (!before) return [{ type: 'DayEntryAdded', entry }];
		if (JSON.stringify(before) === JSON.stringify(entry)) {
			warn('no-change', 'the wish is unchanged');
			return [];
		}
		return [{ type: 'DayEntryReplaced', entry }];
	},

	SetStorytellers(game, command, ctx, warn) {
		checkPair(game, ctx, warn);
		const names = command.names?.map((n) => (typeof n === 'string' ? n.trim() : ''));
		const pair: StorytellerPair = {
			...(names && names.some((n) => n !== '') ? { names: [names[0] ?? '', names[1] ?? ''] } : {}),
			...(isPlace(command.liar) ? { liar: command.liar } : {}),
			...(game.storytellerPair?.switched ? { switched: true as const } : {})
		};
		if (JSON.stringify(pair) === JSON.stringify(game.storytellerPair ?? {})) {
			warn('no-change', 'the Storytellers are unchanged');
			return [];
		}
		const event: GameEvent = { type: 'StorytellerPairSet' };
		if (Object.keys(pair).length > 0) event.pair = pair;
		return [event];
	},

	SwitchStorytellers(game, command, ctx, warn) {
		checkPair(game, ctx, warn);
		if (game.storytellerPair?.switched) {
			warn('already-switched', 'the Storytellers usually switch once per game');
		}
		if (game.storytellerPair?.liar === undefined) {
			warn('no-change', 'nobody lies yet, so switching changes nothing');
		}
		return [{ type: 'StorytellerPairSet', pair: switchedPair(game.storytellerPair) }];
	},

	SetStorytellerVisit(game, command, ctx, warn) {
		const seatId = seatOf(game, command.seatId).seatId;
		checkPair(game, ctx, warn);
		const storyteller = isPlace(command.storyteller) ? command.storyteller : undefined;
		if (game.today.visits?.[seatId] === storyteller) {
			warn('no-change', 'the visit is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'StorytellerVisitSet', seatId };
		if (storyteller !== undefined) event.storyteller = storyteller;
		return [event];
	}
};
