<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DiagnosticsPanel from './DiagnosticsPanel.svelte';
</script>

<main>
	<h1>{t('errors.diag.title')}</h1>
	<DiagnosticsPanel />
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
</style>
