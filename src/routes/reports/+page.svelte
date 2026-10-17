<script lang="ts">
	import ReportsInbox from '#lib/features/reports/ReportsInbox.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{t('reports.pageTitle')}</title>
</svelte:head>

<ReportsInbox />
