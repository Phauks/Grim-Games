<script lang="ts">
	import type { Character, CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
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
		/** Characters in play: marked, and not choosable when `blockInPlay` is set. */
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
					{@const playing = inPlay?.has(character.id) ?? false}
					<li>
						<button
							type="button"
							class="choice"
							aria-pressed={chosen}
							aria-label="{character.name}{playing ? ', in play' : ''}"
							data-character-id={character.id}
							disabled={!chosen && ((full && max > 1) || (blockInPlay && playing))}
							onclick={() => toggle(character.id)}
						>
							<span class="head">
								<CharacterLabel {character} />
								<span class="in-play">{playing ? 'In play' : ''}</span>
								<span class="mark" aria-hidden="true"
									>{#if chosen}<Icon name="check" />{/if}</span
								>
							</span>
							<span class="ability">{character.ability}</span>
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
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--line);
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
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(18 * var(--u))), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		min-width: 0;
	}
	.choice {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	.choice:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.choice[aria-pressed='true'] {
		border: 2px solid var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.choice:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.in-play {
		flex: 1;
		font-size: 0.75rem;
		color: var(--on-sheet-muted);
		text-align: end;
	}
	.mark {
		flex: none;
		width: calc(1.25 * var(--u));
		color: var(--accent);
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.none {
		color: var(--on-sheet-muted);
	}
</style>
