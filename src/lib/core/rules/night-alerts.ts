/**
 * Reminders of game state for a night step (Trevor, 2026-10-16: "when landing on a role
 * that can bounce a death or is poisoned, show reminders of this game state").
 *
 * For the waking character, `nightStepAlerts` lists:
 * - `impaired`: a waking player is drunk, poisoned or has no ability (from `abilityState`);
 * and, when the step can kill (`NIGHT_KILLERS`), for each player it might kill:
 * - `protected`: they cannot die tonight (the Storyteller's override, the Sailor, the
 *   Soldier or Monk against the Demon, the Tea Lady, the Innkeeper);
 * - `may-bounce`: the Mayor, against the Demon, so another player might die instead;
 * - `survives-first-death`: the Fool, until their No Ability token is placed;
 * - `on-death`: dying sets off an ability (the Ravenkeeper wakes, the Farmer passes on,
 *   the Grandmother dies with her grandchild...).
 *
 * Every alert names its subject seat and its source, and says whether the source's
 * ability works now (`works`, with `impairments` when it does not): a poisoned Monk's
 * Safe token protects nobody, which is itself worth a reminder. Data only, no wording.
 *
 * Basis: each character's ability text in TPI's data and its wiki page (cited per entry);
 * the reminders come from the tokens on the board, so the Storyteller stays in charge.
 * Day-only effects (the Pacifist, the Devil's Advocate) are not night alerts.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, type AbilitySource, type Impairment } from './ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/** Who a killing step's ability is: the Demon's kill, or another ability's. */
export type KillBy = 'demon' | 'other';

export interface NightKiller {
	by: KillBy;
	/** `self`: the ability can only kill its own player (the Gambler, the Acrobat). */
	targets: 'any' | 'self';
	/** The Assassin's kill ignores protection. */
	ignoresProtection?: true;
	wiki: string;
}

const demon = (name: string): NightKiller => ({ by: 'demon', targets: 'any', wiki: W + name });
const other = (name: string, targets: 'any' | 'self' = 'any'): NightKiller => ({
	by: 'other',
	targets,
	wiki: W + name
});

/**
 * Night steps that can kill. Every Demon kills at night except the Riot and the Leviathan,
 * whose deaths happen by day.
 */
export const NIGHT_KILLERS: Readonly<Record<CharacterId, NightKiller>> = {
	imp: demon('Imp'),
	po: demon('Po'),
	pukka: demon('Pukka'),
	shabaloth: demon('Shabaloth'),
	zombuul: demon('Zombuul'),
	nodashii: demon('No_Dashii'),
	vigormortis: demon('Vigormortis'),
	fanggu: demon('Fang_Gu'),
	vortox: demon('Vortox'),
	legion: demon('Legion'),
	lleech: demon('Lleech'),
	ojo: demon('Ojo'),
	kazali: demon('Kazali'),
	yaggababble: demon('Yaggababble'),
	alhadikhia: demon('Al-Hadikhia'),
	lordoftyphon: demon('Lord_of_Typhon'),
	lilmonsta: demon("Lil'_Monsta"),
	assassin: { by: 'other', targets: 'any', ignoresProtection: true, wiki: W + 'Assassin' },
	godfather: other('Godfather'),
	gossip: other('Gossip'),
	lycanthrope: other('Lycanthrope'),
	harlot: other('Harlot'),
	gambler: other('Gambler', 'self'),
	acrobat: other('Acrobat', 'self')
};

/** Abilities set off by their player's death, and which deaths count. */
export const ON_DEATH: Readonly<Record<CharacterId, { by: KillBy | 'any'; wiki: string }>> = {
	ravenkeeper: { by: 'any', wiki: W + 'Ravenkeeper' },
	farmer: { by: 'any', wiki: W + 'Farmer' },
	sage: { by: 'demon', wiki: W + 'Sage' },
	banshee: { by: 'demon', wiki: W + 'Banshee' },
	moonchild: { by: 'any', wiki: W + 'Moonchild' },
	sweetheart: { by: 'any', wiki: W + 'Sweetheart' },
	barber: { by: 'any', wiki: W + 'Barber' },
	klutz: { by: 'any', wiki: W + 'Klutz' },
	plaguedoctor: { by: 'any', wiki: W + 'Plague_Doctor' }
};

export type NightAlertKind =
	'impaired' | 'protected' | 'may-bounce' | 'survives-first-death' | 'on-death';

