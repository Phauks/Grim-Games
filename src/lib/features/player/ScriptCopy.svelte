<script lang="ts">
	import type { TravellerInPlay } from './travellers-in-play.ts';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { playerJinxes, sheetCharacters } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';
	import LightSheetSwitch from './LightSheetSwitch.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { LIGHT_SHEET_STYLE } from '#lib/ui/themes/print.ts';

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
		/** False where the host's header has the light background switch (PlayerScriptActions). */
		lightSwitch?: boolean;
	}

	let {
		script,
		players,
		version,
		byline = true,
		inPlay,
		travellers,
		showBreakdown = true,
		lightSwitch = true
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

<!-- The light background switch sits at the top of every copy, unless its host's header has
     it, and in Settings > Player (Trevor, 2026-10-23). -->
<div
	class="copy"
	class:light={playerSettings.current.lightSheet}
	style={playerSettings.current.lightSheet ? LIGHT_SHEET_STYLE : undefined}
	data-testid="script-copy"
>
	{#if byline || lightSwitch}<div class="head">
			{#if byline && data}<ScriptByline author={script.meta.author} {version} />{/if}
			{#if lightSwitch}<span class="light-switch"><LightSheetSwitch /></span>{/if}
		</div>{/if}
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
	/* The colours themselves are LIGHT_SHEET (themes/print.ts), set on the element. */
	.light {
		background: var(--surface);
		color: var(--on-surface);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
