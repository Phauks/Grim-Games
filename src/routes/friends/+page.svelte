<script lang="ts">
	import FriendsPage from '#lib/features/friends/FriendsPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{t('friends.pageTitle')}</title>
</svelte:head>

<FriendsPage />
