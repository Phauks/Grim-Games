/**
 * Jinx verbs about whom a character's ability lands on (M44, `data/jinx-rules.ts`):
 * - `cannotChoose`: the subject's player can't choose the partner's player;
 * - `storytellerChooses` with `what: "another-player"`: when the subject's choice would land on
 *   the partner's player, the Storyteller chooses another player instead;
 * - `noKill` with `on: "chosen"`: the subject doesn't kill tonight once the partner's player
 *   chose them tonight, shown by the partner's reminder placed on them tonight.
 * The app marks a choice by the chooser's reminders on the board, so the first two fade the
 * partner's seats while one of the subject's reminders is dragged (`reminder-targets.ts`) and
 * add a night alert at the subject's step; the third is a `no-kill` alert and takes the kill
 * off the step (`night-kill.ts`). Warns, never locks: the Storyteller can place anything.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import type { AbilitySource } from './ability.ts';
import { jinxEffect, ownJinxEffects } from './jinxes.ts';

/** Why a jinx says `reminder`, the mark of its character's choice, doesn't go on `seatId`. */
export type ChoiceJinx = 'jinx-choice' | 'jinx-redirect';

/**
 * Whether a jinx keeps `reminder`'s character from choosing `seatId`'s player: `jinx-choice`
 * (`cannotChoose`) or `jinx-redirect` (`storytellerChooses` `another-player`, the Storyteller
 * picks someone else). Its character's `marksChoice` reminders mark its choices (the Widow's
 * Poisoned); one with none (a custom character's) counts each of its reminders, but one that
 * marks the game, not a player.
 */
export function choiceJinx(
	game: Game,
	reminder: Reminder,
	seatId: SeatId,
	characters: CharacterLookup
): ChoiceJinx | undefined {
	const chooser = reminder.characterId;
	const target = trueCharacter(game, seatId, characters);
	if (target === undefined || target === chooser) return undefined;
	const rules = rulesOf(chooser, characters);
	if (rules?.reminderTargets?.[reminder.label]?.global) return undefined;
	if (rules?.marksChoice && !rules.marksChoice.includes(reminder.label)) return undefined;
	if (jinxEffect(game, chooser, target, 'cannotChoose', characters)) return 'jinx-choice';
	const picks = jinxEffect(game, chooser, target, 'storytellerChooses', characters);
	return picks?.what === 'another-player' ? 'jinx-redirect' : undefined;
}

/** The partners whose players `chooser` can't choose now (`cannotChoose`, or a redirect). */
export function unchoosablePartners(
	game: Game,
	chooser: CharacterId,
	characters: CharacterLookup
): { partner: CharacterId; why: ChoiceJinx }[] {
	return [
		...ownJinxEffects(game, chooser, 'cannotChoose', characters).map(({ partner }) => ({
			partner,
			why: 'jinx-choice' as const
		})),
		...ownJinxEffects(
			game,
			chooser,
			'storytellerChooses',
			characters,
			(e) => e.what === 'another-player'
		).map(({ partner }) => ({ partner, why: 'jinx-redirect' as const }))
	];
}

/**
 * The partner whose choice tonight stops `holder`'s `characterId` killing (`noKill` with `on:
 * "chosen"`): its reminder (`token`, or any of its own) was placed on `holder` tonight. A
 * reminder saved before the app recorded when it was placed counts, so the Storyteller is
 * still told. Undefined when no jinx says so.
 */
export function chosenStopsKill(
	game: Game,
	holder: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): AbilitySource | undefined {
	const seat = game.seats[holder];
	if (!seat) return undefined;
	const tonight = game.pastDays.length;
	for (const { partner, effect } of ownJinxEffects(
		game,
		characterId,
		'noKill',
		characters,
		(e) => e.on === 'chosen'
	)) {
		const mark = seat.reminders.find(
			(r) =>
				r.characterId === partner &&
				(effect.token === undefined || r.label === effect.token) &&
				(r.placedDays === undefined || r.placedDays === tonight)
		);
		if (!mark) continue;
		const from = game.seating.find(
			(s) => s !== holder && trueCharacter(game, s, characters) === partner
		);
		return { characterId: partner, ...(from ? { seatId: from } : {}), reminderId: mark.reminderId };
	}
	return undefined;
}
