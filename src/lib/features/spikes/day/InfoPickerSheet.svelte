<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import {
		infoRecord,
		isAllowed,
		isTruthful,
		matchingOption,
		truthfulFirst,
		type InfoChoice,
		type InfoPicker
	} from '#lib/core/rules/index.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { DayGame } from './day-game.svelte.ts';

	interface Props {
		open?: boolean;
		game: DayGame;
		picker?: InfoPicker;
		/** Highlight and sort the truthful options (the `infoSuggestions` setting). */
		suggestions: boolean;
	}

	let { open = $bindable(false), game, picker, suggestions }: Props = $props();

	let seats = $state<SeatId[]>([]);
	let characterId = $state<CharacterId | undefined>();
	let number = $state<number | undefined>();
	let yes = $state<boolean | undefined>();
	let none = $state(false);

	$effect(() => {
		if (!open) return;
		seats = [];
		characterId = undefined;
		number = undefined;
		yes = undefined;
		none = false;
	});

	const g = $derived(game.game);
	const ordered = $derived(picker && suggestions ? truthfulFirst(picker, g) : undefined);
	/** Players to choose from: everyone but the waking player, except for the Fortune Teller. */
	const seatChoices = $derived.by(() => {
		if (!picker) return [];
		const all = ordered?.seats ?? g.seating;
		return picker.kind === 'yes-no' ? all : all.filter((s) => s !== picker.seatId);
	});
	const truthfulSeats = $derived(
		new Set(
			picker && suggestions
				? picker.options.flatMap((o) =>
						picker.kind === 'pair-character' ? o.seats.slice(0, 1) : o.seats
					)
				: []
		)
	);
	const characterChoices = $derived.by(() => {
		if (!picker?.characterType) return [];
		const onScript = g.script.entries
			.map((e) => (e.kind === 'official' ? e.id : e.character.id))
			.filter((id) => game.characters.get(id)?.type === picker.characterType);
		// The Drunk is shown as an Outsider even if off the script list order.
		for (const o of picker.options) {
			if (o.characterId && !onScript.includes(o.characterId)) onScript.push(o.characterId);
		}
		if (!ordered) return onScript;
		return [...ordered.characters, ...onScript.filter((id) => !ordered.characters.includes(id))];
	});
	const truthfulCharacters = $derived(new Set(suggestions ? (ordered?.characters ?? []) : []));
	const truthfulNumbers = $derived(
		new Set(suggestions && picker ? picker.options.map((o) => o.number) : [])
	);

	const choice = $derived<InfoChoice>({
		seats,
		...(characterId ? { characterId } : {}),
		...(number !== undefined ? { number } : {}),
		...(yes !== undefined ? { yes } : {}),
		...(none ? { none } : {})
	});
	const complete = $derived.by(() => {
		if (!picker) return false;
		switch (picker.kind) {
			case 'pair-character':
				return none || (seats.length === 2 && characterId !== undefined);
			case 'number':
				return number !== undefined;
			case 'players':
				return seats.length === picker.seatCount;
			case 'yes-no':
				return seats.length === 2 && yes !== undefined;
		}
	});
	const verdict = $derived.by(() => {
		if (!picker || !complete || !suggestions) return '';
		const truthful = isTruthful(picker, choice);
		const allowed = isAllowed(picker, choice);
		const registered = matchingOption(picker, choice)?.registered;
		if (picker.unreliable) {
			// "No Ability" is the Preacher's reminder token (TPI).
			const state =
				picker.unreliable === 'no-ability' ? ': No Ability' : ` is ${picker.unreliable}`;
			return `${truthful ? 'True' : 'False'}. ${game.seatName(picker.seatId)}${state}, so any info is allowed.`;
		}
		if (!truthful && registered?.length && !picker.mustBeFalse) {
			return `Might register falsely: ${registered.map((s) => game.seatName(s)).join(', ')}. Abnormal.`;
		}
		if (picker.mustBeFalse)
			return allowed ? 'False, as the Vortox needs.' : 'True, but the Vortox needs false info.';
		return truthful ? 'True.' : 'False: not what the grimoire says.';
	});

	function tapSeat(seatId: SeatId) {
		if (!picker) return;
		none = false;
		if (seats.includes(seatId)) {
			seats = seats.filter((s) => s !== seatId);
			return;
		}
		const next = [...seats, seatId];
		seats = next.slice(-picker.seatCount);
	}

	function record() {
		if (!picker || !complete) return;
		const { text, reminders, abnormal } = infoRecord(
			picker,
			choice,
			{ seat: (s) => game.seatName(s), character: (id) => game.characterName(id) },
			g,
			game.characters
		);
		const ok = game.run({
			type: 'RecordNightInfo',
			seatId: picker.seatId,
			characterId: picker.characterId,
			text,
			reminders,
			...(abnormal ? { abnormal } : {})
		});
		if (ok) open = false;
	}
