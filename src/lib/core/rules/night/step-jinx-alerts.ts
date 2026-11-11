/**
 * Night step alerts from jinxes and gained abilities: what a jinx changes about the Grimoire,
 * a partner a jinx's night choice picked, what a gained ability's jinx has the player learn,
 * a missing `ifEvil` reminder, and false information a jinx keeps true (see `night-alerts.ts`).
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, type AbilitySource } from '#lib/core/rules/abilities/ability.ts';
import { gainedAbilities } from '#lib/core/rules/abilities/gained-abilities.ts';
import { jinxEffect, ownJinxEffects } from '#lib/core/rules/jinxes/jinxes.ts';
import { jinxChosenTonight } from '#lib/core/rules/jinxes/jinx-choices.ts';
import { falseInfoSource } from '#lib/core/rules/night/info/reliability.ts';
import { type NightAlert, sourceAlert, wikiOf } from './night-alert.ts';

/**
 * What a jinx changes about the Grimoire the waking character's player sees (`grimoire`,
 * while its `when` holds): with `hides: "all"`, not seen while a partner's player has their
 * ability (a dead partner has none); with a list, these players' tokens come off it first.
 */
export function grimoireAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	const holders = (id: CharacterId) =>
		game.seating.filter((s) => trueCharacter(game, s, characters) === id);
	for (const { partner, effect } of ownJinxEffects(game, characterId, 'grimoire', characters)) {
		if (effect.hides === 'all') {
			for (const at of holders(partner)) {
				if (abilityState(game, at, characters).dead) continue;
				const source = { characterId: partner, seatId: at };
				for (const seatId of actors)
					out.push(
						sourceAlert(game, 'no-grimoire', seatId, source, characters, wikiOf(source, characters))
					);
			}
		}
		const hides = effect.hides === 'all' ? [] : effect.hides;
		if (hides.length === 0 || actors.length === 0) continue;
		// The partner's player is the source, when in play (`partner-in-play`: with no
		// Magician, the Demon's token stays).
		const from = holders(partner)[0];
		const source: AbilitySource =
			from === undefined ? { characterId: partner } : { characterId: partner, seatId: from };
		for (const seatId of game.seating) {
			const hidden =
				(hides.includes('partner') && trueCharacter(game, seatId, characters) === partner) ||
				hides.some((h) => h !== 'partner' && typeOf(game, seatId, characters) === h);
			if (!hidden) continue;
			// The jinx itself takes the token off, whatever the partner's ability's state.
			const alert: NightAlert = {
				kind: 'grimoire-hides',
				seatId,
				source,
				works: true,
				impairments: []
			};
			const wiki = wikiOf(source, characters);
			if (wiki) alert.wiki = wiki;
			out.push(alert);
		}
	}
	return out;
}

/**
 * A partner a jinx's night choice picked tonight (`jinxChosenTonight`), at the partner's
 * step (its own player) and at the chooser's. The jinx itself applies it, whatever the
 * chooser's ability's state.
 */
export function jinxChoiceAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	return jinxChosenTonight(game, characters)
		.filter(
			(c) =>
				c.by.characterId === characterId || (c.partner === characterId && actors.includes(c.seatId))
		)
		.map((c) => {
			const source: AbilitySource = c.by;
			const alert: NightAlert = {
				kind: 'jinx-chosen',
				seatId: c.seatId,
				source,
				works: true,
				impairments: [],
				outcome: c.outcome
			};
			const wiki = wikiOf(source, characters);
			if (wiki) alert.wiki = wiki;
			return alert;
		});
}

/**
 * What a jinx has the waking player learn tonight about an ability they gained today
 * (`learnsGainedTonight`), at the step of the character they gained it by. Its source is the
 * gained character on their own seat, so a drunk or poisoned holder says so.
 */
export function learnsGainedAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	return gainedAbilities(game, characters)
		.filter((g) => g.learns && g.via === characterId && actors.includes(g.seatId))
		.map((g) => {
			const source: AbilitySource = { characterId: g.characterId, seatId: g.seatId };
			const alert = sourceAlert(game, 'learns-gained', g.seatId, source, characters, undefined);
			const wiki = wikiOf({ characterId }, characters);
			return { ...alert, ...(wiki ? { wiki } : {}), learns: g.learns };
		});
}

/**
 * A waking player with the ability of an evil player who doesn't carry their own `ifEvil`
 * reminder (`GainedAbility.ifEvil`), at the step of the character they gained it by: the
 * Cannibal after an evil lunch without Poisoned (Trevor, 2026-11-06: warn on their step).
 */
export function missingTokenAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	return gainedAbilities(game, characters)
		.filter((g) => g.ifEvil && g.via === characterId && actors.includes(g.seatId))
		.filter(
			(g) =>
				!game.seats[g.seatId].reminders.some(
					(r) => r.characterId === characterId && r.label === g.ifEvil
				)
		)
		.map((g) => {
			const source: AbilitySource = { characterId, seatId: g.seatId };
			const wiki = wikiOf({ characterId }, characters);
			return {
				kind: 'missing-token' as const,
				seatId: g.seatId,
				source,
				works: true,
				impairments: [],
				token: g.ifEvil!,
				...(wiki ? { wiki } : {})
			};
		});
}

/**
 * A character whose false information would cover the waking character's, but whose jinx with
 * it keeps it true (`trueInfo`): the Vortox and the Banshee's announcement.
 */
export function trueInfoAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	const type = characters.get(characterId)?.type;
	const by = type === undefined ? undefined : falseInfoSource(game, characters, type);
	if (!by || !jinxEffect(game, by.characterId, characterId, 'trueInfo', characters)) return [];
	return actors.map((seatId) =>
		sourceAlert(game, 'true-info', seatId, by, characters, wikiOf(by, characters))
	);
}
