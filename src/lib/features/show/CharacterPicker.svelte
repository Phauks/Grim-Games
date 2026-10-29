<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character, CharacterId } from '#lib/core/data/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
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
		/**
		 * The toggle starts on (Trevor, 2026-10-20: the Demon's bluffs). Off for a set that may
		 * hold characters in play, such as the Lunatic's.
		 */
		hideInPlayFirst?: boolean;
		/**
		 * Lists only this alignment's characters, by character type, behind a switch that starts
		 * on: the Dreamer's other token is of the other alignment (Trevor, 2026-10-24). Off, every
		 * character is listed: the Storyteller decides.
		 */
		onlyAlignment?: Alignment;
	}

	let {
		characters,
		selected = $bindable(),
		max,
		label,
		inPlay,
		warnInPlay = false,
		notInPlay = false,
		hideInPlayFirst = true,
		onlyAlignment
	}: Props = $props();

	// Read once: the Storyteller's own choice is kept while the picker is open.
	let hideInPlay = $state(untrack(() => hideInPlayFirst));
	/** Good characters only; with the toggle on, none in play unless already chosen. */
	let alignmentOnly = $state(true);
	const choices = $derived(
		(notInPlay
			? characters.filter(
					(c) =>
						defaultAlignment(c.type) === 'good' &&
						c.type !== 'traveller' &&
						(!hideInPlay || !inPlay?.has(c.id) || selected.includes(c.id))
				)
			: characters
		).filter((c) => !onlyAlignment || !alignmentOnly || defaultAlignment(c.type) === onlyAlignment)
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

	/** The place's button removes its character. */
	const removeLabel = (character: Character, blocked: boolean | undefined) =>
		// eslint-disable-next-line grim/names-as-badges -- the button's spoken name, never shown; the row shows the token
		t(blocked ? 'show.removeInPlay' : 'show.remove', { name: character.name });

	/** Warned, never locked (Trevor's rule: the Storyteller can override anything). */
	function marker(character: Character): string | undefined {
		return inPlay?.has(character.id) ? t('show.inPlay') : undefined;
	}
</script>

<!--
	A place for each character that can be chosen, drawn like the list's rows; tapping one
	removes it (Trevor, 2026-10-18). Then the shared searchable character list.
-->
<div class="picker">
	<div class="columns">
		<!--
		Pinned while the list scrolls, so what is chosen stays in view (Trevor, 2026-10-18). With
		room for two columns it sits on the left and the list on the right (Trevor, 2026-10-22).
	-->
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
			{#if onlyAlignment}
				<div class="filter">
					<Toggle
						label={t(onlyAlignment === 'good' ? 'show.goodOnly' : 'show.evilOnly')}
						checked={alignmentOnly}
						onChange={(checked) => (alignmentOnly = checked)}
					/>
				</div>
			{/if}
			<!-- One place per character that can be chosen, kept while empty (Trevor, 2026-10-20). -->
			<ul class="slots" aria-label={t('show.chosen')}>
				{#each Array.from({ length: max }, (_, i) => selected[i]) as id, i (i)}
					{@const character = id ? byId.get(id) : undefined}
					{#if character}
						{@const blocked = warnInPlay && inPlay?.has(character.id)}
						<li data-blocked={blocked ? '' : undefined}>
							<CharacterRow
								{character}
								note={blocked ? t('show.inPlay') : undefined}
								label={removeLabel(character, blocked)}
								onclick={() => toggle(character.id)}
							/>
						</li>
					{:else}
						<li class="empty" aria-hidden="true"></li>
					{/if}
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
</div>

<style>
	/* Lives in sheets, so it follows the sheet's colours rather than the page's. */
	.picker {
		container-type: inline-size;
	}
	.columns {
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
	/* The picker's own rows, in its columns. Every place is one row high whatever is in it: the
	   band and the start of the ability, so choosing never moves the list (Trevor, 2026-10-20).
	   Smaller on phones, as the old rows were, so the pinned places leave the list room. */
	.slots {
		--slot-lines: 1;
		--character-ring: 3em;
		font-size: 0.85em;
		--slot-height: calc(2 * var(--space-1) + 1.7em + var(--slot-lines) * 1.35em);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(18 * var(--u))), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.slots li {
		display: flex;
		min-width: 0;
		height: var(--slot-height);
	}
	.slots :global(.ring-row) {
		height: 100%;
		overflow: hidden;
	}
	.slots :global(.ring-ability) {
		display: -webkit-box;
		min-height: 0;
		padding-top: 0;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: var(--slot-lines);
		line-clamp: var(--slot-lines);
	}
	.slots li[data-blocked] :global(.ring-row) {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.empty {
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
	}
	/* Tablets and wider: the chosen places down the left, the list on the right, each place
	   tall enough for more of its ability (Trevor, 2026-10-22). */
	@container (min-width: 36rem) {
		.columns {
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			align-items: start;
		}
		.slots {
			--slot-lines: 3;
			--character-ring: 4.4em;
			font-size: 1em;
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
