/**
 * Sample games for the /spikes/day demo: 8 players on Sects & Violets (Town Crier,
 * Flowergirl, Juggler, Gossip, Witch), Trouble Brewing (Washerwoman, Slayer, Virgin,
 * Undertaker, and a Drunk who thinks they are the Chef), or an assorted script for
 * abilities that misfire (a Gambler, a Chef beside a Recluse, a Mathematician, a Preacher
 * who chose the Poisoner, a Grandmother). Built through the real engine.
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

export type Variant = 'snv' | 'tb' | 'mixed';

const SAMPLE_NAMES = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

interface Sample {
	cast: string[];
	/** Reminder tokens already on seats (by seat index). */
	reminders: [number, Reminder][];
}

const SAMPLES: Record<Variant, Sample> = {
	snv: {
		cast: ['towncrier', 'flowergirl', 'juggler', 'gossip', 'witch', 'fanggu', 'artist', 'mutant'],
		reminders: [[6, { characterId: 'witch', label: 'Cursed' }]]
	},
	tb: {
		cast: ['washerwoman', 'slayer', 'virgin', 'undertaker', 'empath', 'chef', 'poisoner', 'imp'],
		reminders: [[5, { characterId: 'drunk', label: 'Is The Drunk' }]]
	},
	mixed: {
		cast: [
			'gambler',
			'chef',
			'recluse',
			'poisoner',
			'imp',
			'mathematician',
			'preacher',
			'grandmother'
		],
		reminders: [
			[3, { characterId: 'preacher', label: 'No Ability' }],
			[1, { characterId: 'grandmother', label: 'Grandchild' }]
		]
	}
};

/** The assorted script: the sample's characters plus a few that misfire the same way. */
const MIXED_SCRIPT: Script = {
	meta: { name: 'Assorted' },
	entries: [...SAMPLES.mixed.cast, 'acrobat', 'lycanthrope', 'pixie', 'spy'].map((id) => ({
		kind: 'official',
		id
	}))
};

function editionAsScript(edition: Exclude<Variant, 'mixed'>, data: GameData): Script {
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
			script: variant === 'mixed' ? MIXED_SCRIPT : editionAsScript(variant, data),
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
