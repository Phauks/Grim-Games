<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { BagSlot } from '#lib/core/rules/bag-plan.ts';
	import { seatNumber } from '#lib/core/model/index.ts';
	import { nextPairSeat, pairTiles, STANDARD, type TilePair } from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import BagTiles from '#lib/features/setup/BagTiles.svelte';
	import RevealDialog from '#lib/features/setup/RevealDialog.svelte';
	import { tileMarks } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { townGroup } from './town-groups.ts';

	/**
	 * Two games at once, drawn together (Trevor, 2026-10-18: "have the characters draw both
	 * tokens at the same time. The same one token will account for both pulls"). Each town
	 * builds its own bag in its own setup; here one token is a tile from each bag, and taking
	 * it draws and confirms both halves in their own games, as each town's Draw would.
	 */
	interface Props {
		groupId: string;
	}

	let { groupId }: Props = $props();

	const group = $derived(townGroup(groupId));
	const mode = $derived(findMode(group?.modeId ?? '') ?? STANDARD);

	let towns = $state.raw<[OpenGame, OpenGame] | undefined>();
	let missing = $state(false);

	$effect(() => {
		const ids = group?.gameIds ?? [];
		let cancelled = false;
		(async () => {
			try {
				const data = await loadOfficialData();
				const opened = await Promise.all(ids.map((id) => OpenGame.open(data, id)));
				if (cancelled) return;
				const [a, b] = opened;
				if (opened.length !== 2 || !a || !b) missing = true;
				else towns = [a, b];
			} catch (e) {
				reportError(e, { area: 'setup' });
			}
		})();
		return () => (cancelled = true);
	});

	const games = $derived(towns ? ([towns[0].game, towns[1].game] as const) : undefined);
	const pairs = $derived.by((): TilePair[] | undefined => {
		if (!towns || !games) return undefined;
		const [a, b] = games;
		if (!a.bag || !b.bag) return undefined;
		const lookup = towns;
		return pairTiles(
			mode,
			[a.bag, b.bag],
			games,
			(id) => (lookup[0].characters.get(id) ?? lookup[1].characters.get(id))?.type
		);
	});
	const sizes = $derived(games?.map((g) => (g.bag ? Object.keys(g.bag.tiles).length : 0)) ?? []);
	const next = $derived(games && pairs ? nextPairSeat(games, pairs) : undefined);
	const inBag = $derived(pairs?.filter((p) => p.state !== 'drawn').length ?? 0);

	const face = $derived(preferences.current.tileFace);
	const marks = $derived(
		tileMarks(
			pairs?.length ?? 0,
			face,
			`${groupId}:${pairs?.[0]?.tiles[0] ?? ''}`,
			preferences.current.tileOrderRandom
		)
	);
	const markName = (number: number) => marks[number - 1]?.name ?? String(number);

	// BagTiles draws slots of one bag: each pair is one slot, held by its seat in town 1.
	const slots = $derived<BagSlot[]>(
		(pairs ?? []).map((p) => {
			const seatId = p.seat !== undefined ? games?.[0].seating[p.seat] : undefined;
			return {
				tileId: p.tiles[0],
				number: p.number,
				state: p.state,
				...(seatId ? { seatId } : {})
			};
		})
	);

	function label(seat: number | undefined): string {
		if (seat === undefined || !games) return t('common.none');
		const seatId = games[0].seating[seat];
		const number = t('common.seat', {
			number: (seatId && seatNumber(games[0], seatId)) ?? seat + 1
		});
		const name = seatId && games[0].seats[seatId]?.playerName;
		return name ? `${number} · ${name}` : number;
	}

	let revealing = $state<TilePair | undefined>();
	let revealOpen = $state(false);
	const shown = $derived(pairs?.find((p) => p.number === revealing?.number));

	function run(town: 0 | 1, command: Parameters<OpenGame['run']>[0]): boolean {
		const result = towns?.[town].run(command);
		if (result && !result.ok) toast(t('setup.couldNot'), result.error.message);
		return result?.ok === true;
	}

	function draw(pair: TilePair) {
		if (!towns || !games) return;
		if (pair.state === 'held') {
			revealing = pair;
			revealOpen = true;
			return;
		}
		// Read once: drawing the first half already moves `next` on.
		const seat = next;
		if (seat === undefined) {
			toast(t('setup.draw.everySeat'), t('setup.draw.everySeatHint'));
			return;
		}
		// Both halves or neither: a half already taken (drawn in a town's own Draw) stays.
		for (const town of [0, 1] as const) {
			const tile = games[town].bag?.tiles[pair.tiles[town]];
			const seatId = games[town].seating[seat];
			if (tile && tile.drawnBySeat === undefined && seatId)
				if (!run(town, { type: 'DrawTile', seatId, tileId: tile.tileId })) return;
		}
		revealing = pair;
		revealOpen = true;
	}

	function confirm(details: { playerName: string; alignment?: Alignment }) {
		if (!towns || !shown) return;
		const name = details.playerName.trim();
		for (const town of [0, 1] as const) {
			const game = towns[town].game;
			const tile = game.bag?.tiles[shown.tiles[town]];
			if (!tile?.drawnBySeat) continue;
			const traveller = towns[town].characters.get(tile.grimoire)?.type === 'traveller';
			if (!tile.confirmed) {
				const ok = run(town, {
					type: 'ConfirmDraw',
					tileId: tile.tileId,
					...(traveller && details.alignment ? { alignment: details.alignment } : {})
				});
				if (!ok) return;
			}
			if (name !== (game.seats[tile.drawnBySeat]?.playerName ?? ''))
				run(town, { type: 'RenameSeat', seatId: tile.drawnBySeat, playerName: name });
		}
		revealOpen = false;
	}

	const halves = $derived.by(() => {
		if (!towns || !shown) return undefined;
		const [a, b] = [0, 1].map((town) => {
			const tile = towns![town].game.bag?.tiles[shown.tiles[town]];
			return tile ? towns![town].characters.get(tile.shows) : undefined;
		});
		return a && b ? { a, b } : undefined;
	});
	const needsAlignment = $derived(
		!!towns &&
			!!shown &&
			[0, 1].some((town) => {
				const tile = towns![town].game.bag?.tiles[shown.tiles[town]];
				return tile && towns![town].characters.get(tile.grimoire)?.type === 'traveller';
			})
	);
