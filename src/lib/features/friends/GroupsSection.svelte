<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import FriendRows from './FriendRows.svelte';
	import GroupDialog from './GroupDialog.svelte';
	import GroupFormDialog from './GroupFormDialog.svelte';
	import { readGroupLink, type GroupSummary } from './groups-protocol.ts';
	import { groups } from './groups.svelte.ts';

	/**
	 * The Friends page's Groups (plan F6): each group with how many are in it and how many
	 * games show in it now, opened for its games and code; + offers Join a group and New group.
	 * A group link (`/friends#group=…`) opens Join a group with its code in.
	 */
	let form = $state<'new' | 'join'>('join');
	let formOpen = $state(false);
	let linked = $state('');
	let openCode = $state<string>();
	let groupOpen = $state(false);
	const opened = $derived(groups.data?.find((group) => group.code === openCode));

	function openGroupLink(): void {
		const code = readGroupLink(location.hash);
		if (!code) return;
		history.replaceState(history.state, '', location.pathname);
		linked = code;
		form = 'join';
		formOpen = true;
	}

	onMount(() => {
		void groups.load();
		openGroupLink();
		window.addEventListener('hashchange', openGroupLink);
		return () => window.removeEventListener('hashchange', openGroupLink);
	});

	function show(code: string): void {
		openCode = code;
		groupOpen = true;
	}

	function startForm(mode: 'new' | 'join'): void {
		linked = '';
		form = mode;
		formOpen = true;
	}
</script>

{#snippet groupLabel(group: GroupSummary)}
	<span class="name">{group.name}</span>
	<span class="line"
		>{t('friends.groups.members', { count: group.members })} · {t('friends.groups.gamesNow', {
			count: group.games.length
		})}</span
	>
{/snippet}

{#snippet groupActions(group: GroupSummary)}
	<Button variant={group.games.length ? 'accent' : 'quiet'} onclick={() => show(group.code)}
		>{t('friends.groups.open')}</Button
	>
{/snippet}

<PageSection title={t('friends.groups')}>
	{#snippet aside()}
		<Menu
			icon="add"
			label={t('friends.groups.add')}
			items={[
				{ value: 'join', label: t('friends.groups.join'), onSelect: () => startForm('join') },
				{ value: 'new', label: t('friends.groups.new'), onSelect: () => startForm('new') }
			]}
		/>
	{/snippet}
	{#if groups.data}
		<FriendRows
			items={groups.data}
			key={(group) => group.code}
			testid="friend-groups"
			label={groupLabel}
			actions={groupActions}
		/>
	{:else}
		<p class="muted">{t('friends.loading')}</p>
	{/if}
</PageSection>

<GroupFormDialog bind:open={formOpen} mode={form} initial={linked} ondone={show} />
<GroupDialog bind:open={groupOpen} group={opened} />

<style>
	.name {
		display: block;
	}
	.line,
	.muted {
		display: block;
		margin: 0;
		color: var(--on-surface-muted);
		font-weight: normal;
		font-size: 0.85rem;
	}
</style>
