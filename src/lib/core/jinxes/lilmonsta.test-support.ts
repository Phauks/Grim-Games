/**
 * Shared set-up for Lil' Monsta's babysitting jinxes (L116; each page's Related Jinxes on the
 * wiki, https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes): a game on a
 * script holding Lil' Monsta and the cast, so the jinxes between them are in effect. Lil'
 * Monsta is never dealt; the Minions choose who babysits it, marked Is The Demon.
 */
import type { CharacterId, ReminderLabel, Script } from '#lib/core/data/index.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

export const scriptOf = (ids: readonly string[]): Script => ({
	meta: { name: 'Babysitting' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

/** The cast, one seat each, on a script of the cast and Lil' Monsta. */
export function withLilMonsta(cast: CharacterId[]): Scenario {
	return scenario(cast, { script: scriptOf([...cast, 'lilmonsta']) });
}

/** Lil' Monsta's babysitter token. */
const IS_THE_DEMON = 'Is The Demon' as ReminderLabel;
export const babysitter = { characterId: 'lilmonsta', label: IS_THE_DEMON } as const;

/** `on` babysits Lil' Monsta. */
export const babysits = (s: Scenario, on: CharacterId) => s.reminder(on, 'lilmonsta', IS_THE_DEMON);
