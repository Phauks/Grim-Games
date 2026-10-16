<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptsPage from '#lib/features/scripts/ScriptsPage.svelte';
</script>

<svelte:head>
	<title>{t('scripts.pageTitle')}</title>
</svelte:head>

<ScriptsPage />
