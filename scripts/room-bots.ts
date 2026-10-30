/**
 * Fake players' phones for testing live rooms (Trevor, 2026-10-30: "spoof up to max player
 * count devices as they connect to a room and play a game"). Each bot speaks the room's own
 * protocol (core/sync/room-protocol.ts) over a WebSocket, as the app does, and answers what it
 * sees like a player: its name, a seat, the count off, its character, votes and feedback.
 *
 *   node scripts/room-bots.ts 482913 [--players 15]
 *     Joins bots to a room you run from your Storyteller device, until Ctrl+C (or --minutes).
 *   node scripts/room-bots.ts --storyteller [--players 15] [--seats 12]
 *     Opens its own room, fakes the Storyteller too and plays a whole game; exits 1 if a step
 *     fails. Players past --seats stay spectators.
 *
 * --site https://beta.grimbinder.com (the default; a join link names its own site), or
 * http://localhost:8787 for `npm run preview`. --think 1500: the longest pause, in ms, before a
 * bot answers. --flaky: phones lock their screen now and then. --timeout 60: seconds a step
 * may take. --keep: leave the --storyteller room open at the end.
 */
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { MAX_MEMBERS } from '#lib/core/sync/room-presence.ts';
import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
import { viewProblems } from './lib/room-bots/checks.ts';
import { playGame } from './lib/room-bots/game.ts';
import { PhoneBot } from './lib/room-bots/phone-bot.ts';
import { FakeStoryteller } from './lib/room-bots/storyteller.ts';
import { JoinQueue } from './lib/room-bots/socket.ts';

const DEFAULT_SITE = 'https://beta.grimbinder.com';

/** Names that read as bots on the board, distinct, one per member a room holds. */
export const BOT_NAMES = Array.from({ length: MAX_MEMBERS }, (_, i) => `Bot ${i + 1}`);

/** The room and site from a code ("482 913") or a join link (https://…/join/482913). */
export function parseTarget(
	target: string,
	site = DEFAULT_SITE
): { code: string; site: string } | null {
	const link = target.match(/^(https?:\/\/[^/]+)\/join\/([\d\s-]+)/);
	const code = normaliseRoomCode(link ? link[2] : target);
	return code ? { code, site: link ? link[1] : site } : null;
}

/** One line per bot: connected or not, name, seat, what it was last shown. */
export function statusLines(bots: readonly PhoneBot[]): string[] {
	return bots.map((b) => {
		const view = b.view;
		const seat = view?.public?.seats.find((s) => s.seatId === view.me.seatId);
		const parts = [
			b.connected ? '●' : '○',
			b.name.padEnd(7),
			seat ? `seat ${seat.seatNumber}` : 'no seat',
			view?.role?.characterId ?? view?.role?.alignment ?? '',
			b.phases.at(-1) ?? '',
			b.refused ? `refused: ${b.refused}` : ''
		];
		return parts.filter(Boolean).join('  ');
	});
}

const log = (line: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			players: { type: 'string', default: '15' },
			seats: { type: 'string' },
			site: { type: 'string', default: DEFAULT_SITE },
			think: { type: 'string', default: '1500' },
			timeout: { type: 'string', default: '60' },
			minutes: { type: 'string' },
			storyteller: { type: 'boolean', default: false },
			flaky: { type: 'boolean', default: false },
			keep: { type: 'boolean', default: false }
		}
	});
	const players = Number(values.players);
	if (!Number.isInteger(players) || players < 1 || players > MAX_MEMBERS) {
		throw new Error(`--players must be 1 to ${MAX_MEMBERS} (a room's limit, MAX_MEMBERS)`);
	}
	const seats = Math.min(players, Number(values.seats ?? players));
	const queue = new JoinQueue();
	let site = values.site;
	let code: string;
	let st: FakeStoryteller | undefined;
	if (values.storyteller) {
		st = new FakeStoryteller(site, queue, log, Number(values.timeout) * 1000);
		code = await st.open();
		log(`Opened room ${code} on ${site}; watch it from a phone with Join game.`);
	} else {
		const target = parseTarget(positionals[0] ?? '', site);
		if (!target) throw new Error('Give a room code or join link, or --storyteller');
		({ code, site } = target);
	}

	let checkSoon: ReturnType<typeof setTimeout> | undefined;
	const bots: PhoneBot[] = [];
	// Views arrive one phone at a time, so checks wait for the room to go quiet.
	const changed = () => {
		clearTimeout(checkSoon);
		checkSoon = setTimeout(() => {
			for (const p of viewProblems(
				new Map(bots.flatMap((b) => (b.view ? [[b.name, b.view]] : [])))
			)) {
				log(`! ${p}`);
			}
		}, 3000);
	};
	for (let i = 0; i < players; i++) {
		const options = {
			site,
			code,
			queue,
			thinkMs: Number(values.think),
			flaky: values.flaky,
			log,
			changed
		};
		bots.push(new PhoneBot({ index: i, name: BOT_NAMES[i], random: Math.random }, options));
	}
	log(`Joining ${players} bots to room ${code}…`);
	await Promise.all(bots.map((b) => b.start().catch((e: Error) => log(`${b.name}: ${e.message}`))));

	const stop = (exitCode: number) => {
		for (const b of bots) b.stop();
		if (st && !values.keep) st.close();
		clearTimeout(checkSoon);
		setTimeout(() => process.exit(exitCode), 500);
	};
	process.on('SIGINT', () => {
		log('Stopping.');
		stop(0);
	});

	if (st) {
		const passed = await playGame(st, bots, seats, log);
		const failed = st.steps.filter((s) => !s.ok);
		log(passed ? `All ${st.steps.length} steps passed.` : `${failed.length} steps failed.`);
		console.log(statusLines(bots).join('\n'));
		stop(passed ? 0 : 1);
		return;
	}
	const report = setInterval(() => console.log(`\n${statusLines(bots).join('\n')}\n`), 15_000);
	if (values.minutes) {
		setTimeout(
			() => {
				clearInterval(report);
				stop(0);
			},
			Number(values.minutes) * 60_000
		);
	}
}

// Run, not imported by its test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((e: Error) => {
		console.error(e.message);
		process.exit(1);
	});
}
