<script lang="ts">
	import type { CharacterId, CharacterType, Script } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { pickerGroups, TYPE_LABELS } from './board.ts';

	interface Props {
		open: boolean;
		title: string;
		characters: CharacterLookup;
		script: Script;
		types: readonly CharacterType[];
		/** Marked as the current choice. */
		current?: CharacterId;
		/** Hide the "not on the script" switch (Fabled and Loric are never on a script sheet). */
		alwaysAll?: boolean;
		/** One row per character with its ability, rather than a grid of tokens. */
		list?: boolean;
		onPick: (id: CharacterId) => void;
	}

	let {
		open = $bindable(),
		title,
		characters,
		script,
		types,
		current,
		alwaysAll = false,
		list = false,
		onPick
	}: Props = $props();

	let showAll = $state(false);
	const groups = $derived(pickerGroups(characters, script, types, alwaysAll || showAll));
</script>

<Dialog bind:open {title} size="full">
	{#if !alwaysAll}
		<div class="switch">
			<Toggle
				label="Include characters not on the script"
				checked={showAll}
				onChange={(v) => (showAll = v)}
			/>
		</div>
	{/if}
	<div class="list">
		{#each groups as group (group.type)}
			<section aria-label={TYPE_LABELS[group.type]}>
				<h3>{TYPE_LABELS[group.type]}</h3>
				<ul class:rows={list}>
					{#each group.characters as character (character.id)}
						<li>
							<button
								type="button"
								class="pick"
								aria-label={character.name}
								aria-pressed={character.id === current}
								onclick={() => onPick(character.id)}
							>
								<CharacterToken {character} size={list ? 40 : 48} />
								{#if list}
									<span class="text">
										<span class="name">{character.name}</span>
										<span class="ability">{character.ability}</span>
									</span>
								{:else}
									<span class="name">{character.name}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</Dialog>

<style>
	.switch {
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 0.95rem;
		color: inherit;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(5.5 * var(--u)), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pick {
		display: grid;
		justify-items: center;
		gap: 2px;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.pick:hover {
		background: var(--surface-selected);
	}
	.pick[aria-pressed='true'] {
		border-color: var(--focus);
	}
	.rows {
		grid-template-columns: 1fr;
		gap: 2px;
	}
	.rows .pick {
		grid-template-columns: auto 1fr;
		justify-items: start;
		align-items: center;
		gap: var(--space-2);
		text-align: start;
	}
	.text {
		display: grid;
		gap: 2px;
	}
	.rows .name {
		font-size: 0.95rem;
		text-align: start;
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.name {
		font-family: var(--font-character);
		font-size: 0.75rem;
		line-height: 1.15;
		text-align: center;
	}
</style>
