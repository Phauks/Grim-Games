<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { describeThrown } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { onMount, tick } from 'svelte';
	import type { GameData, NumericNightOrder } from '#lib/core/data/index.ts';
	import { characterReference } from '#lib/core/rules/reference.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import CharacterReference from './CharacterReference.svelte';
	import NightOrderReference from './NightOrderReference.svelte';
	import { referenceView } from './view-mode.svelte.ts';

	type View = 'characters' | 'night';

	let data = $state<GameData>();
	let numeric = $state<NumericNightOrder>();
	let error = $state<string>();
	let view = $state<View>('characters');

	// Built at runtime from the same data and rules code the app uses.
	const entries = $derived(data ? characterReference(data, numeric) : []);

	onMount(async () => {
		try {
			// The numeric snapshot is optional: without it the page still shows TPI's order.
			const [game, numbers] = await Promise.all([
				loadOfficialData(),
				loadNumericNightOrder().catch(() => undefined)
			]);
			numeric = numbers;
			data = game;
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
	<Tabs
		bind:value={view}
		label={t('reference.views')}
		tabs={[
			{ value: 'characters', label: t('reference.tabCharacters') },
			{ value: 'night', label: t('reference.tabNight') }
		]}
	>
		{#snippet panel(tab)}
			<ErrorBoundary area="reference">
				{#if error}
					<p role="alert">{t('reference.loadError', { error })}</p>
				{:else if !data}
					<!-- Reserved space while the data loads, so nothing below jumps. -->
					<div class="loading" aria-busy="true">{t('reference.loading')}</div>
				{:else if tab === 'characters'}
					<CharacterReference {entries} view={referenceView.current} />
				{:else}
					<NightOrderReference {data} {numeric} view={referenceView.current} />
				{/if}
			</ErrorBoundary>
		{/snippet}
	</Tabs>
</Page>

<style>
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>
