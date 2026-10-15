<script lang="ts">
	import {
		defaultAlignment,
		type Character,
		type CharacterId,
		type CharacterType
	} from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		/** The characters to choose from, in script order. */
		characters: readonly Character[];
		selected: CharacterId[];
		/** At most this many; one slot per place is always drawn, so nothing moves. */
		max: number;
		/** Accessible name of the list. */
		label: string;
		/** Characters to mark as in play (still selectable: the Storyteller decides). */
		inPlay?: ReadonlySet<CharacterId>;
	}

	let { characters, selected = $bindable(), max, label, inPlay }: Props = $props();
	let query = $state('');

	const TYPE_ORDER: CharacterType[] = [
		'townsfolk',
		'outsider',
		'minion',
		'demon',
		'traveller',
		'fabled',
		'loric'
	];
	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const groups = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const shown = needle
			? characters.filter((c) => c.name.toLowerCase().includes(needle))
			: characters;
		return TYPE_ORDER.map((type) => ({
			type,
			list: shown.filter((c) => c.type === type)
		})).filter((g) => g.list.length > 0);
	});
	const full = $derived(selected.length >= max);

	function toggle(id: CharacterId) {
		if (selected.includes(id)) selected = selected.filter((s) => s !== id);
		else if (max === 1) selected = [id];
		else if (!full) selected = [...selected, id];
	}
</script>

<div class="picker">
	<ol class="slots" aria-label="Chosen">
		{#each Array.from({ length: max }, (_, i) => selected[i]) as id, i (i)}
			{@const character = id ? byId.get(id) : undefined}
			<li>
				{#if character}
					<button
						type="button"
						class="slot"
						aria-label="Remove {character.name}"
						onclick={() => toggle(character.id)}
					>
						<CharacterToken {character} alignment={defaultAlignment(character.type)} size={44} />
						<span class="slot-name">{character.name}</span>
					</button>
				{:else}
					<span class="slot empty"
						><span class="hole"></span><span class="slot-name">None</span></span
					>
				{/if}
			</li>
		{/each}
	</ol>

	<label class="search">
		<Icon name="search" />
		<input
			type="search"
			placeholder="Find a character"
			aria-label="Find a character"
			bind:value={query}
		/>
	</label>

	<div class="groups" role="group" aria-label={label}>
		{#each groups as group (group.type)}
			<h3>{TYPE_PLURALS[group.type]}</h3>
			<ul>
				{#each group.list as character (character.id)}
					{@const chosen = selected.includes(character.id)}
					<li>
						<button
							type="button"
							class="choice"
							aria-pressed={chosen}
							disabled={!chosen && full && max > 1}
							data-in-play={inPlay?.has(character.id) ? '' : undefined}
							onclick={() => toggle(character.id)}
						>
							<CharacterToken {character} alignment={defaultAlignment(character.type)} size={44} />
							<span class="name">{character.name}</span>
							<span class="mark" aria-hidden="true"
								>{#if chosen}<Icon name="check" />{/if}</span
							>
							<span class="in-play">{inPlay?.has(character.id) ? 'In play' : ''}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">None</p>
		{/each}
	</div>
</div>

<style>
	.picker {
		display: grid;
		gap: var(--space-3);
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(5 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.slot {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.slot.empty {
		cursor: default;
		border-style: dashed;
		background: none;
	}
	.hole {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
	}
	.slot-name {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.slot.empty .slot-name {
		color: var(--on-sheet-muted);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
	}
	.search input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-family: var(--font-heading);
		font-size: 1rem;
		color: inherit;
	}
	li {
		min-width: 0;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(6.5 * var(--u)), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.choice {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-1);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: center;
		cursor: pointer;
	}
	/* Lives in sheets, so it follows the sheet's colours rather than the page's. */
	.choice:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.choice[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.choice:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.name {
		max-width: 100%;
		font-family: var(--font-character);
		font-size: 0.85rem;
		line-height: 1.2;
		overflow-wrap: break-word;
		hyphens: auto;
	}
	.mark {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		width: calc(1.25 * var(--u));
		color: var(--accent);
	}
	.in-play {
		min-height: 1.2em;
		font-size: 0.75rem;
		color: var(--on-sheet-muted);
	}
	.none {
		color: var(--on-sheet-muted);
	}
</style>
