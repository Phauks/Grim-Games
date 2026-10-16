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
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import CharacterReference from './CharacterReference.svelte';
	import NightOrderReference from './NightOrderReference.svelte';
	import TokenKey from './TokenKey.svelte';
	import { referenceView, type ReferenceView } from './view-mode.svelte.ts';

	type View = 'characters' | 'night';

	let data = $state<GameData>();
	let numeric = $state<NumericNightOrder>();
	let error = $state<string>();
	let view = $state<View>('characters');
	let keyOpen = $state(false);

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

<main>
	<h1>{t('reference.title')}</h1>
	<div class="view">
		<div class="switch">
			<Segmented
				label={t('reference.showAs')}
				hideLabel
				value={referenceView.current}
				options={[
					{ value: 'cards', label: t('reference.viewCards') },
					{ value: 'table', label: t('reference.viewTable') }
				] satisfies { value: ReferenceView; label: string }[]}
				onChange={(value) => (referenceView.current = value)}
			/>
		</div>
		<IconButton icon="info" label={t('reference.tokenKey')} onclick={() => (keyOpen = true)} />
	</div>
	<TokenKey bind:open={keyOpen} />

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
</main>

<style>
	main {
		/* Centred on a computer, still wide enough for three columns of cards (App shell, 2026-10-16). */
		max-width: calc(75 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-size: 1.8rem;
	}
	.view {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.switch {
		flex: 0 1 calc(16 * var(--u));
	}
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>
