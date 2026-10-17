<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import LibraryPage from '#lib/features/library/LibraryPage.svelte';
</script>

<svelte:head>
	<title>{t('library.pageTitle')}</title>
</svelte:head>

<LibraryPage />
