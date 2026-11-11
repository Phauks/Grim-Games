<script lang="ts">
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { giveSeat, seatOffers, type SeatOffer } from '#lib/core/sync/room-seating-open.ts';
	import type { RoomMember } from '#lib/core/sync/room.ts';
	import { seatRoles } from '#lib/core/sync/seat-roles.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * Give a seat (Trevor, 2026-11-06, option A): the Storyteller seats a spectator from
	 * Players, in any phase. Every seat is listed, open ones first; a seat with a player asks
	 * first, as that player loses it. Phones sit by name, so the seat is named after the
	 * spectator, one undoable rename. If the seat has a character, its new player may see it for
	 * a minute, and nobody else's opens with it.
	 */
	interface Props {
		open: boolean;
		game: OpenGame;
		member: RoomMember;
		name: PlayerName;
		run: (command: Command) => boolean;
	}

	let { open = $bindable(), game, member, name, run }: Props = $props();

	const host = roomHost();
	const offers = $derived(seatOffers(game.game.seating, game.game.seats));
	let replacing = $state<SeatOffer>();
	let confirming = $state(false);

	function pick(offer: SeatOffer) {
		if (offer.replaces) {
			replacing = offer;
			confirming = true;
			return;
		}
		give(offer.seatId);
	}

	function give(seatId: SeatId) {
		// Read before closing: closing unmounts this dialog and its props with it.
		const { gameId } = game.game;
		const memberId = member.memberId;
		const ok = run(giveSeat(seatId, name));
		if (ok && seatRoles(game.game, game.characters)[seatId])
			host.seatLooks.give(gameId, seatId, memberId);
		open = false;
	}
</script>

<Dialog bind:open title={t('room.giveSeat')}>
	{#snippet heading()}{t('room.giveSeat')} <PlayerBadge {name} />{/snippet}
	<ul class="seats" data-testid="give-seat-list">
		{#each offers as offer (offer.seatId)}
			<li>
				<button
					type="button"
					class="seat"
					data-testid="give-seat-option"
					data-seat={offer.seatNumber}
					onclick={() => pick(offer)}
				>
					<span class="number">{offer.seatNumber}</span>
					<span class="who"
						><SeatBadge
							game={game.game}
							characters={game.characters}
							seatId={offer.seatId}
							interactive={false}
						/></span
					>
					<span class="state"
						>{offer.replaces ? t('room.giveSeat.taken') : t('room.giveSeat.open')}</span
					>
				</button>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>
</Dialog>

<ConfirmDialog
	bind:open={confirming}
	title={t('room.giveSeat.replace')}
	onConfirm={() => replacing && give(replacing.seatId)}
>
	{#if replacing}<SeatBadge
			game={game.game}
			characters={game.characters}
			seatId={replacing.seatId}
			interactive={false}
		/>{/if}
	<p>{t('room.giveSeat.replaceBody')}</p>
</ConfirmDialog>

<style>
	.seats {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor), as Who is connected. */
	.seats li {
		border-bottom: 1px solid var(--border);
	}
	.seat {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: calc(0.25 * var(--u)) var(--space-1);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.number {
		flex: none;
		width: 1.6em;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.who {
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.state {
		flex: none;
		color: var(--on-surface-muted);
	}
	.none {
		min-height: var(--tap-target);
		color: var(--on-surface-muted);
	}
</style>
