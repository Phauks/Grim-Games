<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import type { RoomMember } from '#lib/core/sync/room.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import SeatAvatarButton from '#lib/features/player/SeatAvatarButton.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import PlayerInbox from './PlayerInbox.svelte';
	import RolesPanel from './RolesPanel.svelte';

	/**
	 * Players (Trevor, 2026-10-29: "player management shouldn't be under share"): every seat,
	 * phone or not, then the phones with no seat; each with their avatar (a tap opens their
	 * profile), whether their phone is here, and what they have sent. A tap on a player opens their sheet with their messages and
	 * reported picture ("get rid of messages, and just fully integrate it into Players"). Share
	 * is shown to players, so nothing here is on it.
	 */
	let { game }: { game: OpenGame } = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	const seats = $derived(seatsInOrder(game.game));
	/** 1-based seat number, or none. */
	const seatIndex = (seatId?: SeatId) => seats.findIndex((s) => s.seatId === seatId) + 1;

	/** A player at the table: a seat, with the phone sitting there if any, or a phone with no seat. */
	interface Entry {
		key: string;
		seatId?: SeatId;
		name: PlayerName;
		member?: RoomMember;
	}
	// Every seat is a player, phone or not (Trevor, 2026-10-29: "every player has a seat. and it
	// would still be player management for the non-phone users"), in seat order; then the phones
	// with no seat from this game, which stay listed while they sleep (earlier games' are left out).
	const entries = $derived<Entry[]>([
		...seats.map((seat) => ({
			key: seat.seatId,
			seatId: seat.seatId,
			name: seatName(game.game, seat.seatId),
			member: host.members.find((m) => m.seatId === seat.seatId)
		})),
		...host.unseatedInGame.flatMap((m) =>
			m.name ? [{ key: m.memberId, name: m.name, member: m }] : []
		)
	]);

	function where(entry: Entry): string {
		const n = seatIndex(entry.seatId);
		const seat = n ? t('common.seat', { number: n }) : t('room.noSeat');
		const m = entry.member;
		const state = !m
			? t('room.players.noPhone')
			: host.isHere(m.memberId)
				? t('room.players.here')
				: t('room.players.away');
		return t('room.players.where', { seat, state });
	}

	/** What waits from this player: unread messages and pictures still to judge. */
	function waiting(memberId: string): { count: number; urgent: boolean } {
		const items = host.inbox.items.filter((i) => i.memberId === memberId);
		const fresh = items.filter((i) => i.kind === 'picture' || !i.read);
		// A request to talk, or a reported picture, needs the Storyteller more than a note does.
		const urgent = fresh.some((i) => i.kind === 'picture' || i.consult);
		return { count: fresh.length, urgent };
	}

	const pictureOf = (m: RoomMember) =>
		m.picture && host.code ? roomImagePath(host.code, m.picture) : undefined;

	let sheetFor = $state<string>();
	let sheetOpen = $state(false);
	const sheet = $derived(entries.find((e) => e.key === sheetFor));
	function openSheet(key: string) {
		sheetFor = key;
		sheetOpen = true;
	}
</script>

{#snippet avatar(entry: Entry)}
	{#if entry.member}<SeatAvatarButton
			name={entry.name}
			avatar={entry.member.avatar ?? 'initials'}
			picture={pictureOf(entry.member)}
			frame={entry.member.frame}
			friend={host.code && entry.seatId ? { code: host.code, seatId: entry.seatId } : undefined}
		/>{:else}<span class="no-phone" aria-hidden="true"
			><span>{seatIndex(entry.seatId) || ''}</span></span
		>{/if}
{/snippet}

<div class="players">
	<section aria-labelledby="players-label">
		<h2 id="players-label">{t('room.playersInRoom')}</h2>
		{#if entries.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<ul class="list" aria-labelledby="players-label">
				{#each entries as entry (entry.key)}
					{@const wait = entry.member
						? waiting(entry.member.memberId)
						: { count: 0, urgent: false }}
					<li class="member" data-testid="room-player">
						{@render avatar(entry)}
						<button
							type="button"
							class="open"
							data-testid="room-player-open"
							onclick={() => openSheet(entry.key)}
						>
							<span class="who">
								<PlayerBadge name={entry.name} />
								<span class="where">{where(entry)}</span>
							</span>
							<!-- Kept when there is nothing, so rows never shift as messages come in. -->
							<span class="waiting">
								{#if wait.count}<CountBadge
										count={wait.count}
										warn={wait.urgent}
										testid="room-player-waiting"
									/>{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
	<RolesPanel {game} />
</div>

<!-- eslint-disable-next-line grim/names-as-badges -- the dialog's plain-text name; shown as a badge (heading) -->
<Dialog bind:open={sheetOpen} title={sheet?.name ?? ''}>
	{#snippet heading()}<PlayerBadge name={sheet?.name ?? ''} />{/snippet}
	{#if sheet}
		<div class="sheet" data-testid="room-player-sheet">
			<div class="sheet-top">
				{@render avatar(sheet)}
				<span class="where">{where(sheet)}</span>
			</div>
			{#if sheet.member}<PlayerInbox memberId={sheet.member.memberId} name={sheet.name} />{/if}
		</div>
	{/if}
</Dialog>

<style>
	.players {
		display: grid;
		gap: var(--space-5);
	}
	section {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor). */
	.member {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border);
	}
	.open {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.who {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
	}
	.where {
		color: var(--on-surface-muted);
		font-size: 0.95rem;
	}
	.waiting {
		display: grid;
		place-items: center;
		flex: none;
		min-width: 2em;
	}
	/* A seat with no phone: its number where the avatar would be, so every row lines up. */
	.no-phone {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
	}
	.no-phone::before {
		content: '';
		grid-area: 1 / 1;
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
		border: 0.0625rem dashed var(--on-surface-muted);
		border-radius: 50%;
	}
	.no-phone > span {
		grid-area: 1 / 1;
		color: var(--on-surface-muted);
	}
	.sheet {
		display: grid;
		gap: var(--space-3);
	}
	.sheet-top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
