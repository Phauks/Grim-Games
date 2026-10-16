<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
		characters: readonly Character[];
		onChange: (patch: SeatPatch) => void;
		/** Adds or removes one character from this seat's claims. */
		onToggleClaim: (id: Character['id']) => void;
	}

	let {
		open = $bindable(false),
		seat,
		number,
		characters,
		onChange,
		onToggleClaim
	}: Props = $props();

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const claimed = $derived(
		(seat?.claims ?? []).map((id) => byId.get(id)).filter((c): c is Character => !!c)
	);
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
	// Phones don't close the keyboard on Enter in a single-line field; Done should (Trevor).
	function doneOnEnter(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		event.currentTarget.blur();
	}
</script>

<!-- A fixed height, so claiming or marking a death never resizes the sheet. -->
<BottomSheet bind:open title={t('common.seat', { number })} height="85dvh" focusFirstField={false}>
	{#if seat}
		<div class="editor">
			<label class="field">
				<span>{t('player.name')}</span>
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
				<Toggle
					label={t('player.dead')}
					checked={seat.dead}
					onChange={(dead) => onChange({ dead })}
				/>
				<!-- Always shown, disabled while alive, so the sheet never reflows. -->
				<Toggle
					label={t('player.ghostVoteUsed')}
					checked={seat.ghostVoteUsed}
					disabled={!seat.dead}
					onChange={(ghostVoteUsed) => onChange({ ghostVoteUsed })}
				/>
			</div>

			<!-- One fixed-height row; the searchable list opens over the sheet (no reflow). -->
			<div class="field">
				<span id="claim-label">{t('player.claim')}</span>
				<button
					type="button"
					class="claim"
					aria-labelledby="claim-label claim-value"
					onclick={openPicker}
				>
					<span class="faces" aria-hidden="true">
						{#each claimed.slice(0, 3) as c (c.id)}
							{@const icon = iconFor(c)}
							<span class="face"
								>{#if icon}<img src={icon} alt="" />{/if}</span
							>
						{:else}
							<span class="face"></span>
						{/each}
					</span>
					<span id="claim-value" class="value"
						>{claimed.length ? claimed.map((c) => c.name).join(', ') : t('common.none')}</span
					>
					<span class="change" aria-hidden="true">{t('player.change')}</span>
				</button>
			</div>

			<label class="field">
				<span>{t('player.notes')}</span>
				<textarea
					rows="4"
					value={seat.note}
					oninput={(event) => onChange({ note: event.currentTarget.value })}></textarea>
			</label>
		</div>
	{/if}
</BottomSheet>

<!-- Several characters can be claimed at once (Trevor, 2026-10-16): taps toggle. -->
<Dialog bind:open={pickerOpen} title={t('player.claim')} size="full">
	<div class="picker">
		<CharacterPicker
			{characters}
			mode="multi"
			selected={seat?.claims ?? []}
			onSelect={onToggleClaim}
			bind:query
		/>
	</div>
	{#snippet actions()}
		<Button onclick={() => onChange({ claims: [] })} disabled={!seat?.claims.length}
			>{t('player.clear')}</Button
		>
		<Button variant="accent" icon="check" onclick={() => (pickerOpen = false)}
			>{t('player.done')}</Button
		>
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
	.claim {
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
	.claim:hover {
		background: color-mix(in srgb, currentColor 10%, transparent);
	}
	.faces {
		display: flex;
	}
	/* Several claims overlap like a hand of tokens. */
	.face + .face {
		margin-left: calc(-1.5 * var(--u));
	}
	.face {
		display: grid;
		box-shadow: 0 0 0 2px var(--token-rim);
		place-items: center;
		width: calc(2.75 * var(--u));
		height: calc(2.75 * var(--u));
		border-radius: 50%;
		background: var(--token-face);
	}
	.face img {
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
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
