<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { describeThrown } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { onMount, tick } from 'svelte';
	import type { GameData } from '#lib/core/data/index.ts';
	import { characterReference } from '#lib/core/rules/reference.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
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

	onMount(async () => {
		try {
			data = await loadOfficialData();
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
			<CharacterReference {entries} {query} />
		{/if}
	</ErrorBoundary>
</Page>

<style>
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>
