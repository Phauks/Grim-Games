<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterLabel from './CharacterLabel.svelte';

	interface Props {
		/** The characters to choose from, in script order. */
		characters: readonly Character[];
		selected: CharacterId[];
		/** At most this many; one slot per place is always drawn, so nothing moves. */
		max: number;
		/** Accessible name of the list. */
		label: string;
		/** Characters in play: not choosable when `blockInPlay` is set. */
		inPlay?: ReadonlySet<CharacterId>;
		blockInPlay?: boolean;
	}

	let {
		characters,
		selected = $bindable(),
		max,
		label,
		inPlay,
		blockInPlay = false
	}: Props = $props();

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const full = $derived(selected.length >= max);

	function toggle(id: CharacterId) {
		if (selected.includes(id)) selected = selected.filter((s) => s !== id);
		else if (max === 1) selected = [id];
		else if (!full) selected = [...selected, id];
	}

	function disabledReason(character: Character): string | undefined {
		if (selected.includes(character.id)) return undefined;
		if (blockInPlay && inPlay?.has(character.id)) return 'In play';
		return undefined;
	}

	/** Where in-play characters are allowed (the Lunatic's set), they are still marked. */
	function marker(character: Character): string | undefined {
		return !blockInPlay && inPlay?.has(character.id) ? 'In play' : undefined;
	}
</script>

<!--
	The chosen characters in fixed slots (so choosing never moves anything), then the shared
	searchable character list.
-->
<div class="picker">
	<ol class="slots" aria-label="Chosen">
		{#each Array.from({ length: max }, (_, i) => selected[i]) as id, i (i)}
			{@const character = id ? byId.get(id) : undefined}
			<li>
				{#if character}
					{@const blocked = blockInPlay && inPlay?.has(character.id)}
					<button
						type="button"
						class="slot"
						data-blocked={blocked ? '' : undefined}
						aria-label="Remove {character.name}{blocked ? ', in play' : ''}"
						onclick={() => toggle(character.id)}
					>
						<CharacterLabel {character} />
						<Icon name={blocked ? 'warning' : 'close'} />
					</button>
				{:else}
					<span class="slot empty">None</span>
				{/if}
			</li>
		{/each}
	</ol>

	<div role="group" aria-label={label}>
		<SharedPicker
			{characters}
			mode={max === 1 ? 'single' : 'multi'}
			{selected}
			onSelect={toggle}
			{disabledReason}
			max={max > 1 ? max : undefined}
			marker={inPlay ? marker : undefined}
			contained={false}
		/>
	</div>
</div>

<style>
	/* Lives in sheets, so it follows the sheet's colours rather than the page's. */
	.picker {
		display: grid;
		gap: var(--space-3);
		--line: color-mix(in srgb, currentColor 30%, transparent);
	}
	.slots {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.slot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2) 0 var(--space-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.slot[data-blocked] {
		border: 2px solid var(--accent);
		color: var(--accent);
	}
	.slot.empty {
		border-style: dashed;
		color: var(--on-sheet-muted);
		cursor: default;
		padding-left: var(--space-3);
	}
</style>