</script>

<BottomSheet
	bind:open
	title={picker
		? `${game.characterName(picker.characterId)} · ${game.seatName(picker.seatId)}`
		: 'Info'}
	description={picker?.kind === 'pair-character'
		? 'Tap 2 players and a character.'
		: picker?.kind === 'number'
			? 'Tap the number to show.'
			: picker?.kind === 'yes-no'
				? 'Tap the 2 players they chose, then yes or no.'
				: `Tap ${picker?.seatCount ?? ''} player${picker?.seatCount === 1 ? '' : 's'}.`}
	height="85dvh"
>
	{#if picker}
		<div class="picker">
			{#if picker.seatCount > 0}
				<div class="grid" role="group" aria-label="Players">
					{#each seatChoices as seatId (seatId)}
						<button
							type="button"
							class="option"
							aria-pressed={seats.includes(seatId)}
							data-truthful={truthfulSeats.has(seatId)}
							onclick={() => tapSeat(seatId)}
						>
							{game.seatName(seatId)}
						</button>
					{/each}
				</div>
			{/if}

			{#if picker.kind === 'pair-character'}
				<div class="grid" role="group" aria-label="Characters">
					{#each characterChoices as id (id)}
						<button
							type="button"
							class="option"
							aria-pressed={characterId === id}
							data-truthful={truthfulCharacters.has(id)}
							onclick={() => {
								characterId = id;
								none = false;
							}}
						>
							{game.characterName(id)}
						</button>
					{/each}
					{#if picker.characterId === 'librarian'}
						<button
							type="button"
							class="option"
							aria-pressed={none}
							data-truthful={suggestions && picker.options.some((o) => o.none)}
							onclick={() => {
								none = true;
								seats = [];
								characterId = undefined;
							}}
						>
							None in play (0)
						</button>
					{/if}
				</div>
			{:else if picker.kind === 'number'}
				<div class="grid" role="group" aria-label="Number">
					{#each Array.from({ length: g.seating.length }, (_, i) => i) as n (n)}
						<button
							type="button"
							class="option"
							aria-pressed={number === n}
							data-truthful={truthfulNumbers.has(n)}
							onclick={() => (number = n)}
						>
							{n}
						</button>
					{/each}
				</div>
			{:else if picker.kind === 'yes-no'}
				<div class="grid" role="group" aria-label="Answer">
					{#each [true, false] as answer (answer)}
						<button
							type="button"
							class="option"
							aria-pressed={yes === answer}
							data-truthful={suggestions &&
								seats.length === 2 &&
								isTruthful(picker, { seats, yes: answer })}
							onclick={() => (yes = answer)}
						>
							{answer ? 'Yes' : 'No'}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Reserved line: the verdict appears without moving the buttons. -->
			<p class="verdict" aria-live="polite" data-testid="info-verdict">{verdict}</p>

			<div class="actions">
				<Button variant="quiet" onclick={() => (open = false)}>Cancel</Button>
				<Button disabled={!complete} onclick={record}>Record</Button>
			</div>
		</div>
	{/if}
</BottomSheet>

<style>
	.picker {
		display: grid;
		gap: var(--space-4);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(6.5 * var(--u)), 1fr));
		gap: var(--space-2);
	}
	.option {
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		font-family: var(--font-control);
		cursor: pointer;
	}
	/* Truthful options: a heavier rim, so the choice is still the Storyteller's. */
	.option[data-truthful='true'] {
		border-width: 3px;
		border-color: var(--good);
		font-weight: 700;
	}
	.option[aria-pressed='true'] {
		background: var(--sheet-color, var(--on-sheet));
		color: var(--sheet-background, var(--sheet));
	}
	.verdict {
		min-height: 3em;
		margin: 0;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
