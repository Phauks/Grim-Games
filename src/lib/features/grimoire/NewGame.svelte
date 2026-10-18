<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		editionScript,
		OFFICIAL_EDITIONS,
		toScript,
		type OfficialEditionId
	} from '#lib/core/data/index.ts';
	import { MAX_PLAYERS, MIN_PLAYERS } from '#lib/core/engine/index.ts';
	import {
		QUICK_PLAY_ID,
		quickPlayScript,
		recentScripts,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import GameModesPanel from '#lib/features/modes/GameModesPanel.svelte';
	import { scriptChoices } from '#lib/features/modes/script-choices.svelte.ts';
	import ScriptChoiceLabel from '#lib/features/scripts/ScriptChoiceLabel.svelte';

	/** New game (its own screen, Trevor 2026-10-16): script, player count and the count table. */
	onMount(() => {
		void restoreScripts();
		// Play on the Search page opens New game with that script chosen.
		if (quickPlayScript.takeRequest()) edition = `recent:${QUICK_PLAY_ID}`;
	});
	// ── New game ──
	/** An official edition, or `recent:<scriptId>` for a script from the Scripts page. */
	type ScriptChoice = OfficialEditionId | `recent:${string}`;
	let edition = $state<ScriptChoice>('tb');
	/**
	 * The editions, the script last played from the Scripts page without saving it, then up
	 * to three recent custom scripts, most recently used first.
	 */
	const quick = $derived(quickPlayScript.saved);
	const scriptOptions = $derived([
		...OFFICIAL_EDITIONS.map((e) => ({ value: e.id as ScriptChoice, label: e.name })),
		...(quick ? [{ value: `recent:${QUICK_PLAY_ID}` as ScriptChoice, label: quick.name }] : []),
		...recentScripts.list
			.filter((s) => !s.edition)
			.slice(0, 3)
			.map((s) => ({ value: `recent:${s.scriptId}` as ScriptChoice, label: s.name }))
	]);
	const byChoice = $derived(scriptChoices());
	let players = $state(8);
	let starting = $state(false);

	async function start() {
		starting = true;
		try {
			const data = await loadOfficialData();
			const choice = edition;
			const recent = choice.startsWith('recent:')
				? [...(quick ? [quick] : []), ...recentScripts.list].find(
						(s) => `recent:${s.scriptId}` === choice
					)
				: undefined;
			const loaded = recent ? reloadSavedScript(recent, data) : editionScript(choice, data);
			if (!loaded) throw new Error('the chosen script could not be loaded');
			const open = await OpenGame.create(data, toScript(loaded), players);
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
		{#snippet standard()}
			<ChoiceGroup
				label="Script"
				value={edition}
				options={scriptOptions}
				onChange={(v) => (edition = v)}
			>
				<!-- Author and version under the name (Trevor, 2026-10-18; Alternative game modes). -->
				{#snippet item(option)}
					{@const c = byChoice.find((x) => x.value === option.value)}
					<ScriptChoiceLabel label={option.label} author={c?.author} version={c?.version} />
				{/snippet}
			</ChoiceGroup>
			<!-- The same count and setup sheet as character selection (Trevor, 2026-10-17). -->
			<PlayerCountSheet
				{players}
				min={MIN_PLAYERS}
				max={MAX_PLAYERS}
				onChange={(n) => (players = n)}
			/>
			<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}
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
