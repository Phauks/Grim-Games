<script lang="ts">
	import { onMount } from 'svelte';
	import { historyStats, type GameRecord } from '#lib/core/stats/index.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { loadGameRecords } from '#lib/features/history/records.ts';
	import ProfileAvatar from '#lib/features/player/ProfileAvatar.svelte';
	import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { openSettings } from './shell.ts';

	/**
	 * Home's player card (Trevor, 2026-11-06: "a stats screen above as a player, shows the
	 * account image, with current customization settings"): the Profile's avatar in its laurel,
	 * the name and tag-line, then History's summary counts. A tap opens the Profile.
	 */
	let records = $state.raw<GameRecord[]>([]);
	onMount(() => {
		loadGameRecords()
			.then((r) => (records = r))
			.catch((e: unknown) => reportError(e, { area: 'history' }));
	});
	const summary = $derived(historyStats(records).summary);
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
	const tagline = $derived(playerSettings.current.flavour);
	const stats = $derived([
		{ label: t('history.games'), value: summary.games },
		{ label: t('history.goodWins'), value: summary.wins.good },
		{ label: t('history.evilWins'), value: summary.wins.evil }
	]);
</script>

<button
	type="button"
	class="card"
	data-testid="home-profile"
	aria-label={t('player.profile')}
	onclick={() => openSettings('profile')}
>
	<span class="avatar"><ProfileAvatar /></span>
	<span class="who">
		<span class="name">{name || t('common.none')}</span>
		<!-- Always a line, so a tag-line set later moves nothing. -->
		<span class="tagline">{tagline || ''}</span>
	</span>
	<dl class="stats">
		{#each stats as stat (stat.label)}
			<div>
				<dt>{stat.label}</dt>
				<dd>{intl.number(stat.value)}</dd>
			</div>
		{/each}
	</dl>
</button>

<style>
	.card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2) var(--space-3);
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.card:hover {
		background: var(--surface-hover);
	}
	.avatar {
		display: block;
		width: calc(5 * var(--u));
		height: calc(5 * var(--u));
	}
	.who {
		display: grid;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1.1rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tagline {
		min-height: 1.5em;
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stats {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	.stats div {
		display: grid;
		text-align: center;
	}
	dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	dd {
		margin: 0;
		font-size: 1.2rem;
		font-variant-numeric: tabular-nums;
	}
</style>
