<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ReferencePage from '#lib/features/reference/ReferencePage.svelte';
</script>

<svelte:head>
	<title>{t('reference.pageTitle')}</title>
</svelte:head>

<ReferencePage />
