<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { STANDARD_INFO_TOKENS, type Character, type CharacterId } from '#lib/core/data/index.ts';
	import {
		BLUFFS_PER_SET,
		MAX_BLUFF_SET_NAME,
		type Command,
		type EngineError,
		type EngineWarning
	} from '#lib/core/engine/index.ts';
	import { scriptCharacterIds, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import BluffTag from './BluffTag.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import {
		bluffSetLabel,
		charactersReallyInPlay,
		DEMON_SET,
		LUNATIC_SET,
		lunaticInPlay
	} from './bluffs.ts';

	export type BluffCommand = Extract<
		Command,
		{ type: 'SetBluffs' | 'RemoveBluffSet' | 'RenameBluffSet' }
	>;
	export type BluffDispatch = (
		command: BluffCommand
	) => { ok: true; warnings: EngineWarning[] } | { ok: false; error: EngineError };

	interface Props {
		open?: boolean;
		game: Game;
		characters: CharacterLookup;
		/** Runs a command on the game session (the grimoire board's store). */
		dispatch: BluffDispatch;
		/**
		 * The characters in play when there are no seats yet (setup's Characters screen);
		 * otherwise each seat's true character.
		 */
		inPlay?: readonly CharacterId[];
	}

	let { open = $bindable(false), game, characters, dispatch, inPlay: given }: Props = $props();

	let editing = $state<number>();
	let deleteOpen = $state(false);
	let deleting = $state<number>();
	let picked = $state<CharacterId[]>([]);
	let showOpen = $state(false);
	let showing = $state<CharacterId[]>([]);
	/** A later set's name, edited where its characters are chosen (Trevor, 2026-10-17). */
	let pickedName = $state('');

	const notInPlay = STANDARD_INFO_TOKENS.find((t) => t.id === 'not-in-play')?.text ?? '';
	const scriptList = $derived(
		scriptCharacterIds(game.script).flatMap((id) => {
			const character = characters.get(id);
			return character ? [character] : [];
		})
	);
	const inPlay = $derived(given ? new Set(given) : charactersReallyInPlay(game, characters));
	const lunatic = $derived(lunaticInPlay(game, characters));
	// The Demon's set always, then any others the Storyteller added (Trevor, 2026-10-16).
	const sets = $derived(Array.from({ length: Math.max(1, game.bluffs.length) }, (_, i) => i));
	const label = (set: number) => bluffSetLabel(set, lunatic, game.bluffNames?.[set]);
	const defaultLabel = (set: number) => bluffSetLabel(set, lunatic);

	/**
	 * The picker's heading: the set's name and how many are chosen, never "Set 2 bluffs",
	 * which reads as "choose 2" (Trevor, 2026-10-17). The name follows what is typed.
	 */
	const pickTitle = (set: number) =>
		t('bluffs.pickTitle', {
			set:
				set === DEMON_SET
					? t('bluffs.title')
					: bluffSetLabel(set, lunatic, pickedName || game.bluffNames?.[set]),
			count: picked.length,
			max: BLUFFS_PER_SET
		});

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
			toast(t('bluffs.notDone'), result.error.message);
			return false;
		}
		// "In play" is decided here from true characters (a Drunk's Townsfolk is not in play),
		// and the Lunatic's set may include characters in play, so the engine's note is dropped.
		for (const warning of result.warnings) {
			if (warning.code !== 'bluff-in-play' && warning.code !== 'no-change')
				toast(t('bluffs.note'), warning.message);
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
		pickedName = game.bluffNames?.[index] ?? '';
	}

	/** Saving the Demon's bluffs with a character in play asks first; it never refuses. */
	let inPlayOpen = $state(false);
	function save(confirmed = false) {
		if (editing === undefined) return;
		if (pickedBlocked && !confirmed) {
			inPlayOpen = true;
			return;
		}
		const index = editing;
		if (!set(index, picked)) return;
		// The set exists now, so a new set's name can be given to it.
		if (index !== DEMON_SET && pickedName.trim() !== (game.bluffNames?.[index] ?? ''))
			run({ type: 'RenameBluffSet', set: index, name: pickedName });
		editing = undefined;
	}

	/** Shown to the player over the sheet, which stays open under it (Trevor, 2026-10-17). */
	function show(ids: readonly CharacterId[]) {
		showing = [...ids];
		showOpen = true;
	}
