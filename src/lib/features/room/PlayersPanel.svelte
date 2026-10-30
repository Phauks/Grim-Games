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
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import PlayerInbox from './PlayerInbox.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import RolesPanel from './RolesPanel.svelte';

	/**
	 * Players (Trevor, 2026-10-29: "player management shouldn't be under share"): every seat,
	 * phone or not, then the phones with no seat; each with their avatar (a tap opens their
	 * profile), whether their phone is here, and what they have sent. A tap on a player opens
	 * their sheet with their notes, messages and reported picture ("get rid of messages, and
	 * just fully integrate it into Players"); the game's own notes head the list (Notes folded
	 * in, Trevor 2026-10-29). Share is shown to players, so nothing here is on it.
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
	// A seat's pen mark or its ⋯ Notes opens that player's sheet here. Two frames on, once
	// Players has hidden what is behind it from screen readers; opened together, the sheet was
	// hidden with the rest.
	$effect(() => {
		const seatId = playersDialog.seat;
		if (seatId === undefined) return;
		playersDialog.seat = undefined;
		requestAnimationFrame(() => requestAnimationFrame(() => openSheet(seatId)));
	});

	// ── Notes: the game's (no seat) and each player's, the same notes as before ──
	const viewOnly = $derived(game.viewOnly);
	const seatNotes = (seatId: SeatId | undefined) =>
		(seatId && game.game.seats[seatId]?.notes) || [];
	const gameNotes = $derived(game.game.notes ?? []);
	let gameNotesOpen = $state(false);
	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
	/** Whose note the editor has open; undefined for a game note. */
	let noteSeat = $state<SeatId>();
	function openNote(seatId: SeatId | undefined, noteId?: string) {
		noteSeat = seatId;
		editor?.edit(noteId);
	}
	type Written = { noteId?: string; title: string; text: string; hidden: boolean };
	function saveNote(seatId: SeatId | undefined, note: Written) {
		if (viewOnly) return;
		if (seatId) run({ type: 'SetSeatNote', seatId, ...note });
		else run({ type: 'SetGameNote', ...note });
	}
	function deleteNote(seatId: SeatId | undefined, noteId: string) {
		if (viewOnly) return;
		if (seatId) run({ type: 'DeleteSeatNote', seatId, noteId });
		else run({ type: 'DeleteGameNote', noteId });
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
		<!-- The whole game's notes, above the players (Trevor, 2026-10-29). -->
		<button
			type="button"
			class="game-notes"
			data-testid="game-notes-open"
			onclick={() => (gameNotesOpen = true)}
		>
			<span class="who"><Icon name="notes" />{t('room.players.gameNotes')}</span>
			<span class="where"
				>{gameNotes.length
					? t('room.players.notes', { count: gameNotes.length })
					: t('common.none')}</span
			>
		</button>
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
								<span class="name"
									><PlayerBadge name={entry.name} />{#if seatNotes(entry.seatId).length}<span
											class="note-mark"
											data-testid="room-player-note"
											><Icon name="notes" /><span class="visually-hidden"
												>{t('room.players.hasNotes')}</span
											></span
										>{/if}</span
								>
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
			{#if sheet.seatId}
				{@const seat = game.game.seats[sheet.seatId]}
				{#if seat?.characterId}<CharacterBadge
						characterId={seat.characterId}
						character={game.characters.get(seat.characterId)}
						alignment={seat.alignment}
					/>{/if}
				{@const seatId = sheet.seatId}
				<section class="notes" aria-labelledby="player-notes-{seatId}">
					<h3 id="player-notes-{seatId}">{t('room.players.notesHeading')}</h3>
					<NoteCards
						notes={seatNotes(seatId)}
						onOpen={(noteId) => openNote(seatId, noteId)}
						onAdd={viewOnly ? undefined : () => openNote(seatId)}
					/>
				</section>
			{/if}
			{#if sheet.member}<PlayerInbox memberId={sheet.member.memberId} name={sheet.name} />{/if}
		</div>
	{/if}
</Dialog>

<Dialog bind:open={gameNotesOpen} title={t('room.players.gameNotes')}>
	<div data-testid="game-notes">
		<NoteCards
			notes={gameNotes}
			onOpen={(noteId) => openNote(undefined, noteId)}
			onAdd={viewOnly ? undefined : () => openNote(undefined)}
		/>
	</div>
</Dialog>

<!-- One editor for every note here, the game's or a player's. Never shown to players. -->
<NoteDraftEditor
	bind:this={editor}
	notes={noteSeat ? seatNotes(noteSeat) : gameNotes}
	readonly={viewOnly}
	onSave={(note) => saveNote(noteSeat, note)}
	onDelete={(noteId) => deleteNote(noteSeat, noteId)}
/>

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
	.game-notes {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--border);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.game-notes .who {
		gap: var(--space-2);
		justify-content: flex-start;
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.note-mark {
		display: inline-flex;
		color: var(--on-surface-muted);
	}
	.notes {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: 1rem;
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
