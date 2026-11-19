<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import type { RoomMember } from '#lib/core/sync/room.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import SeatAvatarButton from '#lib/features/player/SeatAvatarButton.svelte';
	import { wordsOf } from '#lib/core/sync/room-look.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import { removeFromRoom } from './host-seating.ts';
	import PlayerDisc, { type Phone } from './PlayerDisc.svelte';
	import PlayerInbox from './PlayerInbox.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import RemovedPlayers from './RemovedPlayers.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import GiveSeatDialog from './GiveSeatDialog.svelte';
	import GrimViewSwitch from './GrimViewSwitch.svelte';
	import PlayerFeedbackSection from './PlayerFeedbackSection.svelte';
	import SeatNotes from './SeatNotes.svelte';
	import { tablePlayers, tableSpectators, type TableEntry } from './table-entries.ts';
	import ShowRolesButton from './ShowRolesButton.svelte';

	/**
	 * Players (Trevor, 2026-10-29: "player management shouldn't be under share"): every seat,
	 * phone or not, then the phones with no seat. One line each (Trevor, 2026-11-01, "D"): the
	 * seat and phone in one disc, name and character, how many notes, and what waits from them.
	 * One column of pill sections, as the rest of the pane (Trevor, 2026-11-17, "A"): Players,
	 * with Show's eye on its pill; Spectators; and Player feedback, which opens once the game is
	 * over (Trevor, 2026-11-18, "B own section"). Each player's row opens beneath it to their
	 * messages, then their notes (Trevor, 2026-11-01: "place messages on top of notes") and
	 * Block (Trevor, 2026-11-18). Share is shown to players, so nothing here is on it.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		/** The game is over, so players' feedback can be read. */
		ended?: boolean;
	}

	let { game, run = (command) => game.run(command).ok, ended = false }: Props = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	const seats = $derived(seatsInOrder(game.game));
	/** 1-based seat number, or none. */
	const seatIndex = (seatId?: SeatId) => seats.findIndex((s) => s.seatId === seatId) + 1;

	type Entry = TableEntry;
	// A row's title names it for Collapsible only; its label shows the name as a badge.
	// eslint-disable-next-line grim/names-as-badges -- never shown, the label replaces it
	const titleOf = (entry: TableEntry): string => entry.name;
	const players = $derived(tablePlayers(game, host));
	// Spectators, in their own section (Trevor, 2026-11-03).
	const spectators = $derived(tableSpectators(host));

	const phoneOf = (entry: Entry): Phone =>
		!entry.member ? 'none' : host.isHere(entry.member.memberId) ? 'here' : 'away';
	const PHONE_TEXT = {
		here: 'room.players.here',
		away: 'room.players.away',
		none: 'room.players.noPhone'
	} as const;

	function where(entry: Entry): string {
		const n = seatIndex(entry.seatId);
		const seat = n ? t('common.seat', { number: n }) : t('room.noSeat');
		return t('room.players.where', { seat, state: t(PHONE_TEXT[phoneOf(entry)]) });
	}

	/** What waits from this player (the seat's mark on the board shows the same). */
	const waiting = (memberId: string) => host.inbox.waitingFrom(memberId);
	const inboxCount = (memberId: string) =>
		host.inbox.items.filter((i) => i.memberId === memberId).length;

	const pictureOf = (m: RoomMember) =>
		m.picture && host.code ? roomImagePath(host.code, m.picture) : undefined;

	// ── A player opened from the board: a seat's pen mark or its ⋯ Notes opens their row. ──
	let openedKey = $state<string>();
	/** The list, to bring an opened player's row into view. */
	let list = $state<HTMLElement>();
	// Two frames on, once Players is laid out and the row has opened.
	$effect(() => {
		const seatId = playersDialog.seat;
		if (seatId === undefined) return;
		playersDialog.seat = undefined;
		openedKey = seatId;
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				list
					?.querySelector(`[data-seat="${CSS.escape(seatId)}"]`)
					?.scrollIntoView({ block: 'nearest' })
			)
		);
	});

	// ── Give a seat: the spectator being seated, while its seat list is open ──
	let giving = $state<{ member: RoomMember; name: PlayerName }>();

	// ── Block (plan J37): this game only, and the Blocked list can let them back ──
	let removing = $state<{ memberId: string; name: PlayerName }>();
	let confirmRemove = $state(false);
	function remove() {
		if (!removing) return;
		removeFromRoom(host, game, removing.memberId);
	}

	// ── Each player's notes, the same notes as before ──
	const viewOnly = $derived(game.viewOnly);
	const seatNotes = (seatId: SeatId | undefined) =>
		(seatId && game.game.seats[seatId]?.notes) || [];
