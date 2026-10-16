<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AccountPage from '#lib/features/account/AccountPage.svelte';
</script>

<svelte:head>
	<title>{t('account.pageTitle')}</title>
</svelte:head>

<AccountPage />
