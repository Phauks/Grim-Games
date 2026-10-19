<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		editionScript,
		loadScriptText,
		OFFICIAL_EDITIONS,
		type ScriptLoadResult,
		type GameData
	} from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import {
		chooseScript,
		currentScript,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import ScriptCheckDialog from '#lib/features/scripts/ScriptCheckDialog.svelte';
	import type { FetchedScript } from '#lib/features/scripts/fetch-script.ts';
	import type { ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
	import { fetchSharedRef } from '#lib/features/scripts/share-codes.ts';
	import { sharedRefFromHash } from '#lib/features/scripts/share.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ScratchPadDialog from '#lib/ui/scratch/ScratchPadDialog.svelte';
	import { ScratchPads, type ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import { NotebookState } from './notebook-store.svelte.ts';
	import { scriptKey } from './notebook.ts';
	import NoteEditor from './NoteEditor.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import PlayerScriptActions from './PlayerScriptActions.svelte';
	import { scriptVersion } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import PlayerScriptTabs from './PlayerScriptTabs.svelte';
	import PlayerRoom from './PlayerRoom.svelte';
	import { roomTable } from '#lib/features/room/player.svelte.ts';
	import PlayerGrim from './PlayerGrim.svelte';

	// A reading page for players, not a grimoire (Trevor, 2026-10-16): no seats or controls.

	let data = $state<GameData>();
	let notebook = $state<NotebookState>();
	let error = $state<string>();
	let tab = $state('script');

	onMount(async () => {
		try {
			const [game] = await Promise.all([
				loadOfficialData(),
				// The script chosen on /scripts; reports its own storage errors.
				restoreScripts()
			]);
			data = game;
			// Restored first, so the shared script ends up current rather than the last one used.
			await openSharedLink();
		} catch (e) {
			// Shown inline below, so only logged.
			reportError(e, { area: 'play', notify: false });
			error = errorMessage(e);
		}
	});

	// A shared link (/play#c=…, #e=, #bs= or #s=) loads its script through the same checks as
	// the Scripts page: the Script check opens when something was skipped or changed
	// (08-script-loading.md §5.3, §5.5).
	let checking = $state<ScriptLoadResult>();
	let checkingSource: ScriptSource = { kind: 'share' };
	let checkOpen = $state(false);
	/** Runs the Script check on fetched script text, or uses it straight away when clean. */
	async function useFetched(fetched: FetchedScript) {
		const result = loadScriptText(fetched.text, await loadOfficialData());
		if (!result.script || result.problems.some((p) => p.severity !== 'info')) {
			checking = result;
			checkingSource = fetched.source;
			checkOpen = true;
		} else await chooseScript(result.script, fetched.source);
	}

	async function openSharedLink() {
		const ref = sharedRefFromHash(location.hash);
		if (!ref) return;
		history.replaceState(history.state, '', location.pathname + location.search);
		try {
			await useFetched(await fetchSharedRef(ref));
		} catch (e) {
			reportError(e, { area: 'play', notify: false });
			toast(t('player.sharedLinkFailed'), errorMessage(e));
		}
	}

	const script = $derived(data ? currentScript.current : undefined);
	/** No script yet: the Scripts page no longer lists the base three, so offer them here. */
	const choosing = $derived(!!data && !currentScript.current);
	function chooseEdition(id: string) {
		const chosen = data && editionScript(id, data);
		if (chosen) void chooseScript(chosen, { kind: 'edition' });
	}

	/** What Share links to: the saved script, or the edition. */
	const shareable = $derived.by(() => {
		if (!script) return undefined;
		const saved = currentScript.current === script ? currentScript.saved : undefined;
		return (
			saved ?? {
				edition: script.edition,
				json: script.edition ? [script.edition] : [],
				source: { kind: 'edition' as const }
			}
		);
	});
	// One notebook per script: official editions by id, saved scripts by their library id.
	const key = $derived.by(() => {
		if (!script) return undefined;
		const saved = currentScript.current === script ? currentScript.saved : undefined;
		return !script.edition && saved && saved.scriptId !== 'unsaved'
			? `saved:${saved.scriptId}`
			: scriptKey(script);
	});
	$effect(() => {
		if (!key || notebook?.key === key) return;
		const book = new NotebookState(key);
		noteOpen = false;
		void book.load().then(() => {
			if (book.key === key) notebook = book;
		});
	});

	// Scratch pads per script, like the notebook's notes, in their own database on the device.
	let scratch = $state<ScratchPads>();
	let scratchPad = $state<ScratchPadState>();
	let scratchOpen = $state(false);
	$effect(() => {
		if (!key || scratch?.base === `player:${key}`) return;
		const pads = new ScratchPads(`player:${key}`);
		scratchOpen = false;
		void pads.load().then(() => {
			if (pads.base === `player:${key}`) scratch = pads;
		});
	});
	function openScratch(pad: ScratchPadState) {
		scratchPad = pad;
		scratchOpen = true;
	}

	// Saving can fail (private browsing, full storage): say so once, as a toast (no reflow).
	let warnedSave = false;
	$effect(() => {
		const scratchError = scratch?.saveError || scratch?.pads.some((pad) => pad.saveError);
		if (!(notebook?.saveError || scratchError) || warnedSave) return;
		warnedSave = true;
		toast(t('player.cannotSave'), t('player.cannotSaveDetail'));
	});

	const version = $derived(
		scriptVersion(currentScript.current === script ? currentScript.saved : undefined, script?.meta)
	);
	let noteId = $state<string>();
	let noteOpen = $state(false);
	function openNote(id: string) {
		noteId = id;
		noteOpen = true;
	}
</script>

<!-- A shared link opened while /play is already showing changes only the hash. -->
<svelte:window onhashchange={() => data && void openSharedLink()} />

<!-- Print and Share stay on the title's line at every width (Trevor, 2026-10-19). -->
<Page title={script?.name ?? t('player.title')} iconActions>
	<!-- Players are already in a script: no Change script and no Code (Trevor, 2026-10-16).
	     Another script loads only from a share link or QR code. -->
	{#snippet actions()}
		<PlayerScriptActions {script} {version} share={shareable} />
	{/snippet}
	<!-- Author and version under the title, or a blank line so nothing moves (Trevor). -->
	{#snippet subtitle()}
		<ScriptByline
			author={script?.meta.author}
			{version}
			storyteller={roomTable.storyteller}
			inline
		/>&nbsp;
	{/snippet}

	{#if error}
		<p role="alert">{t('player.loadFailed', { error })}</p>
	{:else if choosing}
		<!-- Only when no script is loaded; no Change script once there is one (Trevor). -->
		<PageSection title={t('player.chooseScript')}>
			<ul class="choose">
				{#each OFFICIAL_EDITIONS as edition (edition.id)}
					<li>
						<Button onclick={() => chooseEdition(edition.id)}>{edition.name}</Button>
					</li>
				{/each}
				<li>
					<Button href={resolve('/scripts')} variant="quiet" icon="search"
						>{t('player.findScript')}</Button
					>
				</li>
			</ul>
		</PageSection>
	{:else if !script}
		<p class="muted">{t('player.loading')}</p>
	{:else}
		<!-- The same tabs the board's Script button shows, plus the player's own Notes. -->
		<PlayerScriptTabs {script} travellers={roomTable.travellers} bind:tab>
			{#snippet grim()}<PlayerGrim {script} />{/snippet}
			{#snippet notes()}
				{#if !notebook}
					<p class="muted">{t('player.loading')}</p>
				{:else}
					<NotesPanel
						notes={notebook.book.notes}
						pads={scratch?.pads}
						onAdd={() => openNote(notebook!.addNote())}
						onOpenNote={openNote}
						onAddScratch={() => scratch && openScratch(scratch.add())}
						onOpenScratch={openScratch}
					/>
				{/if}
			{/snippet}
			{#snippet room()}<PlayerRoom {script} {version} />{/snippet}
		</PlayerScriptTabs>
	{/if}
</Page>

<!-- Overlays go beside the Page, not inside it. -->
<ScriptCheckDialog
	bind:open={checkOpen}
	result={checking}
	onconfirm={() => {
		const loaded = checking?.script;
		if (loaded) void chooseScript(loaded, checkingSource);
	}}
/>

{#if notebook && script}
	<ErrorBoundary area="play">
		<NoteEditor
			bind:open={noteOpen}
			note={notebook.book.notes.find((n) => n.noteId === noteId)}
			onChange={(patch) => noteId && notebook!.updateNote(noteId, patch)}
			onDelete={() => noteId && notebook!.deleteNote(noteId)}
		/>
	</ErrorBoundary>
{/if}
{#if scratch && scratchPad}
	<ErrorBoundary area="play">
		<ScratchPadDialog
			bind:open={scratchOpen}
			pad={scratchPad}
			onDelete={() => scratchPad && void scratch!.remove(scratchPad)}
		/>
	</ErrorBoundary>
{/if}

<style>
	.choose {
		display: grid;
		gap: var(--space-2);
		max-width: var(--measure);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.choose :global(a),
	.choose :global(button) {
		width: 100%;
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
