<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount } from 'svelte';
	import { isSeatable } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import InfoTokensPanel from '#lib/features/info-tokens/InfoTokensPanel.svelte';
	import Page from '#lib/ui/layout/Page.svelte';

	onMount(() => void loadOfficialData());
	// Until a game's script is open, any character can be shown with a card.
	const characters = $derived(
		officialData.current?.characters.filter((c) => isSeatable(c.type)) ?? []
	);
</script>

<svelte:head>
	<title>{t('info-tokens.title')} · {APP_NAME}</title>
</svelte:head>

<Page title={t('info-tokens.title')}>
	<InfoTokensPanel {characters} />
</Page>
