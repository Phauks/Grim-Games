<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { defaultAlignment } from '#lib/core/data/index.ts';
	import { randomBluffs } from '#lib/features/bluffs/bluffs.ts';

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
		/**
		 * Choosing characters not in play (the Demon's bluffs, "These characters are not in
		 * play"): good characters only, a "Not in play only" toggle and setup's Random button,
		 * which never picks one in play. One picker for both (Trevor, 2026-10-18; good only
		 * and the toggle, 2026-10-19).
		 */
		notInPlay?: boolean;
	}

	let {
		characters,
		selected = $bindable(),
		max,
		label,
		inPlay,
		warnInPlay = false,
		notInPlay = false
	}: Props = $props();

	let hideInPlay = $state(false);
	/** Good characters only; with the toggle on, none in play unless already chosen. */
	const choices = $derived(
		notInPlay
			? characters.filter(
					(c) =>
						defaultAlignment(c.type) === 'good' &&
						c.type !== 'traveller' &&
						(!hideInPlay || !inPlay?.has(c.id) || selected.includes(c.id))
				)
			: characters
	);

	/** A fresh random pick on every tap, from the characters listed. */
	function random() {
		selected = randomBluffs(
			choices.map((c) => c.id),
			inPlay ?? new Set(),
			max,
			Math.random
		);
	}

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
	The chosen characters on one line; tapping one removes it (Trevor, 2026-10-18), one tap-target
	high whatever is chosen, so choosing never moves anything; long names shorten to fit.
	Then the shared searchable character list.
-->
<div class="picker">
	<!-- Pinned while the list scrolls, so what is chosen stays in view (Trevor, 2026-10-18). -->
	<div class="pinned">
		{#if notInPlay}
			<div class="filter">
				<Toggle
					label={t('show.notInPlayOnly')}
					checked={hideInPlay}
					onChange={(checked) => (hideInPlay = checked)}
				/>
				<span class="ink"
					><IconButton icon="random" label={t('show.random')} onclick={random} /></span
				>
			</div>
		{/if}
		<ul class="slots" aria-label={t('show.chosen')}>
			{#each selected as id (id)}
				{@const character = byId.get(id)}
				{#if character}
					{@const blocked = warnInPlay && inPlay?.has(character.id)}
					<li>
						<Chip
							class="pick"
							data-blocked={blocked ? '' : undefined}
							aria-label={t(blocked ? 'show.removeInPlay' : 'show.remove', {
								name: character.name
							})}
							onclick={() => toggle(character.id)}
						>
							<CharacterBadge characterId={character.id} {character} interactive={false} />
							{#if blocked}<Icon name="warning" />{/if}
						</Chip>
					</li>
				{/if}
			{:else}
				<li class="empty">{t('common.none')}</li>
			{/each}
		</ul>
	</div>

	<div role="group" aria-label={label}>
		<SharedPicker
			characters={choices}
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
	}
	.pinned {
		position: sticky;
		/* The sheet body's top padding, so nothing shows above it while scrolling. */
		top: calc(-1 * var(--space-1));
		z-index: 1;
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-1);
		background: var(--sheet-background);
	}
	/* The toggle, then Random beside it, as in setup. */
	.filter {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	/* The sheet is parchment: the button takes its ink colour. */
	.ink :global(.icon-button) {
		color: inherit;
	}
	/* Wraps onto more lines rather than running off a phone (Trevor, 2026-10-19). */
	.slots {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* A name too long for a whole line shortens. */
	.slots li {
		display: flex;
		flex: 0 1 auto;
		min-width: 0;
		max-width: 100%;
	}
	/* The badge is the button; the name shortens rather than wrapping. */
	.slots :global(.pick) {
		gap: 0;
		min-width: 0;
		max-width: 100%;
		padding: 0;
		border-color: transparent;
	}
	.slots :global(.pick .badge) {
		flex: 0 1 auto;
		min-width: 0;
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
		gap: var(--space-1);
		padding-right: var(--space-2);
		border: 2px solid var(--accent);
		color: var(--accent);
	}
	.empty {
		padding-left: var(--space-3);
		color: var(--on-surface-muted);
	}
</style>
