<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		editionScript,
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
	import { currentScript, restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { NotebookState } from './notebook-store.svelte.ts';
	import { playerCount, scriptKey } from './notebook.ts';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerJinxes, playerNight } from './player-script.ts';
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
		} catch (e) {
			// Shown inline below, so only logged.
			reportError(e, { area: 'play', notify: false });
			error = errorMessage(e);
		}
	});

	const script = $derived(data ? (currentScript.current ?? fallback) : undefined);
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
		void book.load().then(() => {
			if (book.key === key) notebook = book;
		});
	});

	const players = $derived(notebook ? playerCount(notebook.book) : 0);
	const jinxes = $derived(script && data ? playerJinxes(script, data) : []);
	const nights = $derived(
		script && data
			? (['first', 'other'] as const).map((n) => playerNight(script!, data!, n, players, numeric))
			: []
	);
	const byId = $derived(new Map(script?.characters.map((c) => [c.id, c]) ?? []));
	const seatIndex = $derived(notebook?.book.seats.findIndex((s) => s.seatId === editing) ?? -1);

	function openSeat(seatId: string) {
		editing = seatId;
		editorOpen = true;
	}
</script>

<main>
	<header>
		<h1>{script?.name ?? 'Player view'}</h1>
		<p class="author">{script?.meta.author ?? ' '}</p>
		<a class="change" href={resolve('/scripts')}>Change script</a>
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
							<ScriptSheet {script} {jinxes} {players} />
						{:else if value === 'night'}
							<PlayerNightOrder {nights} {players} />
						{:else if value === 'circle'}
							<SeatCircle
								seats={notebook.book.seats}
								me={notebook.book.me}
								characters={byId}
								onSeatCount={(n) => notebook!.setSeatCount(n)}
								onOpenSeat={openSeat}
							/>
						{:else}
							<label class="notes">
								<span>Notes</span>
								<textarea
									value={notebook.book.notes}
									oninput={(event) => notebook!.setNotes(event.currentTarget.value)}></textarea>
							</label>
						{/if}
						{#if notebook && (value === 'circle' || value === 'notes')}
							<p class="private" data-testid="storage-note">
								{notebook.saveError
									? 'This browser cannot save: notes are lost when the page closes.'
									: 'Saved on this device only. Nobody else can see it.'}
							</p>
						{/if}
					</ErrorBoundary>
				</div>
			{/snippet}
		</Tabs>
	{/if}

	{#if notebook && script}
		<ErrorBoundary area="play">
			<SeatEditor
				bind:open={editorOpen}
				seat={notebook.book.seats[seatIndex]}
				number={seatIndex + 1}
				isMe={notebook.book.me === editing}
				characters={script.characters}
				onChange={(patch) => editing && notebook!.updateSeat(editing, patch)}
				onToggleMe={() => editing && notebook!.toggleMe(editing)}
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
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: start;
		column-gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	header h1,
	header .author {
		grid-column: 1;
	}
	.change {
		grid-column: 2;
		grid-row: 1;
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		font-family: var(--font-control);
		color: var(--heading);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		color: var(--heading);
	}
	.author {
		margin: 0;
		min-height: 1.4em;
		color: var(--on-surface-muted);
	}
	.panel {
		padding-top: var(--space-3);
	}
	.muted,
	.private {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.private {
		margin: var(--space-3) 0 0;
		text-align: center;
	}
	.notes {
		display: grid;
		gap: var(--space-1);
		font-family: var(--font-control);
	}
	.notes textarea {
		height: 60dvh;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 1rem;
		resize: none;
	}
</style>
