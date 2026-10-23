<script lang="ts">
	import type { TravellerInPlay } from './travellers-in-play.ts';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { playerJinxes, sheetCharacters } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The players' copy of a script: the /play Script tab, as one component. The Storyteller's
	 * board opens this same component, so what they see matches the players' copy exactly
	 * (Trevor, 2026-10-16).
	 */
	interface Props {
		script: LoadedScript;
		/** Seats at the table; highlights that column of the Players breakdown. */
		players?: number;
		/** The script's version, when its source has one (BotC Scripts). */
		version?: string;
		/** False where the page already shows the author and version (the /play header). */
		byline?: boolean;
		/** Characters on seats, in a game: Travellers and Jinxes start closed when none plays. */
		inPlay?: readonly string[];
		/** Travellers the town knows are in play, with their players (Trevor, 2026-10-19). */
		travellers?: readonly TravellerInPlay[];
		/** False leaves the Players breakdown out (New game's preview, beside its own table). */
		showBreakdown?: boolean;
	}

	let {
		script,
		players,
		version,
		byline = true,
		inPlay,
		travellers,
		showBreakdown = true
	}: Props = $props();

	$effect(() => {
		if (!officialData.current) void loadOfficialData();
	});
	const data = $derived(officialData.current);
	// A Traveller in play that the script doesn't list still shows, so its player is named.
	const characters = $derived.by(() => {
		if (!data) return [];
		const listed = sheetCharacters(script, data);
		const extra = (travellers ?? [])
			.map((p) => p.characterId)
			.filter((id, i, all) => all.indexOf(id) === i && !listed.some((c) => c.id === id))
			.flatMap((id) => data.byId.get(id) ?? []);
		return [...listed, ...extra];
	});
	const jinxes = $derived(data ? playerJinxes(script, data) : []);
</script>

<!-- The light background switch sits at the top of every copy, wherever it shows, and in
     Settings > Player (Trevor, 2026-10-23). -->
<div class="copy" class:light={playerSettings.current.lightSheet} data-testid="script-copy">
	<div class="head">
		{#if byline && data}<ScriptByline author={script.meta.author} {version} />{/if}
		<span class="light-switch">
			<Toggle
				label={t('player.lightSheet')}
				checked={playerSettings.current.lightSheet}
				onChange={(lightSheet) => playerSettings.update({ lightSheet })}
			/>
		</span>
	</div>
	{#if data}
		<ScriptSheet {characters} {jinxes} {players} {inPlay} {travellers} {showBreakdown} />
	{:else}
		<p class="muted">{t('player.loading')}</p>
	{/if}
</div>

<style>
	.copy {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		/* Padded either way, so turning the light background on moves nothing. */
		padding: var(--space-3);
		border-radius: var(--radius-md);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}
	.light-switch {
		margin-left: auto;
	}
	/* Dark ink on light paper whatever the theme, team colours darkened to stay readable. */
	.light {
		--surface: #fbf8f1;
		--surface-raised: #efe9dc;
		--surface-selected: #e2d9c6;
		--on-surface: #1b1b1b;
		--on-surface-muted: #555555;
		--heading: #1b1b1b;
		--border: rgb(0 0 0 / 0.18);
		--button-edge: #8a7a5c;
		--good: #1f5fa8;
		--evil: #a8231f;
		--traveller-text: #5c2f6e;
		--loric-text: #2e6b34;
		background: var(--surface);
		color: var(--on-surface);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
