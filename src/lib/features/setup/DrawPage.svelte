<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { SeatId, TileId } from '#lib/core/model/index.ts';
	import { bagSlots, nextDrawSeat } from '#lib/core/rules/index.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { SetupGamePort } from './game-port.ts';
	import RevealDialog from './RevealDialog.svelte';
	import { seatLabel } from './seat-label.ts';
	import SetupRemindersDialog from './SetupRemindersDialog.svelte';

	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	const game = $derived(port.game);
	const lookup = $derived(port.lookup);
	const bag = $derived(game?.bag);
	const slots = $derived(bag ? bagSlots(bag) : []);
	const next = $derived(game ? nextDrawSeat(game) : undefined);
	const remaining = $derived(slots.filter((s) => s.state === 'in-bag').length);
	const done = $derived(slots.length > 0 && slots.every((s) => s.state === 'drawn'));

	let revealing = $state<TileId | undefined>(undefined);
	let revealOpen = $state(false);
	let remindersOpen = $state(false);
	const tile = $derived(revealing && bag ? bag.tiles[revealing] : undefined);
	const slot = $derived(slots.find((s) => s.tileId === revealing));

	function send(command: Command): boolean {
		const result = port.dispatch(command);
		if (!result.ok) toast("Couldn't do that", result.error.message);
		return result.ok;
	}

	function label(seatId: SeatId | undefined): string {
		return game && seatId ? seatLabel(game, seatId) : 'None';
	}

	function draw(tileId: TileId, state: string) {
		if (state === 'held') {
			revealing = tileId;
			revealOpen = true;
			return;
		}
		if (!next) {
			toast('Every seat has a character', 'Add a seat on the grimoire to draw for it.');
			return;
		}
		if (send({ type: 'DrawTile', seatId: next, tileId })) {
			revealing = tileId;
			revealOpen = true;
		}
	}

	function confirm(details: { playerName: string; alignment?: Alignment }) {
		if (!tile?.drawnBySeat) return;
		const seatId = tile.drawnBySeat;
		const name = details.playerName.trim();
		if (!send({ type: 'ConfirmDraw', tileId: tile.tileId, alignment: details.alignment })) return;
		if (name !== (game?.seats[seatId]?.playerName ?? '')) {
			send({ type: 'RenameSeat', seatId, playerName: name });
		}
		revealOpen = false;
	}
</script>

<main>
	<header>
		<h1>Draw</h1>
		{#if game}
			<Button
				variant="quiet"
				icon="back"
				href={resolve('/grimoire/[gameId]/setup', { gameId: game.gameId })}>Characters</Button
			>
		{/if}
	</header>

	<ErrorBoundary area="setup">
		{#if !game || !bag}
			<p class="empty" data-testid="no-bag">No bag. Select characters and build the bag first.</p>
		{:else}
			<p class="next">
				<span class="label">Next</span>
				<span data-testid="next-seat">{label(next)}</span>
				<span class="left">{remaining} left</span>
			</p>
			<ol class="tiles" aria-label="Bag">
				{#each slots as s (s.tileId)}
					<li>
						<button
							type="button"
							class="tile"
							data-state={s.state}
							disabled={s.state === 'drawn'}
							aria-label={s.state === 'held'
								? `Tile ${s.number}, held by ${label(s.seatId)}`
								: s.state === 'drawn'
									? `Tile ${s.number}, drawn`
									: `Tile ${s.number}`}
							onclick={() => draw(s.tileId, s.state)}
						>
							<span class="number">{s.number}</span>
							<span class="mark"
								>{#if s.state === 'drawn'}<Icon
										name="check"
									/>{:else if s.state === 'held'}Held{/if}</span
							>
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</ErrorBoundary>

	<div class="actions">
		<Button
			variant="quiet"
			icon="reminder"
			disabled={!game || !lookup}
			onclick={() => (remindersOpen = true)}>Setup reminders</Button
		>
		{#if game}
			<Button
				variant={done ? 'accent' : 'quiet'}
				href={resolve('/grimoire/[gameId]', { gameId: game.gameId })}>Grimoire</Button
			>
		{/if}
	</div>
</main>

{#if tile && slot && lookup}
	{@const shows = lookup.get(tile.shows)}
	{#if shows}
		<RevealDialog
			bind:open={revealOpen}
			number={slot.number}
			{shows}
			needsAlignment={lookup.get(tile.grimoire)?.type === 'traveller'}
			seatLabel={label(tile.drawnBySeat)}
			playerName={(tile.drawnBySeat && game?.seats[tile.drawnBySeat]?.playerName) || ''}
			onConfirm={confirm}
		/>
	{/if}
{/if}
{#if game && lookup}
	<SetupRemindersDialog
		bind:open={remindersOpen}
		{game}
		{lookup}
		onPlace={(placements) => {
			if (send({ type: 'ApplySetupReminders', placements })) {
				remindersOpen = false;
				toast(`Placed ${placements.length} reminder${placements.length === 1 ? '' : 's'}`);
			}
		}}
	/>
{/if}

<style>
	main {
		max-width: calc(48 * var(--u));
		margin: 0 auto;
		padding: var(--space-4) var(--space-4) 0;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	h1 {
		margin: 0;
	}
	.next {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin: var(--space-2) 0;
	}
	.next .label {
		color: var(--on-surface-muted);
	}
	.next .left {
		margin-inline-start: auto;
		font-variant-numeric: tabular-nums;
	}
	.empty {
		margin: var(--space-4) 0;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(4.5 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tile {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		min-height: var(--tap-target);
		border: 0;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 3px var(--token-rim);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.tile:hover {
		filter: brightness(1.1);
	}
	.tile[data-state='held'] {
		box-shadow: inset 0 0 0 4px var(--accent);
	}
	.tile[data-state='drawn'] {
		opacity: 0.35;
		cursor: default;
		filter: none;
	}
	.number {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}
	.mark {
		display: grid;
		place-items: center;
		height: 1.2em;
		font-size: 0.75rem;
	}
	.actions {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding: var(--space-2) 0 calc(var(--space-2) + env(safe-area-inset-bottom));
		background: var(--page-background, var(--surface));
	}
</style>
