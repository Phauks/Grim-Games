<script lang="ts">
	import { onMount } from 'svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import ProfileIcon from '#lib/features/account/ProfileIcon.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { fetchJson } from '#lib/ui/fetch.ts';
	import AddFriendDialog from './AddFriendDialog.svelte';
	import FriendRows from './FriendRows.svelte';
	import { scriptOpenHref } from './friend-links.ts';
	import {
		profileApi,
		type ProfileResponse,
		type PublishedScript
	} from './friend-scripts-protocol.ts';
	import { friends } from './friends.svelte.ts';

	/**
	 * Someone's profile (plan F10): their username, profile icon and the scripts they publish,
	 * and how many games they've played (F11), which anyone can open without signing in (Trevor, 2026-10-30: "instead of having to
	 * login, they can just point at their profile"). Signed in, Add friend asks them.
	 */
	let { username }: { username: string } = $props();

	let profile = $state.raw<ProfileResponse | undefined>();
	/** Why the profile can't be shown; empty while it loads or once it has. */
	let problem = $state('');
	let adding = $state(false);

	onMount(() => {
		void friends.load();
		void (async () => {
			try {
				const { response, body } = await fetchJson(profileApi(username), {
					credentials: 'omit'
				});
				if (response.ok) profile = body as ProfileResponse;
				else if (response.status === 404) problem = t('friends.refused.not-found');
				else if (response.status === 429) problem = t('friends.profile.tooMany');
				else problem = t('account.api.httpStatus', { status: response.status });
			} catch {
				problem = t(navigator.onLine === false ? 'account.api.offline' : 'account.api.unreachable');
			}
		})();
	});

	const key = $derived((profile?.username ?? username).toLowerCase());
	const own = $derived(account.user?.username?.toLowerCase() === key);
	const known = $derived(
		friends.data &&
			[...friends.data.friends, ...friends.data.outgoing].some(
				(other) => other.username?.toLowerCase() === key
			)
	);
</script>

{#snippet scriptLabel(script: PublishedScript)}{script.name}{/snippet}

{#snippet scriptActions(script: PublishedScript)}
	<Button variant="accent" href={scriptOpenHref(script.hash)}>{t('friends.scripts.open')}</Button>
{/snippet}

<Page title={profile?.username ?? username}>
	<!-- Always there, so the page doesn't move when the count arrives (plan F11). -->
	{#snippet subtitle()}<span data-testid="profile-games"
			>{profile?.games === undefined
				? '\u00a0'
				: t('friends.profile.games', { games: profile.games })}</span
		>{/snippet}
	{#snippet lead()}<span class="icon"><ProfileIcon icon={profile?.icon} /></span>{/snippet}
	{#snippet actions()}
		{#if account.status === 'signed-in'}
			<!-- Kept in place, disabled, for yourself and friends, so nothing moves once they load. -->
			<Button
				icon="add"
				variant="quiet"
				disabled={!profile || own || known !== false}
				onclick={() => (adding = true)}>{t('friends.add')}</Button
			>
		{/if}
	{/snippet}
	<ErrorBoundary area="friends">
		<PageSection title={t('friends.profile.scripts')}>
			{#if profile}
				<FriendRows
					items={profile.scripts}
					key={(script) => script.hash}
					testid="profile-page-scripts"
					label={scriptLabel}
					actions={scriptActions}
				/>
			{:else}
				<p class="muted" role="status">{problem || t('friends.loading')}</p>
			{/if}
		</PageSection>
	</ErrorBoundary>
</Page>

<AddFriendDialog bind:open={adding} initial={profile?.username ?? username} />

<style>
	.icon {
		display: inline-grid;
		width: 1.2em;
		height: 1.2em;
		vertical-align: middle;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
