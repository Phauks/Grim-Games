<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { playerJinxes, sheetCharacters } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';

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
	}

	let { script, players, version, byline = true, inPlay }: Props = $props();

	$effect(() => {
		if (!officialData.current) void loadOfficialData();
	});
	const data = $derived(officialData.current);
	const characters = $derived(data ? sheetCharacters(script, data) : []);
	const jinxes = $derived(data ? playerJinxes(script, data) : []);
</script>

{#if data}
	{#if byline}<ScriptByline author={script.meta.author} {version} />{/if}
	<ScriptSheet {characters} {jinxes} {players} {inPlay} />
{:else}
	<p class="muted">{t('player.loading')}</p>
{/if}

<style>
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
