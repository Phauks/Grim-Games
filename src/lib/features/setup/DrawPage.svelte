<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { SeatId, TileId } from '#lib/core/model/index.ts';
	import { bagSlots, nextDrawSeat } from '#lib/core/rules/index.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { SetupGamePort } from './game-port.ts';
	import RevealDialog from './RevealDialog.svelte';
	import { seatLabel } from './seat-label.ts';
	import { tileMarks } from './tile-face.ts';
	import TileMarkFace from './TileMarkFace.svelte';
	import SetupSteps from './SetupSteps.svelte';
	import SetupNav from './SetupNav.svelte';
	import LeaveGuard from './LeaveGuard.svelte';
	import JoinButton from './JoinButton.svelte';
	import BagSettings from './BagSettings.svelte';
	import { remindersHref } from './setup-steps.ts';

	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	const game = $derived(port.game);
	const lookup = $derived(port.lookup);
	const bag = $derived(game?.bag);
	const slots = $derived(bag ? bagSlots(bag) : []);
	const next = $derived(game ? nextDrawSeat(game) : undefined);
	// A stray tap mid-draw must not leave the draw (Trevor, 2026-10-16).
	const inBag = $derived(slots.filter((s) => s.state !== 'drawn').length);
	// Numbers, letters, symbols, colours or Random on the face-down tiles (Storyteller
	// settings). Random is seeded by the game and bag, so it stays put across reloads.
	const face = $derived(preferences.current.tileFace);
	const marks = $derived(
		tileMarks(slots.length, face, `${game?.gameId ?? ''}:${slots[0]?.tileId ?? ''}`)
	);
	const markName = (number: number) => marks[number - 1]?.name ?? String(number);
	// A colour fills the whole token, with ink that reads on it (Trevor, 2026-10-17).
	function colourOf(number: number) {
		const mark = marks[number - 1];
		return mark?.kind === 'colour' ? mark : undefined;
	}

	let revealing = $state<TileId | undefined>(undefined);
	let revealOpen = $state(false);
	const tile = $derived(revealing && bag ? bag.tiles[revealing] : undefined);
	const slot = $derived(slots.find((s) => s.tileId === revealing));

	function send(command: Command): boolean {
		const result = port.dispatch(command);
		if (!result.ok) toast(t('setup.couldNot'), result.error.message);
		return result.ok;
	}

	function label(seatId: SeatId | undefined): string {
		return game && seatId ? seatLabel(game, seatId) : t('common.none');
	}

	function draw(tileId: TileId, state: string) {
		if (state === 'held') {
			revealing = tileId;
			revealOpen = true;
			return;
		}
		if (!next) {
			toast(t('setup.draw.everySeat'), t('setup.draw.everySeatHint'));
			return;
		}
		if (send({ type: 'DrawTile', seatId: next, tileId })) {
			revealing = tileId;
			revealOpen = true;
		}
	}

	// On a computer, Enter draws: the held tile again if there is one, else a tile at random.
	function onWindowKey(event: KeyboardEvent) {
		if (revealOpen || event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="dialog"]')) return;
		if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
		const held = slots.find((s) => s.state === 'held');
		const inBag = slots.filter((s) => s.state === 'in-bag');
		const pick = held ?? inBag[Math.floor(Math.random() * inBag.length)];
		if (!pick) return;
		event.preventDefault();
		draw(pick.tileId, pick.state);
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

<svelte:window onkeydown={onWindowKey} />

<main>
	<header>
		{#if game}
			<SetupSteps gameId={game.gameId} current="draw" hasBag={bag !== undefined} />
		{/if}
		<div class="title">
			<h1>{t('setup.draw')}</h1>
			<span class="actions"
				><BagSettings />{#if port.openGame}<JoinButton game={port.openGame} />{/if}</span
			>
		</div>
	</header>

	<ErrorBoundary area="setup">
		{#if !game || !bag}
			<p class="empty" data-testid="no-bag">{t('setup.draw.noBag')}</p>
		{:else}
			<p class="next">
				<span class="label">{t('setup.draw.next')}</span>
				<span data-testid="next-seat">{label(next)}</span>
			</p>
			<ol class="tiles" aria-label={t('setup.draw.bag')}>
				{#each slots as s (s.tileId)}
					<li>
						<button
							type="button"
							class="tile"
							data-state={s.state}
							disabled={s.state === 'drawn'}
							aria-label={s.state === 'held'
								? t('setup.draw.tileHeld', {
										number: markName(s.number),
										seat: label(s.seatId)
									})
								: s.state === 'drawn'
									? t('setup.draw.tileDrawn', { number: markName(s.number) })
									: t('setup.draw.tile', { number: markName(s.number) })}
							onclick={() => draw(s.tileId, s.state)}
							style:background={colourOf(s.number)?.colour}
							style:color={colourOf(s.number)?.ink}
						>
							<span class="face"
								>{#if marks[s.number - 1]}<TileMarkFace mark={marks[s.number - 1]} />{/if}</span
							>
							<span class="mark"
								>{#if s.state === 'drawn'}<Icon name="check" />{:else if s.state === 'held'}{t(
										'setup.draw.held'
									)}{/if}</span
							>
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</ErrorBoundary>

	{#if game}
		<LeaveGuard
			when={inBag > 0}
			title={t('setup.leave.title')}
			body={t('setup.leave.body', { count: inBag, total: slots.length })}
		/>
		<SetupNav
			backHref={resolve('/grimoire/[gameId]/setup', { gameId: game.gameId })}
			backLabel={t('setup.step.characters')}
		>
			{#snippet next()}
				<!-- Done: the board, with its setup reminders tray open. -->
				<Button variant="accent" icon="forward" href={remindersHref(game.gameId)}
					>{t('setup.grimoire')}</Button
				>
			{/snippet}
		</SetupNav>
	{/if}
</main>

{#if tile && slot && lookup}
	{@const shows = lookup.get(tile.shows)}
	{#if shows}
		<RevealDialog
			bind:open={revealOpen}
			number={markName(slot.number)}
			{shows}
			needsAlignment={lookup.get(tile.grimoire)?.type === 'traveller'}
			seatLabel={label(tile.drawnBySeat)}
			playerName={(tile.drawnBySeat && game?.seats[tile.drawnBySeat]?.playerName) || ''}
			onConfirm={confirm}
		/>
	{/if}
{/if}

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-4) var(--page-gutter) 0;
	}
	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
	}
	h1 {
		margin: var(--space-2) 0 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		gap: var(--space-1);
	}
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
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
	.empty {
		margin: var(--space-4) 0;
	}
	/* Three big tiles a row on a phone, more on wider screens (Trevor, 2026-10-16). */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(30%, calc(8 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The number or symbol sits dead centre; the Held/✓ mark overlays the lower rim. */
	.tile {
		display: grid;
		grid-template-areas: 'tile';
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
	@media (hover: hover) {
		.tile:hover {
			filter: brightness(1.1);
		}
	}
	.tile[data-state='held'] {
		box-shadow: inset 0 0 0 4px var(--accent);
	}
	.tile[data-state='drawn'] {
		opacity: 0.35;
		cursor: default;
		filter: none;
	}
	.face {
		grid-area: tile;
		display: grid;
		place-items: center;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1;
	}
	.mark {
		grid-area: tile;
		align-self: end;
		display: grid;
		place-items: center;
		height: 1.2em;
		margin-bottom: 14%;
		font-size: 0.8rem;
	}
	/* A computer window: a wider bag with bigger tiles. */
	@media (min-width: 75rem) {
		.tiles {
			grid-template-columns: repeat(auto-fill, minmax(calc(10 * var(--u)), 1fr));
			gap: var(--space-3);
		}
	}
</style>
