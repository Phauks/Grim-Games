<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { LiveGame } from '#lib/core/sync/live-games.ts';
	import { phaseText } from '#lib/features/game/phase-text.ts';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import type { ColumnFilter } from '#lib/ui/table/column-filter.ts';
	import { listLiveGames } from './live-games-api.ts';

	// Live games, at /live-games (plan J31, Trevor 2026-10-26): every open room, for admin
	// accounts. A row opens the room read-only and unseen; the Worker decides who may list them.

	/** Still checking, not an admin account (or signed out), or an admin's list. */
	let access = $state<'checking' | 'none' | 'admin'>('checking');
	let games = $state<LiveGame[]>();
	let columnFilters = $state<Partial<Record<Column, ColumnFilter>>>({});

	const time = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'short', timeStyle: 'short' })
	);

	const scriptName = (g: LiveGame) => g.preview.script?.name || t('common.none');
	const storyteller = (g: LiveGame) => g.preview.storyteller || t('common.none');
	/** Over (and who won), or the phase the board is in. */
	const gameState = (g: LiveGame) => {
		if (g.ended) {
			if (g.ended.winner === 'good') return t('room.liveGames.goodWon');
			if (g.ended.winner === 'evil') return t('room.liveGames.evilWon');
			return t('room.liveGames.gameOver');
		}
		return g.phase ? phaseText(g.phase) : t('common.none');
	};
	/** Who is connected now: an open room nobody is in is a game left, not one being played. */
	const connected = (g: LiveGame) => {
		if (g.storyteller && g.phones) {
			return t('room.liveGames.storytellerAndPhones', { count: g.phones });
		}
		if (g.storyteller) return t('room.liveGames.storytellerHere');
		if (g.phones) return t('room.liveGames.phonesHere', { count: g.phones });
		return t('common.none');
	};
	const opened = (g: LiveGame) =>
		g.opened === undefined ? t('common.none') : time.format(g.opened);
	const seated = (g: LiveGame) =>
		g.preview.seats === undefined
			? t('common.none')
			: t('room.liveGames.seatedOf', { seated: g.preview.seated ?? 0, seats: g.preview.seats });

	type Column =
		| 'code'
		| 'script'
		| 'storyteller'
		| 'state'
		| 'connected'
		| 'seated'
		| 'games'
		| 'opened'
		| 'active';
	const columns = $derived<DataColumn<Column, LiveGame>[]>([
		{
			id: 'code',
			flush: true,
			label: t('room.liveGames.code'),
			width: 'max(10%, 5.5rem)',
			value: (g) => formatRoomCode(g.code)
		},
		{
			id: 'script',
			flush: true,
			label: t('room.liveGames.script'),
			rowHeader: true,
			value: scriptName
		},
		{
			id: 'storyteller',
			flush: true,
			label: t('room.liveGames.storyteller'),
			width: '10%',
			wide: true,
			value: storyteller
		},
		{
			id: 'state',
			flush: true,
			label: t('room.liveGames.state'),
			width: 'max(12%, 6.5rem)',
			value: gameState
		},
		{
			id: 'connected',
			flush: true,
			label: t('room.liveGames.connected'),
			width: '13%',
			wide: true,
			value: connected
		},
		{
			id: 'seated',
			flush: true,
			label: t('room.liveGames.seated'),
			width: '8%',
			wide: true,
			wider: true,
			value: seated
		},
		{
			id: 'games',
			flush: true,
			label: t('room.liveGames.games'),
			width: '6%',
			wide: true,
			wider: true,
			value: (g) => g.games
		},
		{
			id: 'opened',
			flush: true,
			label: t('room.liveGames.opened'),
			width: 'max(10%, 6rem)',
			wide: true,
			wider: true,
			value: (g) => g.opened ?? 0
		},
		{
			id: 'active',
			flush: true,
			label: t('room.liveGames.active'),
			width: 'max(10%, 6rem)',
			wide: true,
			value: (g) => g.active
		}
	]);

	onMount(() => void load());

	async function load() {
		try {
			const list = await listLiveGames();
			games = list?.games;
			access = list === undefined ? 'none' : 'admin';
		} catch {
			if (access === 'checking') access = 'none';
			toast(t('room.liveGames.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	function watch(game: LiveGame) {
		void goto(resolve('/live-games/[code]', { code: game.code }));
	}
</script>

<!-- Refresh is always there, disabled until it applies, so nothing moves when the list appears. -->
<Page title={t('room.liveGames.title')}>
	{#snippet actions()}
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={access !== 'admin'}
			onclick={load}
		/>
	{/snippet}
	{#if access === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if access === 'none'}
		<div class="none">
			<p>{t('room.liveGames.adminsOnly')}</p>
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<DataTable
			label={t('room.liveGames.title')}
			{columns}
			rows={games ?? []}
			key={(g) => g.code}
			bind:columnFilters
			narrow="hide"
			fit="container"
			hideKey="live-games"
			pageSize={50}
			empty={t('common.none')}
			testid="live-games"
		>
			{#snippet cell(game, column)}
				<!-- Every cell opens the same room, so a tap anywhere on the row does; only the
				     script is in the tab order. -->
				<button
					type="button"
					class="open"
					tabindex={column.id === 'script' ? undefined : -1}
					onclick={() => watch(game)}
				>
					{#if column.id === 'code'}
						{formatRoomCode(game.code)}
					{:else if column.id === 'script'}
						{scriptName(game)}
					{:else if column.id === 'storyteller'}
						{storyteller(game)}
					{:else if column.id === 'state'}
						{gameState(game)}
					{:else if column.id === 'connected'}
						{connected(game)}
					{:else if column.id === 'seated'}
						{seated(game)}
					{:else if column.id === 'games'}
						{game.games}
					{:else if column.id === 'opened'}
						{opened(game)}
					{:else}
						{time.format(game.active)}
					{/if}
				</button>
			{/snippet}
		</DataTable>
	{/if}
</Page>

<style>
	.open {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	:global([data-testid='live-games'] tr:has(.open:hover)) {
		background: var(--surface-hover);
	}
	.none {
		display: grid;
		justify-items: start;
		gap: var(--space-2);
		padding: var(--space-2);
		color: var(--on-surface-muted);
	}
	.none p {
		margin: 0;
	}
</style>
