<script lang="ts">
	import { onMount } from 'svelte';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { parseEndReason } from '#lib/core/rules/game-end/end-reason.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import {
		historyStats,
		type GameHistory,
		type HistoryDay,
		type HistoryScript,
		type LedgerFinish,
		type LedgerGame
	} from '#lib/core/sync/game-ledger.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { endReasonLabel } from '#lib/features/game/end-reason-label.ts';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import { intl, locale, t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import StatCards from '#lib/ui/layout/StatCards.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import { loadGameHistory } from './live-games-api.ts';

	// Game history, at /game-history (Trevor, 2026-11-12, option B): the games played in live
	// rooms on every site, for admin accounts, laid out as History is (summary, scripts, the
	// games). The Worker decides who may read it (worker/game-ledger.ts).

	const DAY = 24 * 60 * 60 * 1000;
	type Period = '7' | '30' | '90' | 'all';

	let access = $state<'checking' | 'none' | 'admin'>('checking');
	let period = $state<Period>('30');
	let history = $state.raw<GameHistory>({ games: [], rooms: [] });
	let since = $state(0);

	const periods = $derived<{ value: Period; label: string }[]>([
		{ value: '7', label: t('room.gameHistory.days7') },
		{ value: '30', label: t('room.gameHistory.days30') },
		{ value: '90', label: t('room.gameHistory.days90') },
		{ value: 'all', label: t('room.gameHistory.allTime') }
	]);

	/** The viewer's own day, sortable (2026-11-12). */
	const dayKey = (at: number) => {
		const d = new Date(at);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	};
	const dayText = (key: string) => {
		const [y, m, d] = key.split('-').map(Number);
		return intl.date(new Date(y, m - 1, d), { weekday: 'short', day: 'numeric', month: 'short' });
	};
	const time = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'short', timeStyle: 'short' })
	);
	const count = (n: number) => intl.number(n);
	const length = (ms: number | undefined) => {
		if (ms === undefined) return t('common.none');
		const minutes = Math.round(ms / 60_000);
		return minutes < 60
			? t('room.gameHistory.minutes', { minutes })
			: t('room.gameHistory.hoursMinutes', {
					hours: Math.floor(minutes / 60),
					minutes: String(minutes % 60).padStart(2, '0')
				});
	};
	const share = (part: number, whole: number) =>
		whole ? intl.number(part / whole, { style: 'percent' }) : t('common.none');

	const stats = $derived(historyStats(history, since, dayKey));
	const decided = $derived(stats.summary.wins.good + stats.summary.wins.evil);
	const summaryCards = $derived([
		{ label: t('room.gameHistory.games'), value: count(stats.summary.games) },
		{ label: t('room.gameHistory.rooms'), value: count(stats.summary.rooms) },
		{ label: t('room.gameHistory.players'), value: count(stats.summary.players) },
		{ label: t('room.gameHistory.averageLength'), value: length(stats.summary.averageLength) },
		{
			label: t('room.gameHistory.goodWins'),
			value: count(stats.summary.wins.good),
			share: share(stats.summary.wins.good, decided)
		},
		{
			label: t('room.gameHistory.evilWins'),
			value: count(stats.summary.wins.evil),
			share: share(stats.summary.wins.evil, decided)
		}
	]);

	/** Official characters name a character's own win ("Saint"); a custom one shows its id. */
	const characters = $derived(
		new Map<CharacterId, Character>(officialData.current?.characters.map((c) => [c.id, c]) ?? [])
	);
	const howEnded = (g: LedgerGame) => {
		const reason = parseEndReason(g.reason);
		return reason ? endReasonLabel(reason, characters) : t('common.none');
	};
	const winner = (g: LedgerGame) =>
		g.winner
			? t(g.winner === 'good' ? 'room.gameHistory.good' : 'room.gameHistory.evil')
			: t('common.none');
	const finishText = (finish: LedgerFinish) =>
		({
			'game-over': () => t('room.gameHistory.finishGameOver'),
			'new-game': () => t('room.gameHistory.finishNewGame'),
			closed: () => t('room.gameHistory.finishClosed'),
			expired: () => t('room.gameHistory.finishExpired')
		})[finish]();
	const site = (g: LedgerGame) =>
		t(g.site === 'preview' ? 'room.gameHistory.preview' : 'room.gameHistory.production');

	type ScriptColumn = 'script' | 'games' | 'good' | 'evil' | 'length';
	const scriptColumns = $derived<DataColumn<ScriptColumn, HistoryScript>[]>([
		{ id: 'script', label: t('room.gameHistory.script'), rowHeader: true, value: (s) => s.script },
		{ id: 'games', label: t('room.gameHistory.games'), width: '12%', value: (s) => s.games },
		{
			id: 'good',
			label: t('room.gameHistory.goodWins'),
			width: '14%',
			wide: true,
			value: (s) => s.good
		},
		{
			id: 'evil',
			label: t('room.gameHistory.evilWins'),
			width: '14%',
			wide: true,
			value: (s) => s.evil
		},
		{
			id: 'length',
			label: t('room.gameHistory.averageLength'),
			width: 'max(18%, 7rem)',
			value: (s) => s.averageLength ?? 0
		}
	]);

	type DayColumn = 'day' | 'rooms' | 'games' | 'players' | 'atOnce';
	const dayColumns = $derived<DataColumn<DayColumn, HistoryDay>[]>([
		{ id: 'day', label: t('room.gameHistory.day'), rowHeader: true, value: (d) => d.day },
		{ id: 'rooms', label: t('room.gameHistory.rooms'), width: '16%', value: (d) => d.rooms },
		{ id: 'games', label: t('room.gameHistory.games'), width: '14%', value: (d) => d.games },
		{ id: 'players', label: t('room.gameHistory.players'), width: '14%', value: (d) => d.players },
		{
			id: 'atOnce',
			label: t('room.gameHistory.atOnce'),
			width: '18%',
			wide: true,
			value: (d) => d.atOnce
		}
	]);

	type GameColumn =
		'ended' | 'script' | 'players' | 'length' | 'winner' | 'how' | 'finish' | 'site' | 'room';
	const games = $derived(history.games.filter((g) => g.ended >= since));
	const gameColumns = $derived<DataColumn<GameColumn, LedgerGame>[]>([
		{
			id: 'ended',
			label: t('room.gameHistory.ended'),
			width: 'max(14%, 7rem)',
			value: (g) => g.ended
		},
		{
			id: 'script',
			label: t('room.gameHistory.script'),
			rowHeader: true,
			value: (g) => g.script ?? t('common.none')
		},
		{
			id: 'players',
			label: t('room.gameHistory.players'),
			width: 'max(8%, 4.5rem)',
			value: (g) => g.players
		},
		{
			id: 'length',
			label: t('room.gameHistory.length'),
			width: '10%',
			wide: true,
			wider: true,
			value: (g) => g.ended - g.started
		},
		{ id: 'winner', label: t('room.gameHistory.winner'), width: '8%', wide: true, value: winner },
		{ id: 'how', label: t('room.gameHistory.howEnded'), width: '12%', wide: true, value: howEnded },
		{
			id: 'finish',
			label: t('room.gameHistory.finish'),
			width: '11%',
			wide: true,
			value: (g) => finishText(g.finish)
		},
		{
			id: 'site',
			label: t('room.gameHistory.site'),
			width: '8%',
			wide: true,
			wider: true,
			value: site
		},
		{
			id: 'room',
			label: t('room.gameHistory.room'),
			width: '8%',
			wide: true,
			wider: true,
			value: (g) => formatRoomCode(g.room)
		}
	]);

	onMount(() => {
		void loadOfficialData().catch(() => {});
		void load();
	});

	async function load() {
		since = period === 'all' ? 0 : Date.now() - Number(period) * DAY;
		try {
			const list = await loadGameHistory(since || undefined);
			if (list) history = list;
			access = list === undefined ? 'none' : 'admin';
		} catch {
			if (access === 'checking') access = 'none';
			toast(t('room.gameHistory.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	function choose(next: Period) {
		period = next;
		void load();
	}
</script>

<!-- Refresh and Period are always there, disabled until they apply, so nothing moves. -->
<Page title={t('room.gameHistory.title')}>
	{#snippet actions()}
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={access !== 'admin'}
			onclick={load}
		/>
	{/snippet}
	{#snippet toolbar()}
		<Select
			label={t('room.gameHistory.period')}
			value={period}
			options={periods}
			disabled={access !== 'admin'}
			onChange={choose}
		/>
	{/snippet}
	{#if access === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if access === 'none'}
		<div class="none">
			<p>{t('room.gameHistory.adminsOnly')}</p>
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<PageSection title={t('room.gameHistory.summary')}>
			<StatCards stats={summaryCards} testid="game-history-summary" />
		</PageSection>
		<PageSection
			title={t('room.gameHistory.scripts')}
			collapsible
			storageKey="game-history.scripts"
		>
			<DataTable
				label={t('room.gameHistory.scripts')}
				columns={scriptColumns}
				rows={stats.scripts}
				key={(s) => s.script}
				narrow="hide"
				fit="container"
				hideKey="game-history-scripts"
				empty={t('common.none')}
				testid="game-history-scripts"
			>
				{#snippet cell(s, column)}
					{#if column.id === 'script'}
						{s.script}
					{:else if column.id === 'length'}
						{length(s.averageLength)}
					{:else}
						{count(s[column.id])}
					{/if}
				{/snippet}
			</DataTable>
		</PageSection>
		<PageSection title={t('room.gameHistory.days')} collapsible storageKey="game-history.days">
			<DataTable
				label={t('room.gameHistory.days')}
				columns={dayColumns}
				rows={stats.days}
				key={(d) => d.day}
				narrow="hide"
				fit="container"
				hideKey="game-history-days"
				empty={t('common.none')}
				testid="game-history-days"
			>
				{#snippet cell(d, column)}
					{#if column.id === 'day'}
						{dayText(d.day)}
					{:else}
						{count(d[column.id])}
					{/if}
				{/snippet}
			</DataTable>
		</PageSection>
		<PageSection title={t('room.gameHistory.games')}>
			<DataTable
				label={t('room.gameHistory.games')}
				columns={gameColumns}
				rows={games}
				key={(g) => g.id}
				narrow="hide"
				fit="container"
				hideKey="game-history-games"
				pageSize={50}
				empty={t('common.none')}
				testid="game-history-games"
			>
				{#snippet cell(g, column)}
					{#if column.id === 'ended'}
						{time.format(g.ended)}
					{:else if column.id === 'script'}
						{g.script ?? t('common.none')}
					{:else if column.id === 'players'}
						{count(g.players)}
					{:else if column.id === 'length'}
						{length(g.ended - g.started)}
					{:else if column.id === 'winner'}
						{winner(g)}
					{:else if column.id === 'how'}
						{howEnded(g)}
					{:else if column.id === 'finish'}
						{finishText(g.finish)}
					{:else if column.id === 'site'}
						{site(g)}
					{:else}
						{formatRoomCode(g.room)}
					{/if}
				{/snippet}
			</DataTable>
		</PageSection>
	{/if}
</Page>

<style>
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
