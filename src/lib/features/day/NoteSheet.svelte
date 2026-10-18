<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterGuess, DayEntry, SeatId } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
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
	/** The guess drop-down's value for no guess. */
	const NO_GUESS = 'none';
	const guessOptions = $derived([
		{ value: NO_GUESS, label: t('day.noGuess') },
		...scriptIds.map((id) => ({ value: id as string, label: game.characterName(id) }))
	]);

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
					<div class="guess">
						<span>{game.seatName(seatId)}</span>
						<Select
							label={t('day.guessFor', { name: game.seatName(seatId) })}
							hideLabel
							value={guesses[seatId] ?? NO_GUESS}
							options={guessOptions}
							onChange={(id: string) =>
								// No guess is left out when the note is saved.
								(guesses[seatId] = (id === NO_GUESS ? '' : id) as CharacterId)}
						/>
					</div>
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
</style>