</script>

<Page title={t('modes.towns.drawTitle')}>
	<ErrorBoundary area="setup">
		{#if !group || missing}
			<p role="alert">{t('modes.towns.missing')}</p>
		{:else if towns && !pairs}
			<!-- Each town builds its bag first, the same size, so every pull has a pair. -->
			<p role="alert" data-testid="paired-blocked">
				{sizes.some((n) => n === 0)
					? t('modes.towns.drawNeedsBags')
					: t('modes.towns.drawSizes', { first: sizes[0], second: sizes[1] })}
			</p>
		{:else if pairs}
			<BagTiles
				{slots}
				{marks}
				seatLabel={(seatId) =>
					label(seatId && games ? games[0].seating.indexOf(seatId) : undefined)}
				onpick={(s) => {
					const pair = pairs?.find((p) => p.number === s.number);
					if (pair) draw(pair);
				}}
			/>
		{/if}
		<div class="done">
			<Button
				variant="accent"
				icon="forward"
				disabled={!pairs || inBag > 0}
				href={resolve('/towns/[groupId]', { groupId })}>{t('modes.towns.drawDone')}</Button
			>
		</div>
	</ErrorBoundary>
</Page>

{#if shown && halves}
	<RevealDialog
		bind:open={revealOpen}
		number={markName(shown.number)}
		shows={halves.a}
		pair={{
			shows: halves.b,
			labels: [t('modes.towns.town', { number: 1 }), t('modes.towns.town', { number: 2 })]
		}}
		{needsAlignment}
		seatLabel={label(shown.seat)}
		playerName={(() => {
			const seatId = shown.seat !== undefined ? games?.[0].seating[shown.seat] : undefined;
			return (seatId && games?.[0].seats[seatId]?.playerName) || '';
		})()}
		onConfirm={confirm}
	/>
{/if}

<style>
	p {
		margin: 0;
	}
	.done {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-3);
	}
</style>
