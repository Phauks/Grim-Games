<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { describeThrown } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { onMount, tick } from 'svelte';
	import type { GameData } from '#lib/core/data/index.ts';
	import { characterReference } from '#lib/core/rules/reference.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import LabDock from '#lib/features/character-lab/LabDock.svelte';
	import LabPanel from '#lib/features/character-lab/LabPanel.svelte';
	import LabSelect from '#lib/features/character-lab/LabSelect.svelte';
	import { labData } from '#lib/features/character-lab/lab-data.ts';
	import { LabSession } from '#lib/features/character-lab/lab-session.svelte.ts';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import Page from '#lib/ui/layout/Page.svelte';
	import CharacterReference from './CharacterReference.svelte';

	let data = $state<GameData>();
	let error = $state<string>();

	// Built at runtime from the same data and rules code the app uses.
	const entries = $derived(data ? characterReference(data) : []);

	// The Character Lab is this page, for everyone (plans M45, M47): pick the core character
	// with + on the left, and test it against each of its jinx partners on the right. Empty
	// until one is picked (Trevor, 2026-11-05: "Just allow setting what the core one is on the
	// left side, start empty").
	const session = new LabSession();
	/** A computer window: the lab and its game on the right of the table. */
	const computer = new MediaQuery('min-width: 75rem', false);
	// Badges draw a custom character by its own name and icon.
	provideCharacters(() => data?.byId);

	onMount(async () => {
		try {
			// With this device's custom characters, to test as any other (plan M63).
			data = labData(await loadOfficialData());
			session.data = data;
		} catch (e) {
			// Shown in place below, so no corner card as well.
			error = describeThrown(e).message;
			reportError(e, { area: 'reference', notify: false });
			return;
		}
		// A link to one character (#witch, from a bug report) makes it the core one.
		const id = decodeURIComponent(location.hash.slice(1));
		if (id && data.byId.has(id)) {
			if (session.core !== id) session.setCore(id);
			await tick();
			// After the frame that lays out the lab beside the table, so the row stays put.
			requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
		}
	});
</script>

<!-- The whole window (Trevor, 2026-11-05: "you can expand to use more space"). -->
<Page title={t('reference.title')} wide>
	<ErrorBoundary area="reference">
		{#if error}
			<p role="alert">{t('reference.loadError', { error })}</p>
		{:else if !data}
			<!-- Reserved space while the data loads, so nothing below jumps. -->
			<div class="loading" aria-busy="true">{t('reference.loading')}</div>
		{:else}
			<div class="characters" class:with-lab={computer.current}>
				<div class="table-area">
					<LabSelect {session} open={!computer.current} />
					{#if session.core}<CharacterReference {entries} core={session.core} />{/if}
				</div>
				{#if computer.current}
					<aside class="lab-side"><LabPanel {session} frame /></aside>
				{/if}
			</div>
			{#if !computer.current}<LabDock {session} />{/if}
		{/if}
	</ErrorBoundary>
</Page>

<style>
	.characters {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	/* The table on the left, the lab and its game on the right, in view while the table scrolls. */
	.characters.with-lab {
		/* The game square stays short enough to leave room under it for its settings, and the
		   table takes the rest of a wide window (Trevor, 2026-11-05: "expand to use more space"). */
		grid-template-columns: minmax(0, 1fr) min(50%, 60dvh);
		align-items: start;
	}
	.table-area {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}
	.lab-side {
		position: sticky;
		top: calc(var(--app-top) + var(--space-2));
		max-height: calc(100dvh - var(--app-top) - var(--space-4));
		overflow-y: auto;
		min-width: 0;
	}
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>
