<script lang="ts">
	import { editionScript } from '#lib/core/data/index.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ResumeGameRow from '#lib/features/room/ResumeGameRow.svelte';
	import { recentScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { localTown, localTownVisits, type LocalTownVisit } from './local-town.svelte.ts';
	import { openPlayersOnly } from './open-players-only.ts';

	/**
	 * Join game's Players only (plan M55, Trevor 2026-11-05: "they should also show up
	 * differently in the resume game area"): each town this phone keeps with no Storyteller,
	 * newest first, with its seats and deaths. A tap opens its Grim tab again.
	 */
	const lastSeen = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' })
	);

	/** Each town with seats whose script this phone can still load. */
	const games = $derived.by(() => {
		const data = officialData.current;
		if (!data) return [];
		return localTownVisits().flatMap((visit) => {
			const seats = localTown(visit.key).seats;
			if (seats.length === 0) return [];
			const saved = visit.scriptId
				? recentScripts.list.find((s) => s.scriptId === visit.scriptId)
				: undefined;
			const script = visit.edition
				? editionScript(visit.edition, data)
				: saved && reloadSavedScript(saved, data);
			if (!script) return [];
			const source = saved?.source ?? { kind: 'edition' as const };
			const dead = seats.filter((s) => s.dead).length;
			return [{ visit, script, source, seats: seats.length, dead }];
		});
	});

	const line = (seats: number, dead: number) =>
		t('player.local.summary', {
			seats: t('player.local.seats', { count: seats }),
			dead: dead ? t('player.local.dead', { count: dead }) : t('player.local.noneDead')
		});
	const key = (visit: LocalTownVisit) => visit.key;
</script>

<!-- Opens and closes from its heading, as As player and As Storyteller do. -->
<PageSection
	title={t('player.local.title')}
	collapsible
	storageKey="continue.players-only"
	count={games.length}
>
	{#if games.length === 0}
		<p class="none">{t('common.none')}</p>
	{:else}
		<ul class="games" data-testid="players-only-games">
			{#each games as game (key(game.visit))}
				<li>
					<ResumeGameRow
						name={game.script.name}
						logo={scriptLogo(game.script)}
						line={line(game.seats, game.dead)}
						when={lastSeen.format(game.visit.at)}
						onclick={() => void openPlayersOnly(game.script, game.source)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</PageSection>

<style>
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.games {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
