<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toScript } from '#lib/core/data/index.ts';
	import {
		QUICK_PLAY_ID,
		quickPlayScript,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { scriptMaxPlayers } from '#lib/core/rules/index.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { storytellerName } from '#lib/features/game/storyteller-name.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import GameModesPanel from '#lib/features/modes/GameModesPanel.svelte';
	import { startHref, startInMode } from '#lib/features/modes/start.ts';
	import { NO_RESTRICTIONS, STANDARD, type SpecialRule } from '#lib/core/modes/index.ts';
	import ScriptPicker from '#lib/features/modes/ScriptPicker.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import {
		loadScriptChoice,
		type ScriptChoice
	} from '#lib/features/modes/script-choices.svelte.ts';

	/** New game (its own screen, Trevor 2026-10-16): script, player count and the count table. */
	onMount(() => {
		void restoreScripts();
		void loadOfficialData();
		// Play on the Search page opens New game with that script chosen.
		if (quickPlayScript.takeRequest()) edition = `recent:${QUICK_PLAY_ID}`;
	});
	// ── New game ──
	/** An official edition, `recent:<scriptId>` or `profile:<id>` (script-choices.svelte.ts). */
	let edition = $state<ScriptChoice>('tb');
	let players = $state(8);
	let starting = $state(false);
	/** Teensyville scripts grey out counts above 6 (Trevor, 2026-10-19). */
	const maxPlayers = $derived.by(() => {
		const data = officialData.current;
		if (!data) return undefined;
		try {
			return scriptMaxPlayers(loadScriptChoice(edition, data).characters);
		} catch {
			return undefined;
		}
	});

	async function start(rules: readonly SpecialRule[]) {
		starting = true;
		try {
			const data = await loadOfficialData();
			const loaded = loadScriptChoice(edition, data);
			const storyteller = storytellerName.current;
			if (rules.length) {
				// Special rules on a Standard game: kept beside the game, as a mode's are.
				const open = await startInMode({
					modeId: STANDARD.id,
					rules,
					restrictions: NO_RESTRICTIONS,
					data,
					loaded,
					create: (s) => OpenGame.create(data, s, players, undefined, undefined, storyteller)
				});
				await goto(startHref(STANDARD.id, rules, open.game.gameId));
				return;
			}
			const open = await OpenGame.create(
				data,
				toScript(loaded),
				players,
				undefined,
				undefined,
				storyteller
			);
			await goto(resolve('/grimoire/[gameId]', { gameId: open.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<!-- The page's title is the route's (Page); this is its content. -->
<section>
	<!-- One screen: Standard or a game mode from one drop-down (Trevor, 2026-10-18). -->
	<GameModesPanel>
		{#snippet standard(rules)}
			<!-- The base three, then any other script by search (Trevor, 2026-10-19). -->
			<PageSection title="Script">
				<ScriptPicker label="Script" hideLabel value={edition} onChange={(v) => (edition = v)} />
			</PageSection>
			<!-- The same count and setup sheet as character selection (Trevor, 2026-10-17). -->
			<PlayerCountSheet {players} onChange={(n) => (players = n)} {maxPlayers} />
			<Button variant="accent" icon="grimoire" disabled={starting} onclick={() => start(rules)}
				>Start game</Button
			>
		{/snippet}
	</GameModesPanel>
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
</style>
