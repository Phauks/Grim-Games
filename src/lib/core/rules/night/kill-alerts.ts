/**
 * The alerts for a killing step: the players whose jinx stops every Demon kill tonight, and
 * for each player it might kill, what protects them, moves or survives the death, or what
 * their death sets off (the "If chosen" rows, see `night-alerts.ts`).
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { AbilitySource } from '#lib/core/rules/abilities/ability.ts';
import { abilitiesOfSeat } from '#lib/core/rules/abilities/gained-abilities.ts';
import {
	firstDeathSaver,
	jinxSafeFrom,
	killRedirect,
	protection,
	protectors
} from '#lib/core/rules/abilities/protection.ts';
import { ownJinxes } from '#lib/core/rules/jinxes/jinxes.ts';
import { aboutHolder, jinxApplies } from '#lib/core/rules/jinxes/jinx-when.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';
import { type NightAlert, type NightAlertKind, sourceAlert } from './night-alert.ts';
import { type NightKiller, onDeathTrigger } from './night-killers.ts';

/**
 * The players whose jinx stops every Demon killing tonight (`noKill` with `killer: "demon"`,
 * while its `when` holds for that player: with `nominated-partner`, `partner-executed` and
 * `partner-dead`, the Cannibal who nominated and executed the Princess today,
 * https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes).
 */
export function demonKillStops(game: Game, characters: CharacterLookup): AbilitySource[] {
	return game.seating.flatMap((seatId) => {
		const own = trueCharacter(game, seatId, characters);
		if (!own) return [];
		const hit = ownJinxes(game, own, (r) => r.noKill?.killer === 'demon', characters).some(
			({ partner, rule }) =>
				!aboutHolder(rule.noKill) &&
				jinxApplies(game, own, partner, rule.noKill, characters, { seatId })
		);
		return hit ? [{ characterId: own, seatId }] : [];
	});
}

/** The "If chosen" alerts for `seatId` at the step of `killerId`, a killing step. */
export function deathAlerts(
	game: Game,
	seatId: SeatId,
	killerId: CharacterId,
	killer: NightKiller,
	characters: CharacterLookup
): NightAlert[] {
	const seat = game.seats[seatId];
	const own = trueCharacter(game, seatId, characters);
	const out: NightAlert[] = [];
	const alert = (kind: NightAlertKind, source: AbilitySource, wiki: string | undefined) =>
		out.push(sourceAlert(game, kind, seatId, source, characters, wiki));
	const wikiOf = (source: AbilitySource) => {
		const character = characters.get(source.characterId);
		return character && wikiUrl(character);
	};
	const holder = (id: CharacterId) =>
		game.seating.find((s) => trueCharacter(game, s, characters) === id);

	if (!killer.ignoresProtection) {
		const override = seat.overrides.find((o) => o.field === 'canDie');
		if (override && !override.value) {
			out.push({ kind: 'protected', seatId, source: 'override', works: true, impairments: [] });
		}
		for (const { source } of protectors(game, seatId, characters, killer.by, killerId)) {
			alert('protected', source, wikiOf(source));
		}
		// A player a working protection keeps safe doesn't die: no kill to move elsewhere (the
		// Monk's Mayor example: https://wiki.bloodontheclocktower.com/Monk) and no first death
		// spent (https://wiki.bloodontheclocktower.com/Fool, Example 3).
		const safe = protection(game, seatId, characters, killer.by, killerId);
		const redirect = safe ? undefined : killRedirect(game, seatId, characters, killer.by);
		if (redirect) alert('may-bounce', redirect, wikiOf(redirect));
		const saver = safe ? undefined : firstDeathSaver(game, seatId, characters);
		if (saver) alert('survives-first-death', saver.source, wikiOf(saver.source));
	} else {
		// A jinx's "cannot kill" holds even against a kill that ignores protection.
		const safe = jinxSafeFrom(game, seatId, characters, killer.by, killerId);
		if (safe) alert('protected', safe, wikiOf(safe));
	}

	const trigger = own ? onDeathTrigger(own, characters) : undefined;
	if (own && trigger && (trigger.by === 'any' || trigger.by === killer.by)) {
		const character = characters.get(own);
		alert('on-death', { characterId: own, seatId }, character && wikiUrl(character));
	}
	// Or an ability they have from another character that their death sets off (the Cannibal who
	// ate the Ravenkeeper keeps it when they die, https://wiki.bloodontheclocktower.com/Cannibal).
	for (const ability of abilitiesOfSeat(game, seatId, characters)) {
		if (ability.how === 'own') continue;
		const borrowed = onDeathTrigger(ability.characterId, characters);
		if (!borrowed || (borrowed.by !== 'any' && borrowed.by !== killer.by)) continue;
		const character = characters.get(ability.characterId);
		alert(
			'on-death',
			{ characterId: ability.characterId, seatId },
			character && wikiUrl(character)
		);
	}
	// A player dies with the one their token marks when the Demon kills them (`deathCheck`
	// `marked-killed-by-demon`: the Grandmother's Grandchild,
	// https://wiki.bloodontheclocktower.com/Grandmother).
	if (killer.by === 'demon') {
		for (const r of seat.reminders) {
			const check = rulesFor(game, r.characterId, characters)?.deathCheck;
			if (check?.kind !== 'marked-killed-by-demon' || check.token !== r.label) continue;
			const from = holder(r.characterId);
			const character = characters.get(r.characterId);
			alert(
				'on-death',
				{
					characterId: r.characterId,
					...(from ? { seatId: from } : {}),
					reminderId: r.reminderId
				},
				character && wikiUrl(character)
			);
		}
	}
	return out;
}
