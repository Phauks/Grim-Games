<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBuilderPage from '#lib/features/character-builder/CharacterBuilderPage.svelte';
</script>

<svelte:head>
	<title>{t('character-builder.pageTitle')}</title>
</svelte:head>

<CharacterBuilderPage />
