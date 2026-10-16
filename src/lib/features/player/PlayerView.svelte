<script lang="ts">
	import { onMount } from 'svelte';
	import {
		editionScript,
		loadScriptText,
		type ScriptLoadResult,
		type GameData,
		type LoadedScript,
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
	import { ScriptFetchError, type FetchedScript } from '#lib/features/scripts/fetch-script.ts';
	import type { ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
	import ShareCodeEntry from '#lib/features/scripts/ShareCodeEntry.svelte';
	import {
		fetchSharedCode,
		fetchSharedRef,
		shareTargetFor
	} from '#lib/features/scripts/share-codes.ts';
	import { sharedRefFromHash } from '#lib/features/scripts/share.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { NotebookState } from './notebook-store.svelte.ts';
	import { playerCount, scriptKey } from './notebook.ts';
	import NoteEditor from './NoteEditor.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerJinxes, playerNight, sheetCharacters } from './player-script.ts';
	import ScriptSheet from './ScriptSheet.svelte';
	import SeatCircle from './SeatCircle.svelte';
	import SeatEditor from './SeatEditor.svelte';

	type Tab = 'script' | 'night' | 'circle' | 'notes';

	let data = $state<GameData>();
	let numeric = $state<NumericNightOrder>();
	let fallback = $state<LoadedScript>();
	let notebook = $state<NotebookState>();
	let error = $state<string>();
	let tab = $state<Tab>('script');
	let editing = $state<string>();
	let editorOpen = $state(false);

	onMount(async () => {
		try {
			const [game, numbers] = await Promise.all([
				loadOfficialData(),
				loadNumericNightOrder().catch(() => undefined),
				// The script chosen on /scripts; reports its own storage errors.
				restoreScripts()
			]);
			// With no script chosen yet, show Trouble Brewing (09-player-script-view.md).
			fallback = editionScript('tb', game);
			if (!fallback) throw new Error('Trouble Brewing is missing from the data');
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
			toast('Could not open the shared script', errorMessage(e));
		}
	}

	// "Have a code?": the six-digit code from another phone's Share (08-script-loading.md §5.5).
	let codeOpen = $state(false);
	let codeText = $state('');
	let codeBusy = $state(false);
	let codeError = $state('');
	function openCode() {
		codeText = '';
		codeError = '';
		codeOpen = true;
	}
	async function loadCode() {
		codeBusy = true;
		codeError = '';
		try {
			const fetched = await fetchSharedCode(codeText);
			codeOpen = false;
			await useFetched(fetched);
		} catch (e) {
			// A code nobody has is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'play', notify: false });
			codeError = errorMessage(e);
		} finally {
			codeBusy = false;
		}
	}

	const script = $derived(data ? (currentScript.current ?? fallback) : undefined);

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
		editorOpen = false;
		noteOpen = false;
		void book.load().then(() => {
			if (book.key === key) notebook = book;
		});
	});

	// Saving can fail (private browsing, full storage): say so once, as a toast (no reflow).
	let warnedSave = false;
	$effect(() => {
		if (!notebook?.saveError || warnedSave) return;
		warnedSave = true;
		toast('This browser cannot save', 'Notes are lost when the page closes.');
	});

	const players = $derived(notebook ? playerCount(notebook.book) : 0);
	const jinxes = $derived(script && data ? playerJinxes(script, data) : []);
	const sheet = $derived(script && data ? sheetCharacters(script, data) : []);
	const nights = $derived(
		script && data
			? (['first', 'other'] as const).map((n) => playerNight(script!, data!, n, players, numeric))
			: []
	);
	const byId = $derived(new Map(script?.characters.map((c) => [c.id, c]) ?? []));
	const seatIndex = $derived(notebook?.book.seats.findIndex((s) => s.seatId === editing) ?? -1);

	let noteId = $state<string>();
	let noteOpen = $state(false);
	function openNote(id: string) {
		noteId = id;
		noteOpen = true;
	}

	function openSeat(seatId: string) {
		editing = seatId;
		editorOpen = true;
	}
</script>

<!-- A shared link opened while /play is already showing changes only the hash. -->
<svelte:window onhashchange={() => data && void openSharedLink()} />

<main>
	<header>
		<h1>{script?.name ?? 'Player view'}</h1>
		<p class="author">{script?.meta.author ?? ' '}</p>
		<!-- Players stay in their game: no Change script (Trevor, 2026-10-16). Another script
		     loads only from a share link, QR code or code. A Room link will sit beside Share. -->
		<div class="load">
			<Button variant="quiet" onclick={openCode}>Code</Button>
			<ShareControl what="script" title={script?.name ?? 'Script'} target={shareTarget} />
		</div>
	</header>

	{#if error}
		<p role="alert">Could not load the script: {error}</p>
	{:else}
		<Tabs
			bind:value={tab}
			label="Player view"
			tabs={[
				{ value: 'script', label: 'Script' },
				{ value: 'night', label: 'Night' },
				{ value: 'circle', label: 'Circle' },
				{ value: 'notes', label: 'Notes' }
			]}
		>
			{#snippet panel(value)}
				<div class="panel">
					<!-- A crash in one tab replaces only that tab. -->
					<ErrorBoundary area="play">
						{#if !script || !notebook}
							<p class="muted">Loading…</p>
						{:else if value === 'script'}
							<ScriptSheet characters={sheet} {jinxes} {players} />
						{:else if value === 'night'}
							<PlayerNightOrder {nights} {players} />
						{:else if value === 'circle'}
							<SeatCircle
								seats={notebook.book.seats}
								characters={byId}
								layout={notebook.book.layout}
								onSeatCount={(n) => notebook!.setSeatCount(n)}
								onOpenSeat={openSeat}
								onLayout={(layout) => notebook!.setLayout(layout)}
							/>
						{:else}
							<NotesPanel
								notes={notebook.book.notes}
								seats={notebook.book.seats}
								onAdd={() => openNote(notebook!.addNote())}
								onOpenNote={openNote}
								onOpenSeat={openSeat}
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

	<Dialog bind:open={codeOpen} title="Have a code?">
		{#if codeOpen}
			<ShareCodeEntry bind:value={codeText} disabled={codeBusy} onsubmit={() => loadCode()} />
		{/if}
		<p class="code-error" role="status">{codeError}</p>
		{#snippet actions()}
			<Button variant="accent" onclick={loadCode} disabled={codeBusy || codeText === ''}
				>Load</Button
			>
		{/snippet}
	</Dialog>

	{#if notebook && script}
		<ErrorBoundary area="play">
			<SeatEditor
				bind:open={editorOpen}
				seat={notebook.book.seats[seatIndex]}
				number={seatIndex + 1}
				characters={script.characters}
				onChange={(patch) => editing && notebook!.updateSeat(editing, patch)}
				onToggleClaim={(id) => editing && notebook!.toggleClaim(editing, id)}
			/>
		</ErrorBoundary>
		<ErrorBoundary area="play">
			<NoteEditor
				bind:open={noteOpen}
				note={notebook.book.notes.find((n) => n.noteId === noteId)}
				onChange={(patch) => noteId && notebook!.updateNote(noteId, patch)}
				onDelete={() => noteId && notebook!.deleteNote(noteId)}
			/>
		</ErrorBoundary>
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-3) var(--space-3) var(--space-6);
	}
	header {
		margin-bottom: var(--space-2);
	}
	/* Code, Share and QR code, on their own row so a long script name never squeezes them. */
	.load {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: 1.6rem;
		color: var(--heading);
	}
	.author {
		margin: 0;
		min-height: 1.4em;
		color: var(--on-surface-muted);
	}
	.code-error {
		/* Space kept for the message so the dialog never grows (no reflow). */
		min-height: 3lh;
		margin: var(--space-2) 0 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
	.panel {
		padding-top: var(--space-3);
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
