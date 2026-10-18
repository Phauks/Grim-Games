<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { seatNumber, type SeatId } from '#lib/core/model/index.ts';
	import {
		canMoveTown,
		inEveryTown,
		moveIntoTown,
		movesOnDay,
		STANDARD,
		type PlayerAcrossTowns
	} from '#lib/core/modes/index.ts';
	import { setupComplete } from '#lib/core/rules/bag-plan.ts';
	import { dayNumber } from '#lib/core/rules/night-order.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import { findMode } from './custom-modes.svelte.ts';
	import { townGroup } from './town-groups.ts';

	/**
	 * The towns of one game mode game (Two Towns and a Boomdandy, Two games at once), each an
	 * ordinary saved game opened from here. Two games at once seats the same players in both,
	 * so names are set once for both and a player who is the Demon in both is flagged. Two
	 * Towns moves living players across at the end of each day, keeping their character and
	 * the reminders on their own seat
	 * (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/).
	 */
	interface Props {
		groupId: string;
	}

	let { groupId }: Props = $props();

	const group = $derived(townGroup(groupId));
	const mode = $derived(findMode(group?.modeId ?? '') ?? STANDARD);
	const samePlayers = $derived(mode.parts.towns?.samePlayers === true);
	const moving = $derived(
		mode.parts.daySteps?.some((s) => s.kind === 'town-representative') === true
	);

	let towns = $state.raw<OpenGame[] | undefined>();
	let missing = $state(false);
	let inspecting = $state(false);
	let choosing = $state(false);
	let move = $state<{ from: number; seatId: SeatId } | undefined>();
	let confirming = $state(false);

	$effect(() => {
		const ids = group?.gameIds ?? [];
		let cancelled = false;
		(async () => {
			try {
				const data = await loadOfficialData();
				const opened = await Promise.all(ids.map((id) => OpenGame.open(data, id)));
				if (cancelled) return;
				if (opened.some((g) => !g) || ids.length === 0) missing = true;
				towns = opened.filter((g): g is OpenGame => !!g);
			} catch (e) {
				reportError(e, { area: 'grimoire' });
			}
		})();
		return () => (cancelled = true);
	});

	function openHref(open: OpenGame) {
		const gameId = open.game.gameId;
		return setupComplete(open.game)
			? resolve('/grimoire/[gameId]', { gameId })
			: resolve('/grimoire/[gameId]/setup', { gameId });
	}

	function seatLabel(open: OpenGame, seatId: SeatId): string {
		const number = t('common.seat', { number: seatNumber(open.game, seatId) ?? 0 });
		const name = open.game.seats[seatId]?.playerName;
		return name ? `${number} · ${name}` : number;
	}

	// Two games at once: seat i is the same player in every game.
	const players = $derived(towns?.[0]?.game.seating.length ?? 0);
	const names = $derived(
		Array.from({ length: players }, (_, i) => {
			const seat = towns?.[0]?.game.seating[i];
			return (seat && towns?.[0]?.game.seats[seat]?.playerName) ?? '';
		})
	);
	let typed = $state<string[]>([]);
	$effect.pre(() => {
		if (typed.length !== names.length) typed = [...names];
	});

	function rename(i: number) {
		const name = typed[i]?.trim() ?? '';
		if (name === names[i]) return;
		for (const open of towns ?? []) {
			const seatId = open.game.seating[i];
			if (seatId) open.run({ type: 'RenameSeat', seatId, playerName: name });
		}
		towns = [...(towns ?? [])];
	}

	const warnings = $derived.by(() => {
		if (!towns || !samePlayers) return [];
		const across: PlayerAcrossTowns[] = Array.from({ length: players }, (_, i) => ({
			playerName: names[i] || t('common.seat', { number: i + 1 }),
			characters: (towns ?? []).map((open) => {
				const seat = open.game.seats[open.game.seating[i]];
				const character = seat?.characterId && open.characters.get(seat.characterId);
				return character ? { id: character.id, type: character.type } : undefined;
			})
		}));
		return inEveryTown(mode, across);
	});

	// Two Towns: the representative's moves at the end of the day.
	const day = $derived(towns?.[0] ? dayNumber(towns[0].game) : 0);
	const moves = $derived(movesOnDay(mode, day));
	const movable = $derived(
		(towns ?? []).flatMap((open, from) =>
			open.game.seating
				.filter((id) => canMoveTown(open.game.seats[id]))
				.map((seatId) => ({ from, seatId }))
		)
	);
	const target = $derived(move ? (move.from + 1) % (towns?.length ?? 1) : 0);

	function doMove() {
		if (!move || !towns) return;
		const from = towns[move.from];
		const to = towns[target];
		const seat = from.game.seats[move.seatId];
		if (!seat) return;
		const added = to.run({ type: 'AddSeat', playerName: seat.playerName });
		if (!added.ok) return void reportError(new Error(added.error.message), { area: 'grimoire' });
		const newSeatId = to.game.seating.at(-1)!;
		for (const command of moveIntoTown(seat, newSeatId)) to.run(command);
		from.run({ type: 'RemoveSeat', seatId: move.seatId });
		towns = [...towns];
		move = undefined;
	}
