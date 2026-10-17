<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		editionScript,
		loadScriptText,
		OFFICIAL_EDITIONS,
		type ScriptLoadResult,
		type GameData,
		type NumericNightOrder
	} from '#lib/core/data/index.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import {
		chooseScript,
		currentScript,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import ScriptCheckDialog from '#lib/features/scripts/ScriptCheckDialog.svelte';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import type { FetchedScript } from '#lib/features/scripts/fetch-script.ts';
	import type { ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
	import { fetchSharedRef, shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import { sharedRefFromHash } from '#lib/features/scripts/share.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import ScratchPadDialog from '#lib/ui/scratch/ScratchPadDialog.svelte';
	import { ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import { NotebookState } from './notebook-store.svelte.ts';
	import { scriptKey } from './notebook.ts';
	import NoteEditor from './NoteEditor.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import PrintScriptButton from './PrintScriptButton.svelte';
	import { playerNight, scriptVersion } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptCopy from './ScriptCopy.svelte';

	// A reading page for players, not a grimoire (Trevor, 2026-10-16): no seats or controls.
	type Tab = 'script' | 'night' | 'notes';

	let data = $state<GameData>();
	let numeric = $state<NumericNightOrder>();
	let notebook = $state<NotebookState>();
	let error = $state<string>();
	let tab = $state<Tab>('script');

	onMount(async () => {
		try {
			const [game, numbers] = await Promise.all([
				loadOfficialData(),
				loadNumericNightOrder().catch(() => undefined),
				// The script chosen on /scripts; reports its own storage errors.
				restoreScripts()
			]);
			numeric = numbers;
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

	/** Makes the share link when Share or QR code is tapped (a short code for custom scripts). */
	const shareTarget = $derived.by(() => {
		if (!script) return undefined;
		const saved = currentScript.current === script ? currentScript.saved : undefined;
		const from = saved ?? {
			edition: script.edition,
			json: script.edition ? [script.edition] : [],
			source: { kind: 'edition' as const }
		};
		return () => shareTargetFor(from, location.origin);
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

	// One scratch pad per script, like the notebook, in its own database on the device.
	let scratch = $state<ScratchPadState>();
	let scratchOpen = $state(false);
	$effect(() => {
		if (!key || scratch?.key === `player:${key}`) return;
		const pad = new ScratchPadState(`player:${key}`);
		scratchOpen = false;
		void pad.load().then(() => {
			if (pad.key === `player:${key}`) scratch = pad;
		});
	});

	// Saving can fail (private browsing, full storage): say so once, as a toast (no reflow).
	let warnedSave = false;
	$effect(() => {
		if (!(notebook?.saveError || scratch?.saveError) || warnedSave) return;
		warnedSave = true;
		toast(t('player.cannotSave'), t('player.cannotSaveDetail'));
	});

	const nights = $derived(
		script && data
			? (['first', 'other'] as const).map((n) => playerNight(script!, data!, n, numeric))
			: []
	);

	const version = $derived(
		currentScript.current === script ? scriptVersion(currentScript.saved) : undefined
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

<main>
	<header>
		<h1>{script?.name ?? t('player.title')}</h1>
		<!-- Players are already in a script: no Change script and no Code (Trevor, 2026-10-16).
		     Another script loads only from a share link or QR code. -->
		<div class="share">
			<PrintScriptButton {script} {version} />
			<ShareControl what="script" title={script?.name ?? 'Script'} target={shareTarget} />
		</div>
		<!-- Author and version under the title, or an empty line so nothing moves (Trevor). -->
		<div class="author">
			<ScriptByline author={script?.meta.author} {version} />
		</div>
	</header>

	{#if error}
		<p role="alert">{t('player.loadFailed', { error })}</p>
	{:else if choosing}
		<!-- Only when no script is loaded; no Change script once there is one (Trevor). -->
		<section class="choose" aria-labelledby="choose-script">
			<h2 id="choose-script">{t('player.chooseScript')}</h2>
			<ul>
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
		</section>
	{:else}
		<Tabs
			bind:value={tab}
			label={t('player.title')}
			tabs={[
				{ value: 'script', label: t('player.tab.script') },
				{ value: 'night', label: t('player.tab.night') },
				{ value: 'notes', label: t('player.tab.notes') }
			]}
		>
			{#snippet panel(value)}
				<div class="panel">
					<!-- A crash in one tab replaces only that tab. -->
					<ErrorBoundary area="play">
						{#if !script || !notebook}
							<p class="muted">{t('player.loading')}</p>
						{:else if value === 'script'}
							<ScriptCopy {script} byline={false} />
						{:else if value === 'night'}
							<PlayerNightOrder {nights} />
						{:else}
							<NotesPanel
								notes={notebook.book.notes}
								{scratch}
								onAdd={() => openNote(notebook!.addNote())}
								onOpenNote={openNote}
								onOpenScratch={() => scratch && (scratchOpen = true)}
							/>
						{/if}
					</ErrorBoundary>
				</div>
			{/snippet}
		</Tabs>
	{/if}

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
	{#if scratch}
		<ErrorBoundary area="play">
			<ScratchPadDialog bind:open={scratchOpen} pad={scratch} />
		</ErrorBoundary>
	{/if}
</main>

<style>
	/* Wide windows get a wide page; the sheets inside keep text to --measure per column. */
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-3) var(--page-gutter) var(--space-6);
	}
	/* Title and the share icon on one row, the author beneath. */
	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.author {
		grid-column: 1 / -1;
	}
	.share {
		display: flex;
		gap: var(--space-1);
	}
	.choose h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
		color: var(--heading);
	}
	.choose ul {
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
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: 1.6rem;
		color: var(--heading);
	}
	.author {
		min-height: 1.4em;
	}
	.author :global(.byline) {
		margin: 0;
	}
	.panel {
		padding-top: var(--space-3);
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