</script>

{#snippet nameAndCharacter(entry: Entry)}
	{@const seat = entry.seatId && game.game.seats[entry.seatId]}
	{#if seat && seat.characterId}<CharacterPiece
			template="badge"
			characterId={seat.characterId}
			character={game.characters.get(seat.characterId)}
			alignment={seat.alignment}
			playerName={entry.name}
			interactive={false}
		/>{:else}<PlayerBadge name={entry.name} />{/if}
{/snippet}

{#snippet disc(entry: Entry)}
	<PlayerDisc
		name={entry.name}
		seat={seatIndex(entry.seatId) || undefined}
		phone={phoneOf(entry)}
		avatar={entry.member?.avatar}
		picture={entry.member && pictureOf(entry.member)}
	/>
{/snippet}

<!-- One row a player, which opens to their messages and notes beneath it (Trevor, 2026-11-18:
     "make the notes and messages appear beneath the individual as a collapsible list"). -->
{#snippet row(entry: Entry)}
	{@const wait = entry.inboxId ? waiting(entry.inboxId) : { count: 0, urgent: false }}
	{@const notes = seatNotes(entry.seatId).length}
	<li data-testid="room-player" data-seat={entry.seatId}>
		<Collapsible
			title={titleOf(entry)}
			level={3}
			pinned={false}
			defaultOpen={openedKey === entry.key}
			lazy
		>
			{#snippet label()}<span class="line">
					{@render disc(entry)}
					<span class="who">
						{@render nameAndCharacter(entry)}
						{#if !entry.seatId}<span class="muted">{t('room.noSeat')}</span>{/if}
					</span>
					<!-- Two fixed slots, so rows line up and never shift as notes and messages come and go. -->
					<span class="slot notes" data-testid="room-player-notes"
						>{#if notes}<Icon
								name="notes"
								label={t('room.players.notes', { count: notes })}
							/><small aria-hidden="true">{notes}</small>{/if}</span
					>
					<span class="slot waiting">
						{#if wait.count}<CountBadge
								count={wait.count}
								warn={wait.urgent}
								testid="room-player-waiting"
							/>{/if}
					</span>
				</span>{/snippet}
			{@render details(entry)}
		</Collapsible>
	</li>
{/snippet}

{#snippet show()}<ShowRolesButton {game} />{/snippet}

<div class="players-room" data-testid="players-room">
	<!-- Pill sections, as the rest of the pane (Trevor, 2026-11-17); a closed one counts what
	     it holds (Trevor, 2026-11-01). -->
	<Collapsible
		title={t('room.players.title')}
		storageKey="players-list"
		band="fill"
		pinned={false}
		count={players.length}
		aside={show}
	>
		{#if players.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<ul class="list" aria-label={t('room.players.title')} bind:this={list}>
				{#each players as entry (entry.key)}{@render row(entry)}{/each}
			</ul>
		{/if}
	</Collapsible>
	<!-- Spectators (Trevor, 2026-11-03): phones with no seat. Whether they may message is in
	     Game settings (Trevor, 2026-11-16). -->
	<Collapsible
		title={t('room.spectators')}
		storageKey="players-spectators"
		band="fill"
		pinned={false}
		count={spectators.length}
	>
		<div data-testid="room-spectators">
			{#if spectators.length === 0}
				<p class="none">{t('common.none')}</p>
			{:else}
				<ul class="list" aria-label={t('room.spectators')}>
					{#each spectators as entry (entry.key)}{@render row(entry)}{/each}
				</ul>
			{/if}
		</div>
	</Collapsible>
	<PlayerFeedbackSection {game} {ended} />
	{#if host.code}<RemovedPlayers />{/if}
</div>

<!-- Inside a player's row: where they are, then their messages and notes. -->
{#snippet details(entry: Entry)}
	<div class="details" data-testid="room-player-sheet" data-seat={entry.seatId}>
		<header class="head">
			{#if entry.member}<SeatAvatarButton
					name={entry.name}
					avatar={entry.member.avatar ?? 'initials'}
					picture={pictureOf(entry.member)}
					frame={entry.member.frame}
					words={wordsOf(entry.member)}
					friend={host.code && entry.seatId ? { code: host.code, seatId: entry.seatId } : undefined}
				/>{/if}
			<span class="muted where" data-testid="room-player-where">{where(entry)}</span>
			<!-- A red trash, asking first (Trevor's UI rules). -->
			{#if entry.member && host.code && !viewOnly}
				{@const memberId = entry.member.memberId}
				{@const name = entry.name}
				<DeleteButton
					label={t('room.players.remove')}
					data-testid="room-player-remove"
					onclick={() => {
						removing = { memberId, name };
						confirmRemove = true;
					}}
				/>
			{/if}
		</header>
		<!-- A spectator is seated from here, in any phase (Trevor, 2026-11-06, "Give a seat"). -->
		{#if entry.member && !entry.seatId && host.code && !viewOnly}
			{@const member = entry.member}
			{@const name = entry.name}
			<Button icon="arrange" data-testid="give-seat" onclick={() => (giving = { member, name })}
				>{t('room.giveSeat')}</Button
			>
		{/if}
		<!-- Grim view, under Give a seat (Trevor, 2026-11-16, option A). -->
		{#if entry.member && host.code}<GrimViewSwitch
				memberId={entry.member.memberId}
				name={entry.name}
				disabled={viewOnly}
			/>{/if}
		{#if entry.inboxId}
			{@const count = inboxCount(entry.inboxId)}
			<Collapsible
				title={t('room.inbox.title')}
				level={4}
				storageKey="players-messages"
				pinned={false}
				{count}
				countOpen
			>
				<PlayerInbox memberId={entry.inboxId} name={entry.name} />
			</Collapsible>
		{/if}
		{#if entry.seatId}
			{@const seatId = entry.seatId}
			<Collapsible
				title={t('room.players.notesHeading')}
				level={4}
				storageKey="players-notes"
				pinned={false}
				count={seatNotes(seatId).length}
				countOpen
			>
				<SeatNotes {game} {seatId} {run} />
			</Collapsible>
		{/if}
	</div>
{/snippet}

{#if giving}<GiveSeatDialog
		bind:open={
			() => !!giving,
			(on) => {
				if (!on) giving = undefined;
			}
		}
		{game}
		member={giving.member}
		name={giving.name}
		{run}
	/>{/if}

<ConfirmDialog
	bind:open={confirmRemove}
	title={t('room.players.removeConfirm')}
	danger
	onConfirm={remove}
>
	{#if removing}<PlayerBadge name={removing.name} />{/if}
	<p>{t('room.players.removeBody')}</p>
</ConfirmDialog>

<style>
	/* One column that scrolls as a whole, its sections one under another (Trevor, 2026-11-17). */
	.players-room {
		display: grid;
		flex: 1;
		/* The bands space themselves (Collapsible), as every pane's sections do (Trevor,
		   2026-11-18). */
		gap: 0;
		align-content: start;
		min-height: 0;
		overflow-y: auto;
		/* Room kept for the scrollbar, so nothing moves as it comes and goes (Trevor, 2026-11-17). */
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
		/* The pane's side inset inside this scroll box, so its scrollbar is flush (the pane's). */
		padding: 0 var(--pane-gutter, 0rem) var(--space-3);
	}
	.none,
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.95rem;
		white-space: nowrap;
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor). */
	.list > li {
		border-bottom: 1px solid var(--border);
	}
	/* A row's header: disc, name and character, then the notes and messages slots. */
	.line {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		padding-block: calc(0.25 * var(--u));
	}
	.who {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 1.9em;
		color: var(--on-surface-muted);
	}
	.slot small {
		font-size: 0.8rem;
	}
	/* Indented under the row's caret, so it reads as that player's. */
	.details {
		display: grid;
		padding-inline-start: var(--space-4);
		gap: var(--space-2);
		align-content: start;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.where {
		flex: 1;
		min-width: 0;
	}
</style>
