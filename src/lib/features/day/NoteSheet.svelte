<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterGuess, DayEntry, SeatId } from '#lib/core/model/index.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { DayPort } from './day-port.ts';

	export interface NoteTarget {
		characterId: CharacterId;
		seatId?: SeatId;
	}

	interface Props {
		open?: boolean;
		game: DayPort;
		target?: NoteTarget;
	}

	let { open = $bindable(false), game, target }: Props = $props();

	/** The latest note for this character and seat today: the sheet edits it. */
	const existing = $derived(
		target &&
			game.game.today.entries.findLast(
				(e): e is Extract<DayEntry, { kind: 'note' }> =>
					e.kind === 'note' && e.characterId === target.characterId && e.seatId === target.seatId
			)
	);
	const juggler = $derived(target?.characterId === 'juggler');
	const scriptIds = $derived(
		game.game.script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id))
	);
	const others = $derived(game.game.seating.filter((s) => s !== target?.seatId));

	let text = $state('');
	let guesses = $state<Record<SeatId, CharacterId>>({});

	// Fill the form each time the sheet opens.
	$effect(() => {
		if (!open) return;
		text = existing?.text ?? '';
		guesses = Object.fromEntries((existing?.guesses ?? []).map((g) => [g.seatId, g.characterId]));
	});

	function save() {
		if (!target) return;
		const list: CharacterGuess[] = Object.entries(guesses)
			.filter(([, id]) => id)
			.map(([seatId, characterId]) => ({ seatId, characterId }));
		const ok = existing
			? game.run({
					type: 'EditDayNote',
					entryId: existing.entryId,
					text,
					...(list.length ? { guesses: list } : {})
				})
			: game.run({
					type: 'DayNote',
					characterId: target.characterId,
					...(target.seatId ? { seatId: target.seatId } : {}),
					text,
					...(list.length ? { guesses: list } : {})
				});
		if (ok) open = false;
	}
</script>

<BottomSheet
	bind:open
	title={target
		? `Note: ${game.characterName(target.characterId)}${target.seatId ? ` · ${game.seatName(target.seatId)}` : ''}`
		: 'Note'}
	description="Optional. Write as much as you like; it stays in today’s log."
	height="85dvh"
>
	<form
		class="note"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<label class="field">
			<span>Note</span>
			<textarea
				bind:value={text}
				rows="6"
				placeholder="What was asked, said or shown…"
				data-testid="note-text"></textarea>
		</label>

		{#if juggler}
			<fieldset class="guesses">
				<legend>Juggler’s guesses</legend>
				{#each others as seatId (seatId)}
					<label class="guess">
						<span>{game.seatName(seatId)}</span>
						<select bind:value={guesses[seatId]} aria-label={`Guess for ${game.seatName(seatId)}`}>
							<option value="">No guess</option>
							{#each scriptIds as id (id)}
								<option value={id}>{game.characterName(id)}</option>
							{/each}
						</select>
					</label>
				{/each}
			</fieldset>
		{/if}

		<div class="actions">
			<Button variant="quiet" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit">Save note</Button>
		</div>
	</form>
</BottomSheet>

<style>
	.note {
		display: grid;
		gap: var(--space-4);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-weight: 600;
	}
	textarea {
		width: 100%;
		min-height: calc(9 * var(--u));
		padding: var(--space-3);
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 400;
		resize: vertical;
	}
	.guesses {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
	}
	.field > span,
	legend {
		font-family: var(--font-control);
	}
	legend {
		margin-bottom: var(--space-2);
		font-weight: 600;
	}
	.guess {
		display: grid;
		grid-template-columns: calc(5 * var(--u)) 1fr;
		align-items: center;
		gap: var(--space-2);
	}
	select {
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
