/**
 * The game room-bots.ts `--storyteller` plays: every live-room feature a table uses, in the
 * order a table uses them, each a step that passes once every phone shows it.
 */
import type { Script } from '#lib/core/data/index.ts';
import { viewProblems } from './checks.ts';
import type { PhoneBot } from './phone-bot.ts';
import { deal, type FakeStoryteller } from './storyteller.ts';

const TROUBLE_BREWING = [
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor',
	'butler',
	'drunk',
	'recluse',
	'saint',
	'poisoner',
	'spy',
	'scarletwoman',
	'baron',
	'imp'
];

const views = (bots: readonly PhoneBot[]) =>
	new Map(bots.flatMap((b) => (b.view ? [[b.name, b.view] as const] : [])));

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

/** Plays one game; resolves with whether every step passed. */
export async function playGame(
	st: FakeStoryteller,
	bots: readonly PhoneBot[],
	seatCount: number,
	log: (line: string) => void
): Promise<boolean> {
	let ok = true;
	const step = async (...args: Parameters<FakeStoryteller['step']>) => {
		const passed = await st.step(...args);
		const problems = viewProblems(views(bots));
		for (const p of problems) log(`  ! ${p}`);
		ok &&= passed && problems.length === 0;
		return passed;
	};
	const named = () => st.members().filter((m) => m.name);
	const seated = () => (st.host?.members ?? []).filter((m) => m.seatId);
	const missing = (has: (b: PhoneBot) => boolean) => () =>
		`not yet: ${bots
			.filter((b) => !has(b))
			.map((b) => b.name)
			.join(', ')}`;

	await step(
		'Every phone joins and gets its name',
		() => {},
		() => named().length >= bots.length,
		() => `${named().length} of ${bots.length}`
	);
	const script = {
		name: 'Trouble Brewing',
		entries: TROUBLE_BREWING.map((id) => ({ kind: 'official', id }))
	} as unknown as Script;
	await step(
		'The script reaches every phone',
		() => st.send({ type: 'script', script }),
		() => true
	);

	await step(
		`Phones claim the ${seatCount} empty seats`,
		() => st.setUp(seatCount),
		() => seated().length >= seatCount,
		() => `${seated().length} seated`
	);
	const spectators = bots.length - seatCount;
	if (spectators > 0) {
		await step(
			spectators === 1
				? 'The spectator votes (Specters)'
				: `The ${spectators} spectators vote (Specters)`,
			() =>
				st.send({
					type: 'open-vote',
					voteId: `vote-${Date.now()}`,
					options: st.seats().map((s) => s.seatId),
					ability: 'Bots test vote'
				}),
			() => (st.host?.vote?.voted ?? 0) >= spectators,
			() => `${st.host?.vote?.voted ?? 0} voted`
		);
		st.send({ type: 'close-vote' });
	}

	const wishesBefore = st.wishes;
	await step(
		'Phones move their own seat while seating is open',
		() => st.send({ type: 'seating', open: true }),
		() => st.wishes - wishesBefore >= seatCount,
		() => `${st.wishes - wishesBefore} moves asked`
	);
	st.send({ type: 'seating', open: false });

	await step(
		'Every phone taps its number in the count off',
		() => st.send({ type: 'count-off' }),
		() => (st.host?.countOff?.tokens.length ?? 0) >= bots.length,
		() => `${st.host?.countOff?.tokens.length ?? 0} numbers held`
	);
	st.seatByCount();
	st.send({ type: 'end-count-off' });

	const roles = deal(seatCount);
	const bySeat = Object.fromEntries(st.seats().map((s, i) => [s.seatId, roles[i]]));
	await step(
		'Every seated phone holds to see its own character',
		() => st.send({ type: 'roles', gameId: st.gameId, show: true, roles: bySeat }),
		() => (st.host?.rolesSeen?.length ?? 0) >= seatCount,
		() => `${st.host?.rolesSeen?.length ?? 0} seen`
	);
	for (const bot of bots) {
		const seatId = bot.view?.me.seatId;
		const want = seatId ? bySeat[seatId] : undefined;
		const got = bot.view?.role;
		if (got && JSON.stringify(got) !== JSON.stringify(want)) {
			log(`  ! ${bot.name} was shown ${JSON.stringify(got)}, its seat has ${JSON.stringify(want)}`);
			ok = false;
		}
	}
	st.send({ type: 'roles', gameId: st.gameId, show: false });

	const imp = st.seats()[roles.findIndex((r) => r.characterId === 'imp')]?.seatId;
	let winner: 'good' | 'evil' | undefined;
	for (let n = 1; !winner && n <= seatCount; n++) {
		const at = (phase: string) => (b: PhoneBot) => b.phases.at(-1) === phase;
		await step(
			`Night ${n} reaches every phone`,
			() => {
				if (n > 1) {
					const victim = pick(st.seats().filter((s) => !s.dead && s.seatId !== imp));
					if (victim) st.kill(victim.seatId);
				}
				st.phase('night', n);
			},
			() => bots.every(at(`night ${n}`)),
			missing(at(`night ${n}`))
		);
		await step(
			`Day ${n} reaches every phone, with a nomination and an execution`,
			() => {
				st.phase('day', n);
				const alive = st.seats().filter((s) => !s.dead);
				const nominee = pick(alive);
				st.execute(pick(alive).seatId, nominee.seatId);
				if (nominee.seatId === imp) winner = 'good';
				else if (alive.length - 1 <= 2) winner = 'evil';
			},
			() =>
				bots.every((b) => at(`day ${n}`)(b) && (b.view?.public?.today.executions.length ?? 0) > 0),
			missing(at(`day ${n}`))
		);
	}

	await step(
		`Game over (${winner ?? 'no'} win) reaches every phone`,
		() =>
			st.send({
				type: 'game-over',
				gameId: st.gameId,
				winner: winner ?? 'good',
				reason: winner === 'evil' ? 'two-alive' : 'demon-dead'
			}),
		() => bots.every((b) => !!b.view?.ended),
		missing((b) => !!b.view?.ended)
	);
	await step(
		'Every phone rates the game',
		() => {},
		() => (st.host?.feedback?.length ?? 0) >= bots.length,
		() => `${st.host?.feedback?.length ?? 0} ratings`
	);

	await step(
		'Every phone votes on the next script',
		() => {
			st.send({ type: 'choosing', on: true });
			st.send({
				type: 'open-script-vote',
				voteId: `next-${Date.now()}`,
				kind: 'ranked',
				options: [
					{ id: 'tb', name: 'Trouble Brewing' },
					{ id: 'bmr', name: 'Bad Moon Rising' },
					{ id: 'snv', name: 'Sects & Violets' }
				],
				showTally: true
			});
		},
		() => (st.host?.scriptVote?.voted ?? 0) >= bots.length,
		() => `${st.host?.scriptVote?.voted ?? 0} ballots`
	);
	st.send({ type: 'end-script-vote' });
	st.send({ type: 'close-script-vote' });
	st.send({ type: 'choosing', on: false });
	return ok;
}
