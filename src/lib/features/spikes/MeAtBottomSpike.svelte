<script lang="ts">
	import { page } from '$app/state';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { editionScript } from '#lib/core/data/script.ts';
	import type { PublicSeat, PublicSeatLayout } from '#lib/core/sync/public-projection.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import PlayerGrim from '#lib/features/player/PlayerGrim.svelte';
	import { writeGuesses } from '#lib/features/player/grim-guesses.ts';

	/** Mock-up only: sample towns for "me at the bottom" (not for merging). */
	const NAMES = [
		'Ana',
		'Bartholomew',
		'Cy',
		'Dee',
		'Esmeralda',
		'Finn',
		'Gus',
		'Hattie',
		'Ivo',
		'Jo',
		'Kit',
		'Lou',
		'Maximilian',
		'Nell',
		'Oz',
		'Pip',
		'Quin',
		'Rue',
		'Sol',
		'Tam'
	];
	interface Case {
		count: number;
		me?: number;
		travellers?: string[];
		dead?: number[];
		layout?: PublicSeatLayout;
	}
	const id = (n: number) => `s${n}`;
	const CASES: Record<string, Case> = {
		five: { count: 5, me: 1 },
		twenty: { count: 20, me: 6, dead: [2, 9, 14] },
		travellers: { count: 18, me: 4, travellers: ['thief', 'gunslinger', 'beggar'], dead: [7] },
		gaps: {
			count: 7,
			me: 4,
			layout: { shape: 'oval', gaps: { s2: 2, s5: 1 }, placed: {} }
		},
		couch: {
			count: 8,
			me: 5,
			layout: {
				shape: 'oval',
				gaps: {},
				placed: {
					s1: { x: 25, y: 14 },
					s2: { x: 50, y: 14 },
					s3: { x: 75, y: 14 },
					s4: { x: 82, y: 40 },
					s5: { x: 82, y: 55 },
					s6: { x: 82, y: 70 },
					s7: { x: 45, y: 86 },
					s8: { x: 22, y: 86 }
				}
			}
		},
		circle: { count: 11, me: 3, layout: { shape: 'circle', gaps: {}, placed: {} } },
		unseated: { count: 9 }
	};
	const name = $derived(page.url.searchParams.get('case') ?? 'twenty');
	const which = $derived(CASES[name] ?? CASES.twenty);
	const rotated = $derived(page.url.searchParams.get('rotated') === '1');

	const seats = $derived(
		Array.from({ length: which.count }, (_, i): PublicSeat => {
			const n = i + 1;
			const t = which.travellers?.[i - (which.count - (which.travellers?.length ?? 0))];
			const dead = which.dead?.includes(n) ?? false;
			return {
				seatId: id(n) as PublicSeat['seatId'],
				seatNumber: n,
				playerName: NAMES[i] as PublicSeat['playerName'],
				dead,
				...(dead ? { ghostVote: n % 2 ? 'unused' : 'used' } : {}),
				...(t ? { traveller: t as PublicSeat['traveller'] } : {})
			} as PublicSeat;
		})
	);

	let script = $state<LoadedScript>();
	const key = $derived(`mock:${name}`);
	$effect(() => {
		// A couple of the player's own guesses and notes, to show they turn with their seats.
		writeGuesses(key, { s2: ['empath', 'chef'], s5: ['imp'], s8: ['townsfolk'] });
		loadOfficialData().then((data) => (script = editionScript('tb', data)));
	});
</script>

{#if script}
	{#key `${name}-${rotated}`}
		<PlayerGrim
			{script}
			meAtBottom={rotated}
			town={{
				seats,
				layout: which.layout,
				storytellerName: 'Trevor',
				corner: {
					modes: [],
					phase: { kind: 'day', number: 2 },
					players: String(which.count)
				},
				gameId: 'mock',
				guessKey: key,
				me: which.me ? id(which.me) : undefined
			}}
		/>
	{/key}
{/if}
