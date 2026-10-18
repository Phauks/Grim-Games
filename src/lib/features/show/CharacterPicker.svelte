<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';

	interface Props {
		/** The characters to choose from, in script order. */
		characters: readonly Character[];
		selected: CharacterId[];
		/** At most this many; one slot per place is always drawn, so nothing moves. */
		max: number;
		/** Accessible name of the list. */
		label: string;
		/** Characters in play: always marked, and choosable (the Storyteller decides). */
		inPlay?: ReadonlySet<CharacterId>;
		/** A chosen character in play is flagged as needing replacing (the Demon's bluffs). */
		warnInPlay?: boolean;
	}

	let {
		characters,
		selected = $bindable(),
		max,
		label,
		inPlay,
		warnInPlay = false
	}: Props = $props();

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const full = $derived(selected.length >= max);

	function toggle(id: CharacterId) {
		if (selected.includes(id)) selected = selected.filter((s) => s !== id);
		else if (max === 1) selected = [id];
		else if (!full) selected = [...selected, id];
	}

	/** Warned, never locked (Trevor's rule: the Storyteller can override anything). */
	function marker(character: Character): string | undefined {
		return inPlay?.has(character.id) ? t('show.inPlay') : undefined;
	}
</script>

<!--
	The chosen characters in fixed slots (so choosing never moves anything), then the shared
	searchable character list.
-->
<div class="picker">
	<ol class="slots" aria-label={t('show.chosen')}>
		{#each Array.from({ length: max }, (_, i) => selected[i]) as id, i (i)}
			{@const character = id ? byId.get(id) : undefined}
			<li>
				{#if character}
					{@const blocked = warnInPlay && inPlay?.has(character.id)}
					<button
						type="button"
						class="slot"
						data-blocked={blocked ? '' : undefined}
						aria-label={t(blocked ? 'show.removeInPlay' : 'show.remove', { name: character.name })}
						onclick={() => toggle(character.id)}
					>
						<CharacterBadge characterId={character.id} {character} interactive={false} />
						<Icon name={blocked ? 'warning' : 'close'} />
					</button>
				{:else}
					<span class="slot empty">{t('common.none')}</span>
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
