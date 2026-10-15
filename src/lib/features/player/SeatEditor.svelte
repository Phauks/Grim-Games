<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Character
	} from '#lib/core/data/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { NotebookSeat, SeatPatch } from './notebook.ts';
	import { groupByType } from './player-script.ts';

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
	const groups = $derived(groupByType(characters));

	function iconFor(c: Character) {
		const icons = characterIcons(c);
		const file =
			icons && ((defaultAlignment(c.type) === 'evil' ? icons.evil : icons.good) ?? icons.unaligned);
		return file && `${ICONS_PATH}/${file}`;
	}
</script>

<!-- A fixed height, so picking a guess or marking a death never resizes the sheet. -->
<BottomSheet bind:open title="Seat {number}" height="85dvh">
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

			<fieldset class="guess">
				<legend>I think they are</legend>
				<div class="choices" role="radiogroup" aria-label="Guess">
					<button
						type="button"
						role="radio"
						class="none"
						aria-checked={!seat.guess}
						onclick={() => onChange({ guess: undefined })}>None</button
					>
				</div>
				{#each groups as group (group.type)}
					<p class="type" data-type={group.type}>{TYPE_PLURALS[group.type]}</p>
					<div class="choices" role="radiogroup" aria-label={TYPE_PLURALS[group.type]}>
						{#each group.characters as c (c.id)}
							{@const icon = iconFor(c)}
							<button
								type="button"
								role="radio"
								class="choice"
								aria-checked={seat.guess === c.id}
								aria-label={c.name}
								title={c.name}
								onclick={() => onChange({ guess: c.id })}
							>
								<span class="face"
									>{#if icon}<img src={icon} alt="" />{/if}</span
								>
								<span class="label">{c.name}</span>
							</button>
						{/each}
					</div>
				{/each}
			</fieldset>

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
		margin: 0;
		padding: 0;
		border: 0;
		display: grid;
		gap: var(--space-1);
	}
	legend {
		margin-bottom: var(--space-1);
		font-family: var(--font-control);
	}
	.type {
		margin: var(--space-1) 0 0;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.type[data-type='townsfolk'],
	.type[data-type='outsider'] {
		color: var(--good);
	}
	.type[data-type='minion'],
	.type[data-type='demon'] {
		color: var(--evil);
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		gap: var(--space-1);
	}
	.choice,
	.none {
		display: grid;
		justify-items: center;
		gap: 2px;
		min-height: var(--tap-target);
		padding: var(--space-1) 0;
		border: 2px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.none {
		grid-column: span 2;
		place-items: center;
		border-color: var(--border);
		font-family: var(--font-control);
	}
	.choice:hover,
	.none:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	[aria-checked='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, transparent);
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
	.label {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-character);
		font-size: 0.7rem;
	}
</style>
