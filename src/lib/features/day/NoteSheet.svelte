<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterGuess, DayEntry, SeatId } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
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
	/** "Note: [Gossip] · Dev", with the character as a badge. */
	const noteTitle = $derived(
		target
			? target.seatId
				? t('day.noteTitleSeat', {
						character: slot('character'),
						seat: game.seatName(target.seatId)
					})
				: t('day.noteTitle', { character: slot('character') })
			: t('day.note')
	);
</script>

<BottomSheet bind:open title={t('day.note')} height="85dvh">
	{#snippet heading()}
		<Sentence text={noteTitle}
			>{#snippet fill()}{#if target}<CharacterBadge
						characterId={target.characterId}
						character={game.characters.get(target.characterId)}
						inline
					/>{/if}{/snippet}</Sentence
		>
	{/snippet}
	<form
		class="note"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<TextField label={t('day.note')} bind:value={text} multiline rows={6} testid="note-text" />

		{#if juggler}
			<fieldset class="guesses">
				<legend>{t('day.jugglerGuesses')}</legend>
				{#each others as seatId (seatId)}
					<label class="guess">
						<span>{game.seatName(seatId)}</span>
						<select
							bind:value={guesses[seatId]}
							aria-label={t('day.guessFor', { name: game.seatName(seatId) })}
						>
							<option value="">{t('day.noGuess')}</option>
							{#each scriptIds as id (id)}
								<option value={id}>{game.characterName(id)}</option>
							{/each}
						</select>
					</label>
				{/each}
			</fieldset>
		{/if}

		<ModalActions onCancel={() => (open = false)} submit />
	</form>
</BottomSheet>

<style>
	.note {
		display: grid;
		gap: var(--space-4);
	}
	.guesses {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		font-family: var(--font-control);
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
</style>
