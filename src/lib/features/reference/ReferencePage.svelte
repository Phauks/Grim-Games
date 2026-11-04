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
	import { LabSession } from '#lib/features/character-lab/lab-session.svelte.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import Page from '#lib/ui/layout/Page.svelte';
	import CharacterReference from './CharacterReference.svelte';
	import { ReferenceQuery } from './query.svelte.ts';
	import ReferenceControls from './ReferenceControls.svelte';

	let data = $state<GameData>();
	let error = $state<string>();
	// One search and filter set per visit, shared by the title row's controls and the list.
	const query = new ReferenceQuery();

	// Built at runtime from the same data and rules code the app uses.
	const entries = $derived(data ? characterReference(data) : []);

	// The Character Lab is part of this page, for everyone (plan M45, Trevor 2026-11-04: "The
	// only difference between reference and lab is seeing everything at the same time"): lock
	// characters in the table, and its rows as shown are what they are tested against.
	const session = new LabSession();
	/** A computer window: the lab and its game on the right of the table. */
	const computer = new MediaQuery('min-width: 75rem', true);
	const tableLab = $derived({
		locked: session.locked,
		onLock: (id: string, on: boolean) => session.setLocked(id, on)
	});

	onMount(async () => {
		try {
			data = await loadOfficialData();
			session.data = data;
		} catch (e) {
			// Shown in place below, so no corner card as well.
			error = describeThrown(e).message;
			reportError(e, { area: 'reference', notify: false });
			return;
		}
		// A link to one character (#witch, from a bug report) scrolls to its card.
		const id = decodeURIComponent(location.hash.slice(1));
		if (id) {
			await tick();
			document.getElementById(id)?.scrollIntoView();
		}
	});
</script>

<Page title={t('reference.title')}>
	<!-- The search and its controls sit in the title's row, to save a row (Trevor, 2026-10-18).
		They show while the data loads too, so the row never changes height. -->
	{#snippet actions()}
		<ReferenceControls {entries} {query} />
	{/snippet}
	<!-- One view: the table's night columns sort by night order, so no Night order tab
		(Trevor, 2026-10-18). -->
	<ErrorBoundary area="reference">
		{#if error}
			<p role="alert">{t('reference.loadError', { error })}</p>
		{:else if !data}
			<!-- Reserved space while the data loads, so nothing below jumps. -->
			<div class="loading" aria-busy="true">{t('reference.loading')}</div>
		{:else}
			<div class="characters" class:with-lab={computer.current}>
				<div class="table-area">
					<CharacterReference
						{entries}
						{query}
						lab={tableLab}
						only={session.jinxFilterOn ? session.jinxed : undefined}
						onrows={(rows) => (session.listed = rows.map((e) => e.character.id))}
					/>
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
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: start;
	}
	.table-area {
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
