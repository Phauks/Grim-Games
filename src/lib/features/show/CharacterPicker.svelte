<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';

	interface Props {
		/** The characters to choose from, in script order. */
		characters: readonly Character[];
		selected: CharacterId[];
		/** At most this many. */
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
	The chosen characters on one line, each with its own X (Trevor, 2026-10-18), one tap-target
	high whatever is chosen, so choosing never moves anything; long names shorten to fit.
	Then the shared searchable character list.
-->
<div class="picker">
	<ul class="slots" aria-label={t('show.chosen')} style:--max={max}>
		{#each selected as id (id)}
			{@const character = byId.get(id)}
			{#if character}
				{@const blocked = warnInPlay && inPlay?.has(character.id)}
				<li>
					<Chip
						class="pick"
						data-blocked={blocked ? '' : undefined}
						aria-label={t(blocked ? 'show.removeInPlay' : 'show.remove', { name: character.name })}
						onclick={() => toggle(character.id)}
					>
						<CharacterBadge characterId={character.id} {character} interactive={false} />
						<Icon name={blocked ? 'warning' : 'close'} />
					</Chip>
				</li>
			{/if}
		{:else}
			<li class="empty">{t('common.none')}</li>
		{/each}
	</ul>

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
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		--line: color-mix(in srgb, currentColor 30%, transparent);
	}
	.slots {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Shorter names give their spare room to longer ones; none takes more than its share. */
	.slots li {
		display: flex;
		flex: 0 1 auto;
		min-width: 0;
		max-width: calc((100% - (var(--max) - 1) * var(--space-1)) / var(--max));
	}
	/* The badge and its X as one pill; the name shortens rather than wrapping. */
	.slots :global(.pick) {
		gap: 0;
		min-width: 0;
		max-width: 100%;
		padding: 0 var(--space-1) 0 0;
		border-color: var(--line);
	}
	.slots :global(.pick .badge) {
		flex: 0 1 auto;
		min-width: 0;
		padding-right: var(--space-1);
	}
	.slots :global(.pick .icon) {
		flex: none;
	}
	.slots :global(.pick .name) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.slots :global(.pick[data-blocked]) {
		border: 2px solid var(--accent);
		color: var(--accent);
	}
	.empty {
		padding-left: var(--space-3);
		color: var(--on-sheet-muted);
	}
</style>
