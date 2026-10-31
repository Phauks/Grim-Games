<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import ModeBuilderPage from '#lib/features/mode-builder/ModeBuilderPage.svelte';
</script>

<svelte:head>
	<title>{t('modes.builder.pageTitle')} · {APP_NAME}</title>
</svelte:head>

<ModeBuilderPage />