</script>

<Page title={mode.name}>
	{#snippet actions()}
		<!-- An icon, so a long mode name keeps the title row (Trevor, 2026-10-18). -->
		<IconButton
			icon="info"
			label={t('modes.inspect', { name: mode.name })}
			onclick={() => (inspecting = true)}
		/>
	{/snippet}

	{#if !group || missing}
		<p role="alert">{t('modes.towns.missing')}</p>
	{/if}

	{#if towns}
		<ol class="towns">
			{#each towns as open, i (open.game.gameId)}
				<li class="town" data-testid="town">
					<h2>{t('modes.towns.town', { number: i + 1 })}</h2>
					<p>{open.game.script.meta?.name ?? t('common.none')}</p>
					<p class="muted">
						{t('modes.towns.players', { count: open.game.seating.length })} ·
						{setupComplete(open.game)
							? t('modes.towns.day', { day: dayNumber(open.game) })
							: t('modes.towns.setup')}
					</p>
					<Button variant="accent" icon="grimoire" href={openHref(open)}>
						{t('modes.towns.open', { number: i + 1 })}
					</Button>
				</li>
			{/each}
		</ol>

		{#if samePlayers}
			<section aria-labelledby="names-heading">
				<h2 id="names-heading">{t('modes.towns.names')}</h2>
				<ol class="names">
					{#each Array.from(typed.keys()) as i (i)}
						<li>
							<label for="town-name-{i}">{t('common.seat', { number: i + 1 })}</label>
							<ClearableField bind:value={typed[i]} onclear={() => rename(i)}>
								<input
									id="town-name-{i}"
									type="text"
									autocomplete="off"
									bind:value={typed[i]}
									onblur={() => rename(i)}
									onkeydown={(e) => e.key === 'Enter' && rename(i)}
								/>
							</ClearableField>
						</li>
					{/each}
				</ol>
				<div class="warnings" data-testid="town-warnings">
					<span class="muted">{t('modes.towns.warnings')}</span>
					{#if warnings.length === 0}
						{t('common.none')}
					{:else}
						{#each warnings as w (w.playerName + w.type)}
							<p role="alert">
								{t('modes.towns.inEveryTown', { player: w.playerName, type: TYPE_LABELS[w.type] })}
							</p>
						{/each}
					{/if}
				</div>
			</section>
		{/if}

		{#if moving}
			<section aria-labelledby="moves-heading">
				<h2 id="moves-heading">{t('modes.towns.moves')}</h2>
				<p data-testid="town-moves">
					{day === 0
						? t('modes.towns.noMovesYet')
						: t('modes.towns.movesToday', { day, count: moves })}
				</p>
				<Button icon="swap" disabled={movable.length === 0} onclick={() => (choosing = true)}>
					{t('modes.towns.move')}
				</Button>
			</section>
		{/if}
	{/if}
</Page>

<ModeInspectDialog bind:open={inspecting} {mode} />

<Dialog bind:open={choosing} title={t('modes.towns.move')}>
	{#each towns ?? [] as open, from (open.game.gameId)}
		<h3>{t('modes.towns.town', { number: from + 1 })}</h3>
		<ul class="movable">
			{#each movable.filter((m) => m.from === from) as m (m.seatId)}
				{@const seat = open.game.seats[m.seatId]}
				<li>
					<button
						type="button"
						class="row"
						onclick={() => {
							move = m;
							choosing = false;
							confirming = true;
						}}
					>
						<span>{seatLabel(open, m.seatId)}</span>
						<CharacterBadge
							characterId={seat.characterId as CharacterId}
							alignment={seat.alignment}
							inline
							interactive={false}
						/>
					</button>
				</li>
			{:else}
				<li class="muted">{t('common.none')}</li>
			{/each}
		</ul>
	{/each}
</Dialog>

<ConfirmDialog
	bind:open={confirming}
	title={move && towns
		? t('modes.towns.moveConfirm', {
				player: seatLabel(towns[move.from], move.seatId),
				number: target + 1
			})
		: ''}
	onConfirm={doMove}
	onCancel={() => (move = undefined)}
/>

<style>
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.towns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(calc(16 * var(--u)), 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.town {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	.names {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(14 * var(--u)), 1fr));
		gap: var(--space-2) var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.names li {
		display: grid;
		gap: var(--space-1);
	}
	.names input {
		width: 100%;
		min-height: var(--tap-target);
	}
	.warnings {
		display: grid;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.movable {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		width: 100%;
		min-height: var(--tap-target);
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
	}
</style>
