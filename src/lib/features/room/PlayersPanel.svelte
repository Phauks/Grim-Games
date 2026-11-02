<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import type { RoomMember } from '#lib/core/sync/room.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import NoteDraftEditor from '#lib/ui/notes/NoteDraftEditor.svelte';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
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

	/**
	 * Players (Trevor, 2026-10-29: "player management shouldn't be under share"): every seat,
	 * phone or not, then the phones with no seat. One line each (Trevor, 2026-11-01, "D"): the
	 * seat and phone in one disc, name and character, how many notes, and what waits from them.
	 * Tapping a line shows that player beside the list (below it on a phone): their messages,
	 * then their notes (Trevor, 2026-11-01: "place messages on top of notes"), each a caret
	 * section, and Block. The game's own notes have their own button on the board. Share is
	 * shown to players, so nothing here is on it.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
	}

	let { game, run = (command) => game.run(command).ok }: Props = $props();

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

	/** What waits from this player: unread messages and pictures still to judge. */
	function waiting(memberId: string): { count: number; urgent: boolean } {
		const items = host.inbox.items.filter((i) => i.memberId === memberId);
		const fresh = items.filter((i) => i.kind === 'picture' || !i.read);
		// A request to talk, or a reported picture, needs the Storyteller more than a note does.
		const urgent = fresh.some((i) => i.kind === 'picture' || i.consult);
		return { count: fresh.length, urgent };
	}
	const inboxCount = (memberId: string) =>
		host.inbox.items.filter((i) => i.memberId === memberId).length;

	const pictureOf = (m: RoomMember) =>
		m.picture && host.code ? roomImagePath(host.code, m.picture) : undefined;

	// ── The player shown beside the list: the one tapped, else the first. ──
	let chosenKey = $state<string>();
	const chosen = $derived(entries.find((e) => e.key === chosenKey) ?? entries[0]);
	/** The list, to bring a chosen player's line into view. */
	let list = $state<HTMLElement>();
	// A seat's pen mark or its ⋯ Notes opens Players at that player. Two frames on, once Players
	// is laid out.
	$effect(() => {
		const seatId = playersDialog.seat;
		if (seatId === undefined) return;
		playersDialog.seat = undefined;
		chosenKey = seatId;
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				list
					?.querySelector(`[data-seat="${CSS.escape(seatId)}"]`)
					?.scrollIntoView({ block: 'nearest' })
			)
		);
	});

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
	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
	/** Whose note the editor has open. */
	let noteSeat = $state<SeatId>();
	function openNote(seatId: SeatId, noteId?: string) {
		noteSeat = seatId;
		editor?.edit(noteId);
	}
	type Written = { noteId?: string; title: string; text: string; hidden: boolean };
	function saveNote(note: Written) {
		if (viewOnly || !noteSeat) return;
		run({ type: 'SetSeatNote', seatId: noteSeat, ...note });
	}
	function deleteNote(noteId: string) {
		if (viewOnly || !noteSeat) return;
		run({ type: 'DeleteSeatNote', seatId: noteSeat, noteId });
	}
</script>

