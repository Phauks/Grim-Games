<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		GUESS_ANSWERS,
		type CharacterGuess,
		type DayEntry,
		type GuessAnswer,
		type SeatId
	} from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Combobox from '#lib/ui/primitives/Combobox.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { correctGuesses, dayClaim, guessLimit } from '#lib/core/rules/index.ts';
	import { CLAIM_KEYS, type DayPort } from './day-port.ts';

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
	/** The claim the player makes in town (L56): guesses, or one statement true or false. */
	const claim = $derived(target && dayClaim(target.characterId, game.characters));
	const scriptIds = $derived(
		game.game.script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id))
	);
	/**
	 * Free guess slots, each one player and one character (Trevor, 2026-10-24): the same player
	 * may be guessed as several characters (https://wiki.bloodontheclocktower.com/Juggler). As
	 * many as the rules block allows (the Juggler's 5), else one per player.
	 */
	const slotCount = $derived(
		(target && guessLimit(target.characterId, game.characters)) ?? game.game.seating.length
	);
	/** A drop-down's value for nothing chosen. */
	const NONE = 'none';
	const playerOptions = $derived([
		{ value: NONE, label: t('day.noPlayer') },
		...game.game.seating.map((s) => ({ value: s as string, label: game.seatName(s) }))
	]);
	const guessOptions = $derived([
		{ value: NONE, label: t('day.noGuess') },
		...scriptIds.map((id) => ({ value: id as string, label: game.characterName(id) }))
	]);

	interface Slot {
		seatId?: SeatId;
		characterId?: CharacterId;
	}
	let text = $state('');
	let slots = $state<Slot[]>([]);
	let holds = $state(false);
	let answer = $state<GuessAnswer | undefined>();
	/** The answer in the Storyteller's own words, when none of the standard ones fits. */
	let customAnswer = $state<string>();
	/** The drop-down's value for the answer typed in the Storyteller's own words. */
	const CUSTOM = 'custom';
	const answerOptions = $derived([
		{ value: NONE, label: t('day.answer.none') },
		...GUESS_ANSWERS.map((a) => ({ value: a as string, label: t(`day.answer.${a}`) })),
		...(customAnswer ? [{ value: CUSTOM, label: customAnswer }] : [])
	]);
	const answerValue = $derived(answer ?? (customAnswer ? CUSTOM : NONE));
	/** What the player is told: the standard answer's word or the Storyteller's own. */
	const answerText = $derived(answer ? t(`day.answer.${answer}`) : customAnswer);
	/**
	 * Typed words that aren't one of the answers become the answer in the Storyteller's own
	 * words ("Lukewarm": Trevor, 2026-10-31, the answers are a range).
	 */
	function ownAnswer(query: string) {
		if (!query || answerOptions.some((o) => o.label.toLowerCase() === query.toLowerCase()))
			return undefined;
		return {
			value: '__own__',
			label: t('day.answerOwn', { answer: query }),
			run: () => {
				answer = undefined;
				customAnswer = query;
			}
		};
	}
	let showOpen = $state(false);

	// Fill the form each time the sheet opens.
	$effect(() => {
		if (!open) return;
		text = existing?.text ?? '';
		const saved: Slot[] = (existing?.guesses ?? []).map((g) => ({ ...g }));
		slots = [
			...saved,
			...Array.from({ length: Math.max(0, slotCount - saved.length) }, () => ({}))
		];
		holds = existing?.holds ?? false;
		answer = existing?.answer;
		customAnswer = existing?.customAnswer;
	});

	/** The slots with both a player and a character; half-filled ones are left out on save. */
	const list = $derived<CharacterGuess[]>(
		slots.flatMap((g) =>
			g.seatId && g.characterId ? [{ seatId: g.seatId, characterId: g.characterId }] : []
		)
	);
	/** How many guesses are right so far, from the grimoire's true characters. */
	const correct = $derived(correctGuesses(game.game, list, game.characters).length);

	function save() {
		if (!target) return;
		const truth =
			claim === 'statement'
				? { holds }
				: claim !== 'ability-guess'
					? {}
					: answer
						? { answer }
						: customAnswer
							? { customAnswer }
							: {};
		const ok = existing
			? game.run({
					type: 'EditDayNote',
					entryId: existing.entryId,
					text,
					...(list.length ? { guesses: list } : {}),
					...truth
				})
			: game.run({
					type: 'DayNote',
					characterId: target.characterId,
					...(target.seatId ? { seatId: target.seatId } : {}),
					text,
					...(list.length ? { guesses: list } : {}),
					...truth
				});
		if (ok) open = false;
	}
	/** "Note: [Gossip] · Dev", with the character as a badge. */
	const noteTitle = $derived(
		target
			? target.seatId
				? t('day.noteTitleSeat', {
						character: slot('character'),
						seat: slot('seat')
					})
				: t('day.noteTitle', { character: slot('character') })
			: t('day.note')
	);
