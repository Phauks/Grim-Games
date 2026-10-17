<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptBuilderPage from '#lib/features/script-builder/ScriptBuilderPage.svelte';
</script>

<svelte:head>
	<title>{t('script-builder.pageTitle')}</title>
</svelte:head>

<ScriptBuilderPage />
