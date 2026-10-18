<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { SeatId, TileId } from '#lib/core/model/index.ts';
	import { bagSlots, nextDrawSeat } from '#lib/core/rules/index.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { SetupGamePort } from './game-port.ts';
	import RevealDialog from './RevealDialog.svelte';
	import { seatLabel } from './seat-label.ts';
	import { tileMarks } from './tile-face.ts';
	import BagTiles from './BagTiles.svelte';
	import SetupNav from './SetupNav.svelte';
	import LeaveGuard from './LeaveGuard.svelte';
	import SetupActions from './SetupActions.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
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

<Page title={t('setup.draw')}>
	{#snippet actions()}<SetupActions {port} />{/snippet}

	<ErrorBoundary area="setup">
		{#if !game || !bag}
			<p class="empty" data-testid="no-bag">{t('setup.draw.noBag')}</p>
		{:else}
			<p class="next">
				<span class="label">{t('setup.draw.next')}</span>
				<span data-testid="next-seat">{label(next)}</span>
			</p>
			<BagTiles {slots} {marks} seatLabel={label} onpick={(s) => draw(s.tileId, s.state)} />
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
</Page>

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
</style>
