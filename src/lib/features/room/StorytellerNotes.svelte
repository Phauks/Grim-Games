<script lang="ts">
	import type { Command, NoteOwner } from '#lib/core/engine/index.ts';
	import { seatsInOrder } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';

	/**
	 * The Storyteller's notes in one list (Trevor, 2026-11-19: "instead of sections for players,
	 * make it so you can assign a note to a player or generally to the game"): the game's, then
	 * each player's in seat order. Each note says whose it is on its title's line, and its ⋯
	 * holds whose it is, as each player's character and name, and Delete (option E). A new note
	 * is the game's, or the player's whose seat opened Notes; no player has a note until one is
	 * given them.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
	}

	let { game, run = (command) => game.run(command).ok }: Props = $props();

	const viewOnly = $derived(game.viewOnly);
	const seats = $derived(seatsInOrder(game.game));

	/** Each note's id in the list names whose it is too, as ids repeat between lists. */
	const KEY = '/';
	/** The ⋯'s last item, which deletes the note rather than giving it to anyone. */
	const DELETE = 'delete' as NoteOwner;
	const listed = $derived<TitledNote[]>([
		...(game.game.notes ?? []).map((n) => ({ ...n, noteId: `game${KEY}${n.noteId}` })),
		...seats.flatMap((seat) =>
			(seat.notes ?? []).map((n) => ({ ...n, noteId: `${seat.seatId}${KEY}${n.noteId}` }))
		)
	]);
	/**
	 * Whose a new note will be: the game's, or the player's whose note mark or seat opened
	 * Notes, until it is kept.
	 */
	let newOwner = $state<NoteOwner>('game');
	function split(key: string): { owner: NoteOwner; noteId: string } {
		const at = key.lastIndexOf(KEY);
		if (at < 0) return { owner: newOwner, noteId: '' };
		return { owner: key.slice(0, at), noteId: key.slice(at + 1) };
	}

	const owners = $derived([
		{ value: 'game' as NoteOwner, label: t('room.notes.game') },
		...seats.map((seat) => ({
			value: seat.seatId as NoteOwner,
			label: seatName(game.game, seat.seatId)
		}))
	]);

	function save(note: Omit<TitledNote, 'noteId'> & { noteId?: string }) {
		if (viewOnly) return;
		const { title, text, hidden } = note;
		if (!note.noteId) {
			const to = newOwner;
			newOwner = 'game';
			run(
				to === 'game'
					? { type: 'SetGameNote', title, text, hidden }
					: { type: 'SetSeatNote', seatId: to, title, text, hidden }
			);
			return;
		}
		const { owner, noteId } = split(note.noteId);
		run(
			owner === 'game'
				? { type: 'SetGameNote', noteId, title, text, hidden }
				: { type: 'SetSeatNote', seatId: owner, noteId, title, text, hidden }
		);
	}
	function remove(key: string) {
		if (viewOnly) return;
		const { owner, noteId } = split(key);
		run(
			owner === 'game'
				? { type: 'DeleteGameNote', noteId }
				: { type: 'DeleteSeatNote', seatId: owner, noteId }
		);
	}
	// ── A seat's note mark or Notes brings that player's notes into view, new ones theirs. ──
	let box = $state<HTMLElement>();
	$effect(() => {
		const seatId = playersDialog.seat;
		if (seatId === undefined) return;
		playersDialog.seat = undefined;
		newOwner = seatId;
		// Two frames on, once Notes is laid out.
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				box
					?.querySelector(`[data-note^="${CSS.escape(seatId + KEY)}"]`)
					?.scrollIntoView({ block: 'nearest' })
			)
		);
	});

	function move(key: string, to: NoteOwner) {
		const { owner, noteId } = split(key);
		if (!viewOnly && to !== owner) run({ type: 'MoveNote', noteId, from: owner, to });
	}
</script>

{#snippet whose(value: NoteOwner)}{#if value === 'game'}<span class="game"
			>{t('room.notes.game')}</span
		>{:else}<SeatBadge
			game={game.game}
			characters={game.characters}
			seatId={value}
			interactive={false}
		/>{/if}{/snippet}

<div class="storyteller-notes" data-testid="storyteller-notes" bind:this={box}>
	<NoteList notes={listed} readonly={viewOnly} onSave={save} onDelete={remove} hideable={false}>
		{#snippet owner(note)}{@render whose(split(note.noteId).owner)}{/snippet}
		{#snippet menu(note, askDelete)}<Select
				icon="more"
				label={t('room.notes.owner')}
				value={split(note.noteId).owner}
				options={owners}
				onChange={(to) => move(note.noteId, to)}
				action={{ value: DELETE, label: t('player.deleteNote'), run: askDelete }}
			>
				{#snippet item(option)}{#if option.value === DELETE}<span class="delete"
							>{option.label}</span
						>{:else}{@render whose(option.value)}{/if}{/snippet}
			</Select>{/snippet}
	</NoteList>
</div>

<style>
	.game {
		color: var(--on-surface-muted);
	}
	.delete {
		color: var(--evil);
	}
</style>
