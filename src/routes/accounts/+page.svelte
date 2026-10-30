<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import AdminAccountsPage from '#lib/features/account/AdminAccountsPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{`${t('account.admin.title')} · ${APP_NAME}`}</title>
</svelte:head>

<AdminAccountsPage />