export interface NightAlert {
	kind: NightAlertKind;
	/** The player the alert is about: the waking player, or one who might die. */
	seatId: SeatId;
	/** Whose ability it is; 'override' for the Storyteller's "can die" override. */
	source: AbilitySource | 'override';
	/** Whether the source's ability works now; when not, it does nothing tonight. */
	works: boolean;
	/** Why the source's ability does not work (empty when it works). */
	impairments: Impairment[];
	wiki?: string;
}

/** Seats whose true character, or token, is `characterId`. */
function actorSeats(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(s) =>
			trueCharacter(game, s, characters) === characterId ||
			game.seats[s]?.characterId === characterId
	);
}

/**
 * The game-state reminders for the step of `characterId` (see the module comment), in
 * this order: impaired waking players, then per player in seating order.
 */
export function nightStepAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const actors = actorSeats(game, characterId, characters);
	const out: NightAlert[] = [];
	for (const seatId of actors) {
		const state = abilityState(game, seatId, characters);
		if (state.impairments.length === 0) continue;
		out.push({
			kind: 'impaired',
			seatId,
			source: { characterId, seatId },
			works: false,
			impairments: state.impairments
		});
	}

	const killer = NIGHT_KILLERS[characterId];
	if (!killer) return out;
	const subjects = (killer.targets === 'self' ? actors : game.seating).filter(
		(s) => getSeat(game, s)?.dead === false
	);
	for (const seatId of subjects) out.push(...deathAlerts(game, seatId, killer, characters));
	return out;
}

function sourceAlert(
	game: Game,
	kind: NightAlertKind,
	seatId: SeatId,
	source: AbilitySource,
	characters: CharacterLookup,
	wiki: string
): NightAlert {
	const impairments = source.seatId
		? abilityState(game, source.seatId, characters).impairments
		: [];
	return { kind, seatId, source, works: impairments.length === 0, impairments, wiki };
}

function deathAlerts(
	game: Game,
	seatId: SeatId,
	killer: NightKiller,
	characters: CharacterLookup
): NightAlert[] {
	const seat = game.seats[seatId];
	const own = trueCharacter(game, seatId, characters);
	const out: NightAlert[] = [];
	const alert = (kind: NightAlertKind, source: AbilitySource, wiki: string) =>
		out.push(sourceAlert(game, kind, seatId, source, characters, wiki));
	const holder = (id: CharacterId) =>
		game.seating.find((s) => trueCharacter(game, s, characters) === id);

	if (!killer.ignoresProtection) {
		const override = seat.overrides.find((o) => o.field === 'canDie');
		if (override && !override.value) {
			out.push({ kind: 'protected', seatId, source: 'override', works: true, impairments: [] });
		}
		if (own === 'sailor') alert('protected', { characterId: 'sailor', seatId }, W + 'Sailor');
		if (own === 'soldier' && killer.by === 'demon') {
			alert('protected', { characterId: 'soldier', seatId }, W + 'Soldier');
		}
		const tokens: [CharacterId, string, KillBy | 'any', string][] = [
			['tealady', 'Cannot Die', 'any', 'Tea_Lady'],
			['innkeeper', 'Safe', 'any', 'Innkeeper'],
			['monk', 'Safe', 'demon', 'Monk']
		];
		for (const [source, label, against, page] of tokens) {
			if (against !== 'any' && against !== killer.by) continue;
			const token = seat.reminders.find((r) => r.characterId === source && r.label === label);
			if (!token) continue;
			const from = holder(source);
			alert(
				'protected',
				{ characterId: source, ...(from ? { seatId: from } : {}), reminderId: token.reminderId },
				W + page
			);
		}
		if (own === 'mayor' && killer.by === 'demon') {
			alert('may-bounce', { characterId: 'mayor', seatId }, W + 'Mayor');
		}
		const foolSpent = seat.reminders.some(
			(r) => r.characterId === 'fool' && r.label === 'No Ability'
		);
		if (own === 'fool' && !foolSpent) {
			alert('survives-first-death', { characterId: 'fool', seatId }, W + 'Fool');
		}
	}

	const trigger = own ? ON_DEATH[own] : undefined;
	if (own && trigger && (trigger.by === 'any' || trigger.by === killer.by)) {
		alert('on-death', { characterId: own, seatId }, trigger.wiki);
	}
	// The Grandmother dies if the Demon kills her grandchild.
	const grandchild = seat.reminders.find(
		(r) => r.characterId === 'grandmother' && r.label === 'Grandchild'
	);
	if (grandchild && killer.by === 'demon') {
		const from = holder('grandmother');
		alert(
			'on-death',
			{
				characterId: 'grandmother',
				...(from ? { seatId: from } : {}),
				reminderId: grandchild.reminderId
			},
			W + 'Grandmother'
		);
	}
	return out;
}