</script>

<BottomSheet bind:open title={t('day.note')} height="85dvh">
	{#snippet heading()}
		<Sentence text={noteTitle}
			>{#snippet fill(name)}{#if name === 'seat'}{#if target?.seatId}<PlayerBadge
							name={game.seatName(target.seatId)}
						/>{/if}{:else if target}<CharacterBadge
						characterId={target.characterId}
						character={game.characters.get(target.characterId)}
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
		<TextField
			label={t(
				claim === 'statement' || claim === 'ability-guess' ? CLAIM_KEYS[claim].name : 'day.note'
			)}
			bind:value={text}
			multiline
			lists={claim !== 'statement' && claim !== 'ability-guess'}
			rows={6}
			testid="note-text"
		/>

		{#if claim === 'statement'}
			<Toggle label={t('day.statementTrue')} checked={holds} onChange={(on) => (holds = on)} />
		{:else if claim === 'ability-guess'}
			<!-- The Storyteller's answer (https://wiki.bloodontheclocktower.com/Amnesiac), or their own
			     words; shown to the player from here. -->
			<div class="answer">
				<Combobox
					label={t('day.answer')}
					value={answerValue}
					options={answerOptions}
					empty={t('common.none')}
					action={ownAnswer}
					onChange={(a: string) => {
						if (a === CUSTOM) return;
						answer = a === NONE ? undefined : (a as GuessAnswer);
						customAnswer = undefined;
					}}
					testid="guess-answer"
				/>
				<Button
					variant="quiet"
					icon="showToPlayer"
					disabled={!answerText}
					onclick={() => (showOpen = true)}>{t('show.toPlayer')}</Button
				>
			</div>
		{:else if claim === 'guesses'}
			<fieldset class="guesses">
				<legend
					>{t('day.guessesTitle')}
					<span class="correct" data-testid="correct-guesses"
						>{t('day.correctGuesses', { count: correct })}</span
					></legend
				>
				{#each slots as guess, i (i)}
					<div class="guess" data-testid="guess-slot">
						<span class="number">{i + 1}</span>
						<Select
							label={t('day.guessPlayer', { number: i + 1 })}
							hideLabel
							value={guess.seatId ?? NONE}
							options={playerOptions}
							onChange={(id: string) => (guess.seatId = id === NONE ? undefined : (id as SeatId))}
						/>
						<Select
							label={t('day.guessCharacter', { number: i + 1 })}
							hideLabel
							value={guess.characterId ?? NONE}
							options={guessOptions}
							onChange={(id: string) =>
								(guess.characterId = id === NONE ? undefined : (id as CharacterId))}
						/>
					</div>
				{/each}
			</fieldset>
		{/if}

		<ModalActions onCancel={() => (open = false)} submit />
	</form>
	<!-- Inside the sheet, so it stays open under the player view. -->
	<ShowToPlayer bind:open={showOpen} cards={answerText ? [{ title: answerText }] : []} />
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
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-family: var(--font-control);
		margin-bottom: var(--space-2);
		font-weight: 600;
	}
	.number {
		min-width: 1.5em;
		font-variant-numeric: tabular-nums;
		color: var(--on-surface-muted);
	}
	.correct {
		font-weight: 400;
		color: var(--on-surface-muted);
	}
	.answer {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: var(--space-2);
	}
	.guess {
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		align-items: center;
		gap: var(--space-2);
	}
</style>