</script>

<BottomSheet
	bind:open
	title={editing === undefined ? t('bluffs.title') : pickTitle(editing)}
	height="85dvh"
	wide
>
	<!-- The player view below sits outside this boundary, so a crash here never closes it. -->
	<ErrorBoundary area="bluffs">
		{#if editing === undefined}
			<ul class="sets">
				{#each sets as index (index)}
					{@const ids = game.bluffs[index] ?? []}
					{@const stale = blocks(index) && ids.some((id) => inPlay.has(id))}
					<li class="set" data-testid="bluff-set" data-set={label(index)}>
						<!-- The set's name, then its buttons on the same line (Trevor, 2026-10-19). -->
						<div class="label-row">
							<span class="label">{label(index)}</span>
							<span class="ink"
								><IconButton
									icon="edit"
									label={t(stale ? 'bluffs.replaceNamed' : 'bluffs.chooseNamed', {
										set: label(index)
									})}
									onclick={() => edit(index)}
								/><IconButton
									icon="showToPlayer"
									label={t('bluffs.showNamed', { set: label(index) })}
									disabled={ids.length === 0}
									onclick={() => show(ids)}
								/></span
							>
							<!-- Clearing the Demon's set or deleting another asks first (Trevor, 2026-10-29). -->
							<DeleteButton
								label={t(index === DEMON_SET ? 'bluffs.clearNamed' : 'bluffs.deleteNamed', {
									set: label(index)
								})}
								disabled={index === DEMON_SET && ids.length === 0}
								onclick={() => {
									deleting = index;
									deleteOpen = true;
								}}
							/>
						</div>
						<!-- Each bluff as the script lists it: its name, its ability under it (Trevor, 2026-10-20). -->
						<ol class="rows">
							{#each Array.from({ length: BLUFFS_PER_SET }, (_, i) => ids[i]) as id, i (i)}
								{@const character = id ? characters.get(id) : undefined}
								{@const playing =
									character !== undefined && blocks(index) && inPlay.has(character.id)}
								<li data-in-play={playing ? '' : undefined}>
									{#if character}
										<!-- As the script draws it (Trevor, 2026-10-28); in play, a warning on the band. -->
										<CharacterRow {character} alignment="good" info>
											{#snippet afterName()}{#if playing}<span class="flag"
														><Icon name="warning" /> {t('bluffs.inPlayReplace')}</span
													>{/if}{/snippet}
											{#snippet marks()}<BluffTag />{/snippet}
										</CharacterRow>
									{:else}
										<span class="none">{t('common.none')}</span>
									{/if}
								</li>
							{/each}
						</ol>
					</li>
				{/each}
			</ul>
			<div class="add">
				<Button icon="add" variant="quiet" onclick={() => edit(Math.max(1, game.bluffs.length))}
					>{t('bluffs.addSet')}</Button
				>
			</div>
		{:else}
			<CharacterPicker
				characters={scriptList}
				bind:selected={picked}
				max={BLUFFS_PER_SET}
				label={t('bluffs.characters')}
				{inPlay}
				warnInPlay={blocks(editing)}
				bluffs
				hideInPlayFirst={blocks(editing)}
				notInPlay
				marked={editing === DEMON_SET
					? undefined
					: { ids: new Set(game.bluffs[DEMON_SET] ?? []), note: t('bluffs.inDemonSet') }}
			>
				{#snippet beforeSearch()}{#if editing !== undefined && editing !== DEMON_SET}
						<form
							class="rename picked-name"
							onsubmit={(event) => {
								event.preventDefault();
								save();
							}}
						>
							<span class="name-field">
								<ClearableField bind:value={pickedName}>
									<input
										type="text"
										aria-label={t('bluffs.setName')}
										placeholder={defaultLabel(editing)}
										maxlength={MAX_BLUFF_SET_NAME}
										autocomplete="off"
										enterkeyhint="done"
										bind:value={pickedName}
									/>
								</ClearableField>
							</span>
							<!--
							A second set is nearly always the Lunatic's, so its name is one tap away
							(Trevor, 2026-10-29); disabled, not hidden, once the set is already called that.
						-->
							{#if editing === LUNATIC_SET}
								<Button
									variant="quiet"
									disabled={(pickedName.trim() || defaultLabel(editing)) ===
										t('bluffs.set.lunatic')}
									onclick={() => (pickedName = t('bluffs.set.lunatic'))}
									>{t('bluffs.set.lunatic')}</Button
								>
							{/if}
						</form>
					{/if}{/snippet}
			</CharacterPicker>
			<ModalActions onCancel={() => (editing = undefined)} onConfirm={() => save()} />
		{/if}
	</ErrorBoundary>
	<!--
		Inside the sheet, so the sheet stays open under the player view (Trevor, 2026-10-17);
		outside the boundary, so a crash in the sheet never closes it.
	-->
	<ShowToPlayer
		bind:open={showOpen}
		title={notInPlay}
		characters={lookup(showing).map((character) => ({ character, alignment: 'good' as const }))}
	/>
</BottomSheet>

<ConfirmDialog
	bind:open={inPlayOpen}
	title={t('bluffs.inPlayConfirm')}
	onConfirm={() => save(true)}
>
	{@const playing = lookup(picked.filter((id) => inPlay.has(id)))}
	<p class="confirm">
		<Sentence
			text={t('bluffs.inPlaySummary', {
				names: intl.list(
					playing.map((_, i) => slot(`c${i}`)),
					{ type: 'unit', style: 'narrow' }
				)
			})}
			>{#snippet fill(name)}{@const c = playing[Number(name.slice(1))]}<CharacterBadge
					characterId={c.id}
					character={c}
				/>{/snippet}</Sentence
		>
	</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t(deleting === DEMON_SET ? 'bluffs.clearConfirm' : 'bluffs.deleteConfirm')}
	danger
	onConfirm={() => {
		// The Demon's set always stays, so it is emptied rather than removed.
		if (deleting === DEMON_SET) set(DEMON_SET, []);
		else if (deleting !== undefined) run({ type: 'RemoveBluffSet', set: deleting });
	}}
>
	{@const doomed = lookup(game.bluffs[deleting ?? -1] ?? [])}
	<p class="confirm">
		<Sentence
			text={t('bluffs.deleteSummary', {
				set: deleting === undefined ? '' : label(deleting),
				names:
					intl.list(
						doomed.map((_, i) => slot(`c${i}`)),
						{ type: 'unit', style: 'narrow' }
					) || t('common.none')
			})}
			>{#snippet fill(name)}{@const c = doomed[Number(name.slice(1))]}<CharacterBadge
					characterId={c.id}
					character={c}
				/>{/snippet}</Sentence
		>
	</p>
	<p class="confirm hint">{t('bluffs.undoHint')}</p>
</ConfirmDialog>

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
		border: 1px solid var(--border);
		border-radius: var(--card-radius);
	}
	/* One row high whether showing the name or the field, so nothing moves. */
	.label-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.label {
		flex: 1;
		font-family: var(--font-heading);
	}
	/* The sheet is parchment: the pencil and eye take its ink colour. Spaced as the bin is. */
	.ink {
		display: flex;
		gap: var(--space-2);
	}
	.ink :global(.icon-button) {
		color: inherit;
	}
	/* Its field and button sit straight in the search line, sharing it evenly with the search. */
	.picked-name {
		display: contents;
	}
	.name-field {
		flex: 1;
		min-width: 0;
	}
	.rename input {
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		/* The sheet's own ink and paper, so the name reads on parchment. */
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		font-family: var(--font-heading);
	}
	.rows {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* An empty place is as tall as a filled one, so choosing moves nothing. */
	.rows li {
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: 4.4em;
	}
	.flag {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
		font-size: 0.85rem;
	}
	.none {
		padding-left: var(--space-2);
		color: var(--on-surface-muted);
	}
</style>
