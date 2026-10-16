<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Character
	} from '#lib/core/data/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { NotebookSeat, SeatPatch } from './notebook.ts';

	interface Props {
		open?: boolean;
		seat?: NotebookSeat;
		/** 1-based position round the circle. */
		number: number;
		isMe: boolean;
		characters: readonly Character[];
		onChange: (patch: SeatPatch) => void;
		onToggleMe: () => void;
	}

	let {
		open = $bindable(false),
		seat,
		number,
		isMe,
		characters,
		onChange,
		onToggleMe
	}: Props = $props();

	const guessed = $derived(characters.find((c) => c.id === seat?.guess));
	const guessIcon = $derived(guessed && iconFor(guessed));
	let pickerOpen = $state(false);
	let query = $state('');

	function iconFor(c: Character) {
		const icons = characterIcons(c);
		const file =
			icons && ((defaultAlignment(c.type) === 'evil' ? icons.evil : icons.good) ?? icons.unaligned);
		return file && `${ICONS_PATH}/${file}`;
	}
	function openPicker() {
		query = '';
		pickerOpen = true;
	}
	function guess(id: Character['id'] | undefined) {
		onChange({ guess: id });
		pickerOpen = false;
	}
	// Phones don't close the keyboard on Enter in a single-line field; Done should (Trevor).
	function doneOnEnter(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		event.currentTarget.blur();
	}
</script>

<!-- A fixed height, so picking a guess or marking a death never resizes the sheet. -->
<BottomSheet bind:open title="Seat {number}" height="85dvh" focusFirstField={false}>
	{#if seat}
		<div class="editor">
			<label class="field">
				<span>Name</span>
				<input
					type="text"
					value={seat.name}
					autocomplete="off"
					enterkeyhint="done"
					oninput={(event) => onChange({ name: event.currentTarget.value })}
					onkeydown={doneOnEnter}
				/>
			</label>
			<div class="toggles">
				<Toggle label="This is me" checked={isMe} onChange={onToggleMe} />
				<Toggle label="Dead" checked={seat.dead} onChange={(dead) => onChange({ dead })} />
				<!-- Always shown, disabled while alive, so the sheet never reflows. -->
				<Toggle
					label="Ghost vote used"
					checked={seat.ghostVoteUsed}
					disabled={!seat.dead}
					onChange={(ghostVoteUsed) => onChange({ ghostVoteUsed })}
				/>
			</div>

			<!-- One fixed-height row; the searchable list opens over the sheet (no reflow). -->
			<div class="field">
				<span id="guess-label">I think they are</span>
				<button
					type="button"
					class="guess"
					aria-labelledby="guess-label guess-value"
					onclick={openPicker}
				>
					<span class="face"
						>{#if guessIcon}<img src={guessIcon} alt="" />{/if}</span
					>
					<span id="guess-value" class="value">{guessed?.name ?? 'None'}</span>
					<span class="change" aria-hidden="true">Change</span>
				</button>
			</div>

			<label class="field">
				<span>Notes on this player</span>
				<textarea
					rows="4"
					value={seat.note}
					oninput={(event) => onChange({ note: event.currentTarget.value })}></textarea>
			</label>
		</div>
	{/if}
</BottomSheet>

<Dialog bind:open={pickerOpen} title="I think they are" size="full">
	<div class="picker">
		<CharacterPicker
			{characters}
			selected={seat?.guess ? [seat.guess] : []}
			onSelect={(id) => guess(id)}
			bind:query
		/>
	</div>
	{#snippet actions()}
		<Button onclick={() => guess(undefined)} disabled={!seat?.guess}>No guess</Button>
	{/snippet}
</Dialog>

<style>
	.editor {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-5);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-family: var(--font-control);
	}
	input,
	textarea {
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, currentColor 6%, transparent);
		color: inherit;
		font-family: var(--font-player);
		font-size: 1rem;
	}
	textarea {
		resize: vertical;
		font-family: var(--font-body);
	}
	.toggles {
		display: grid;
	}
	.guess {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, currentColor 6%, transparent);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	.guess:hover {
		background: color-mix(in srgb, currentColor 10%, transparent);
	}
	.face {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--token-face);
	}
	.face img {
		width: 40px;
		height: 40px;
	}
	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-character);
	}
	.change {
		font-family: var(--font-control);
		color: var(--on-surface-muted);
	}
	/* The picker's list scrolls inside a fixed height; its search box stays put. */
	.picker {
		display: flex;
		flex-direction: column;
		height: 60dvh;
		min-height: 0;
	}
</style>
