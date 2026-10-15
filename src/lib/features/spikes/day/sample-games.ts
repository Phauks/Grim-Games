/**
 * Sample games for the /spikes/day demo: 8 players on Sects & Violets (Town Crier,
 * Flowergirl, Juggler, Gossip, Witch) or Trouble Brewing (Washerwoman, Slayer, Virgin,
 * Undertaker, and a Drunk who thinks they are the Chef). Built through the real engine.
 */
import { editionScript, type GameData, type Script } from '#lib/core/data/index.ts';
import {
	createGame,
	dispatch,
	type Command,
	type EngineContext,
	type GameSession
} from '#lib/core/engine/index.ts';
import type { Reminder } from '#lib/core/model/index.ts';

export type Variant = 'snv' | 'tb';

export const SAMPLE_NAMES = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

interface Sample {
	cast: string[];
	/** Reminder tokens already on seats (by seat index). */
	reminders: [number, Reminder][];
}

export const SAMPLES: Record<Variant, Sample> = {
	snv: {
		cast: ['towncrier', 'flowergirl', 'juggler', 'gossip', 'witch', 'fanggu', 'artist', 'mutant'],
		reminders: [[6, { characterId: 'witch', label: 'Cursed' }]]
	},
	tb: {
		cast: ['washerwoman', 'slayer', 'virgin', 'undertaker', 'empath', 'chef', 'poisoner', 'imp'],
		reminders: [[5, { characterId: 'drunk', label: 'Is The Drunk' }]]
	}
};

export function editionAsScript(edition: Variant, data: GameData): Script {
	const loaded = editionScript(edition, data);
	if (!loaded) throw new Error(`no edition ${edition}`);
	return {
		meta: loaded.meta,
		entries: loaded.characters.map((c) => ({ kind: 'official', id: c.id }))
	};
}

export function sampleSession(variant: Variant, data: GameData, ctx: EngineContext): GameSession {
	const sample = SAMPLES[variant];
	const created = createGame(
		{
			type: 'CreateGame',
			script: editionAsScript(variant, data),
			playerCount: SAMPLE_NAMES.length
		},
		ctx
	);
	if (!created.ok) throw new Error(created.error.message);
	let session = created.session;
	const seats = session.game.seating;
	const commands: Command[] = [
		...SAMPLE_NAMES.map((playerName, i): Command => ({
			type: 'RenameSeat',
			seatId: seats[i],
			playerName
		})),
		...sample.cast.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...sample.reminders.map(([i, reminder]): Command => ({
			type: 'AddReminder',
			seatId: seats[i],
			reminder
		}))
	];
	for (const command of commands) {
		const result = dispatch(session, command, ctx);
		if (!result.ok) throw new Error(result.error.message);
		session = result.session;
	}
	return session;
}
