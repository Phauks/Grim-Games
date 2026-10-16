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
	import { scriptCharacterIds, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
	import CharacterLabel from '#lib/features/show/CharacterLabel.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { bluffSetLabel, charactersReallyInPlay, DEMON_SET, lunaticInPlay } from './bluffs.ts';

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

	let editing = $state<number>();
	let deleteOpen = $state(false);
	let deleting = $state<number>();
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
	const inPlay = $derived(charactersReallyInPlay(game, characters));
	const lunatic = $derived(lunaticInPlay(game, characters));
	// The Demon's set always, then any others the Storyteller added (Trevor, 2026-10-16).
	const sets = $derived(Array.from({ length: Math.max(1, game.bluffs.length) }, (_, i) => i));
	const label = (set: number) => bluffSetLabel(set, lunatic);
	/** The Demon's bluffs must not be in play; other sets (the Lunatic's) may be. */
	const blocks = (set: number) => set === DEMON_SET;
	const pickedBlocked = $derived(
		editing !== undefined && blocks(editing) && picked.some((id) => inPlay.has(id))
	);

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
		// "In play" is decided here from true characters (a Drunk's Townsfolk is not in play),
		// and the Lunatic's set may include characters in play, so the engine's note is dropped.
		for (const warning of result.warnings) {
			if (warning.code !== 'bluff-in-play' && warning.code !== 'no-change')
				toast('Note', warning.message);
		}
		return true;
	}

	function set(index: number, characterIds: CharacterId[]): boolean {
		// Other sets come after the Demon's, so the Demon's must exist first.
		if (index > game.bluffs.length && !run({ type: 'SetBluffs', set: DEMON_SET, characterIds: [] }))
			return false;
		return run({ type: 'SetBluffs', set: index, characterIds });
	}

	function edit(index: number) {
		editing = index;
		picked = [...(game.bluffs[index] ?? [])];
	}

	function save() {
		if (editing === undefined || pickedBlocked) return;
		if (set(editing, picked)) editing = undefined;
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
	title={editing === undefined ? 'Demon bluffs' : `${label(editing)} bluffs`}
	height="85dvh"
>
	<!-- The player view below sits outside this boundary, so a crash here never closes it. -->
	<ErrorBoundary area="bluffs">
		{#if editing === undefined}
			<ul class="sets">
				{#each sets as index (index)}
					{@const ids = game.bluffs[index] ?? []}
					{@const stale = blocks(index) && ids.some((id) => inPlay.has(id))}
					<li class="set" data-testid="bluff-set" data-set={label(index)}>
						<span class="label">{label(index)}</span>
						<ol class="rows">
							{#each Array.from({ length: BLUFFS_PER_SET }, (_, i) => ids[i]) as id, i (i)}
								{@const character = id ? characters.get(id) : undefined}
								{@const playing =
									character !== undefined && blocks(index) && inPlay.has(character.id)}
								<li data-in-play={playing ? '' : undefined}>
									{#if character}
										<CharacterLabel {character} alignment="good" />
										<span class="flag"
											>{#if playing}<Icon name="warning" /> In play: replace{/if}</span
										>
									{:else}
										<span class="none">None</span>
									{/if}
								</li>
							{/each}
						</ol>
						<div class="actions">
							<Button variant={stale ? 'accent' : 'quiet'} onclick={() => edit(index)}
								>{stale ? 'Replace' : 'Choose'}</Button
							>
							<Button icon="forward" disabled={ids.length === 0 || stale} onclick={() => show(ids)}
								>Show</Button
							>
							{#if index === DEMON_SET}
								<Button variant="quiet" disabled={ids.length === 0} onclick={() => set(index, [])}
									>Clear</Button
								>
							{:else}
								<Button
									variant="quiet"
									onclick={() => {
										deleting = index;
										deleteOpen = true;
									}}>Delete</Button
								>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
			<div class="add">
				<Button icon="add" variant="quiet" onclick={() => edit(Math.max(1, game.bluffs.length))}
					>Add a set</Button
				>
			</div>
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
				blockInPlay={blocks(editing)}
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (editing = undefined)}>Cancel</Button>
				<Button variant="accent" disabled={pickedBlocked} onclick={save}>Save</Button>
			</div>
		{/if}
	</ErrorBoundary>
</BottomSheet>

<Dialog bind:open={deleteOpen} title="Delete bluff set?" role="alertdialog">
	<p class="confirm">
		{deleting === undefined ? '' : label(deleting)}: {lookup(game.bluffs[deleting ?? -1] ?? [])
			.map((c) => c.name)
			.join(', ') || 'None'}
	</p>
	<p class="confirm hint">You can undo it from History.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (deleteOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			onclick={() => {
				if (deleting !== undefined) run({ type: 'RemoveBluffSet', set: deleting });
				deleteOpen = false;
			}}>Delete</Button
		>
	{/snippet}
</Dialog>

<ShowToPlayer
	bind:open={showOpen}
	title={notInPlay}
	characters={lookup(showing).map((character) => ({ character, alignment: 'good' as const }))}
	onclose={() => (open = true)}
/>

<style>
	.add {
		display: flex;
		justify-content: flex-start;
		margin-top: var(--space-2);
	}
	.confirm {
		margin: 0;
	}
	.confirm.hint {
		margin-top: var(--space-2);
		opacity: 0.8;
	}
	.sets {
		display: grid;
		gap: var(--space-3);
		margin: 0;
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
	.rows {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		min-height: calc(2.5 * var(--u));
	}
	.rows li[data-in-play] {
		color: var(--accent);
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.85rem;
	}
	.none {
		padding-left: var(--space-2);
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
