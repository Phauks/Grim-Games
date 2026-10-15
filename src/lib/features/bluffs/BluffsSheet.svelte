<script lang="ts">
	import {
		defaultAlignment,
		STANDARD_INFO_TOKENS,
		type Character,
		type CharacterId
	} from '#lib/core/data/index.ts';
	import {
		BLUFFS_PER_SET,
		type Command,
		type EngineError,
		type EngineWarning
	} from '#lib/core/engine/index.ts';
	import {
		charactersInPlay,
		scriptCharacterIds,
		type CharacterLookup,
		type Game
	} from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	export type BluffCommand = Extract<Command, { type: 'SetBluffs' | 'RemoveBluffSet' }>;
	export type BluffDispatch = (
		command: BluffCommand
	) => { ok: true; warnings: EngineWarning[] } | { ok: false; error: EngineError };

	interface Props {
		open?: boolean;
		game: Game;
		characters: CharacterLookup;
		/** Runs a command on the game session (the grimoire board's store). */
		dispatch: BluffDispatch;
	}

	let { open = $bindable(false), game, characters, dispatch }: Props = $props();

	/** The set being edited: an index into `game.bluffs`, or its length for a new set. */
	let editing = $state<number>();
	let picked = $state<CharacterId[]>([]);
	let filter = $state<'good' | 'script'>('good');
	let showOpen = $state(false);
	let showing = $state<CharacterId[]>([]);

	const notInPlay = STANDARD_INFO_TOKENS.find((t) => t.id === 'not-in-play')?.text ?? '';
	const scriptList = $derived(
		scriptCharacterIds(game.script).flatMap((id) => {
			const character = characters.get(id);
			return character ? [character] : [];
		})
	);
	const choices = $derived(
		filter === 'good'
			? scriptList.filter((c) => defaultAlignment(c.type) === 'good' && c.type !== 'traveller')
			: scriptList
	);
	const inPlay = $derived(new Set(charactersInPlay(game)));
	// Always at least one set to fill in, so an empty game shows the slots, not a blank sheet.
	const sets = $derived(game.bluffs.length > 0 ? game.bluffs : [[]]);

	function lookup(ids: readonly CharacterId[]): Character[] {
		return ids.flatMap((id) => {
			const character = characters.get(id);
			return character ? [character] : [];
		});
	}

	function run(command: BluffCommand): boolean {
		const result = dispatch(command);
		if (!result.ok) {
			toast('Not done', result.error.message);
			return false;
		}
		for (const warning of result.warnings) toast('Note', warning.message);
		return true;
	}

	function edit(set: number) {
		editing = set;
		picked = [...(game.bluffs[set] ?? [])];
	}

	function save() {
		if (editing === undefined) return;
		if (run({ type: 'SetBluffs', set: editing, characterIds: picked })) editing = undefined;
	}

	/** Shown to the player with the sheet closed, then back to the sheet. */
	function show(ids: readonly CharacterId[]) {
		showing = [...ids];
		open = false;
		showOpen = true;
	}
</script>

<BottomSheet
	bind:open
	title={editing === undefined ? 'Demon bluffs' : `Demon bluffs · Set ${editing + 1}`}
	height="85dvh"
>
	{#if editing === undefined}
		<ul class="sets">
			{#each sets as set, index (index)}
				<li class="set" data-testid="bluff-set">
					<span class="label">Set {index + 1}</span>
					<ol class="tokens">
						{#each Array.from({ length: BLUFFS_PER_SET }, (_, i) => set[i]) as id, i (i)}
							{@const character = id ? characters.get(id) : undefined}
							<li>
								{#if character}
									<CharacterToken {character} alignment="good" size={48} />
									<span class="name">{character.name}</span>
								{:else}
									<span class="hole"></span>
									<span class="name none">None</span>
								{/if}
							</li>
						{/each}
					</ol>
					<div class="actions">
						<Button variant="quiet" onclick={() => edit(index)}>Choose</Button>
						<Button icon="forward" disabled={set.length === 0} onclick={() => show(set)}
							>Show</Button
						>
						<Button
							variant="quiet"
							disabled={index >= game.bluffs.length}
							onclick={() => run({ type: 'RemoveBluffSet', set: index })}>Remove</Button
						>
					</div>
				</li>
			{/each}
		</ul>
		<Button icon="add" variant="quiet" onclick={() => edit(game.bluffs.length)}>
			Add bluff set
		</Button>
	{:else}
		<div class="filter">
			<Segmented
				label="Characters"
				hideLabel
				value={filter}
				options={[
					{ value: 'good', label: 'Good' },
					{ value: 'script', label: 'Whole script' }
				]}
				onChange={(value) => (filter = value)}
			/>
		</div>
		<CharacterPicker
			characters={choices}
			bind:selected={picked}
			max={BLUFFS_PER_SET}
			label="Bluff characters"
			{inPlay}
		/>
		<div class="sheet-actions">
			<Button variant="quiet" onclick={() => (editing = undefined)}>Cancel</Button>
			<Button variant="accent" onclick={save}>Save</Button>
		</div>
	{/if}
</BottomSheet>

<ShowToPlayer
	bind:open={showOpen}
	title={notInPlay}
	onclose={() => (open = true)}
	characters={lookup(showing).map((character) => ({ character, alignment: 'good' as const }))}
/>

<style>
	.sets {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	.set {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--card-radius);
	}
	.label {
		font-family: var(--font-heading);
	}
	.tokens {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tokens li {
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		text-align: center;
	}
	.hole {
		width: 48px;
		height: 48px;
		border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-full);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		font-family: var(--font-character);
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.none {
		color: var(--on-sheet-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: flex-end;
	}
	.filter {
		margin-bottom: var(--space-3);
	}
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		background: var(--sheet-background);
	}
</style>