{#snippet nameAndCharacter(entry: Entry)}
	{@const seat = entry.seatId && game.game.seats[entry.seatId]}
	{#if seat && seat.characterId}<CharacterBadge
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

<div class="players">
	<div class="list-side">
		<!-- A caret section whose count, while closed, is how many players there are (Trevor,
		     2026-11-01). -->
		<Collapsible
			title={t('room.playersInRoom')}
			storageKey="players-list"
			pinned={false}
			count={entries.length}
		>
			{#if entries.length === 0}
				<p class="none">{t('common.none')}</p>
			{:else}
				<ul class="list" aria-label={t('room.playersInRoom')} bind:this={list}>
					{#each entries as entry (entry.key)}
						{@const wait = entry.member
							? waiting(entry.member.memberId)
							: { count: 0, urgent: false }}
						{@const notes = seatNotes(entry.seatId).length}
						<li data-testid="room-player" data-seat={entry.seatId}>
							<button
								type="button"
								class="line"
								aria-current={chosen?.key === entry.key ? 'true' : undefined}
								onclick={() => (chosenKey = entry.key)}
							>
								{@render disc(entry)}
								<span class="who">
									{@render nameAndCharacter(entry)}
									{#if !entry.seatId}<span class="muted">{t('room.noSeat')}</span>{/if}
								</span>
								<!-- Two fixed slots, so rows line up and never shift as notes and
							     messages come and go. -->
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
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</Collapsible>
		{#if host.code}<RemovedPlayers />{/if}
	</div>
	<section class="chosen" aria-label={chosen?.name}>
		{#if chosen}{@render details(chosen)}{/if}
	</section>
</div>

<!-- The chosen player: who and where, then their messages and notes. -->
{#snippet details(entry: Entry)}
	{#key entry.key}
		<div class="details" data-testid="room-player-sheet" data-seat={entry.seatId}>
			<header class="head">
				{#if entry.member}<SeatAvatarButton
						name={entry.name}
						avatar={entry.member.avatar ?? 'initials'}
						picture={pictureOf(entry.member)}
						frame={entry.member.frame}
						words={wordsOf(entry.member)}
						friend={host.code && entry.seatId
							? { code: host.code, seatId: entry.seatId }
							: undefined}
					/>{:else}{@render disc(entry)}{/if}
				<span class="head-text">
					<span class="name">{@render nameAndCharacter(entry)}</span>
					<span class="muted" data-testid="room-player-where">{where(entry)}</span>
				</span>
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
			{#if entry.member}
				{@const count = inboxCount(entry.member.memberId)}
				<Collapsible
					title={t('room.inbox.title')}
					level={3}
					storageKey="players-messages"
					pinned={false}
					{count}
					countOpen
				>
					<PlayerInbox memberId={entry.member.memberId} name={entry.name} />
				</Collapsible>
			{/if}
			{#if entry.seatId}
				{@const seatId = entry.seatId}
				<Collapsible
					title={t('room.players.notesHeading')}
					level={3}
					storageKey="players-notes"
					pinned={false}
					count={seatNotes(seatId).length}
					countOpen
				>
					<NoteCards
						notes={seatNotes(seatId)}
						onOpen={(noteId) => openNote(seatId, noteId)}
						onAdd={viewOnly ? undefined : () => openNote(seatId)}
					/>
				</Collapsible>
			{/if}
		</div>
	{/key}
{/snippet}

<ConfirmDialog
	bind:open={confirmRemove}
	title={t('room.players.removeConfirm')}
	danger
	onConfirm={remove}
>
	{#if removing}<PlayerBadge name={removing.name} />{/if}
	<p>{t('room.players.removeBody')}</p>
</ConfirmDialog>

<!-- One editor for every player's notes. Never shown to players. -->
<NoteDraftEditor
	bind:this={editor}
	notes={seatNotes(noteSeat)}
	readonly={viewOnly}
	onSave={saveNote}
	onDelete={deleteNote}
/>

<style>
	/*
	 * Phone: the list above, the chosen player below as a raised panel docked at the bottom
	 * (Trevor, 2026-11-01: "on a phone, it could use better delineation"), each scrolling on
	 * its own so the list never scrolls away. Wider: side by side.
	 */
	.players {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) minmax(0, 1.1fr);
		flex: 1;
		height: 100%;
		min-height: 0;
	}
	.list-side,
	.chosen {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.list-side {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		padding-bottom: var(--space-3);
	}
	/* The chosen player's panel and their line in the list share one fill, so they read as one. */
	.chosen {
		margin: 0 calc(-1 * var(--space-4));
		padding: var(--space-3) var(--space-4) 0;
		border-top: 1px solid var(--border);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	@media (min-width: 40rem) {
		.players {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
			gap: var(--space-4);
		}
		.chosen {
			margin: 0;
			padding: var(--space-3) var(--space-4) 0;
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			box-shadow: none;
		}
	}
	@media (min-width: 64rem) {
		.players {
			grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		}
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
	.line {
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
	.line[aria-current] {
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
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
	.details {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		padding-bottom: var(--space-4);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.head-text {
		display: grid;
		flex: 1;
		gap: calc(0.25 * var(--u));
		justify-items: start;
		min-width: 0;
	}
	.name {
		display: flex;
		max-width: 100%;
		min-width: 0;
	}
</style>
