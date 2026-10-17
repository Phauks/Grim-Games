<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		editionScript,
		OFFICIAL_EDITIONS,
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
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';
	import GameModeField from '#lib/features/modes/GameModeField.svelte';
	import { startHref, startInMode } from '#lib/features/modes/start.ts';
	import { NO_RESTRICTIONS, STANDARD } from '#lib/core/modes/index.ts';

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
	let players = $state(8);
	let starting = $state(false);
	let modeId = $state(STANDARD.id);
	let restrictions = $state(NO_RESTRICTIONS);

	async function loadChosen() {
		const data = await loadOfficialData();
		const choice = edition;
		const recent = choice.startsWith('recent:')
			? [...(quick ? [quick] : []), ...recentScripts.list].find(
					(s) => `recent:${s.scriptId}` === choice
				)
			: undefined;
		const loaded = recent ? reloadSavedScript(recent, data) : editionScript(choice, data);
		if (!loaded) throw new Error('the chosen script could not be loaded');
		return { data, loaded };
	}

	async function start() {
		starting = true;
		try {
			const { data, loaded } = await loadChosen();
			const open = await startInMode({
				modeId,
				restrictions,
				data,
				loaded,
				create: (script) => OpenGame.create(data, script, players)
			});
			await goto(startHref(modeId, open.game.gameId));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<section aria-labelledby="new-game">
	<h2 id="new-game">New game</h2>
	<ChoiceGroup
		label="Script"
		value={edition}
		options={scriptOptions}
		onChange={(v) => (edition = v)}
	/>
	<div class="players">
		<span class="label" id="players-label">Players</span>
		<IconButton
			icon="back"
			label="Fewer players"
			disabled={players <= MIN_PLAYERS}
			onclick={() => (players = Math.max(MIN_PLAYERS, players - 1))}
		/>
		<output aria-labelledby="players-label">{players}</output>
		<IconButton
			icon="forward"
			label="More players"
			disabled={players >= MAX_PLAYERS}
			onclick={() => (players = Math.min(MAX_PLAYERS, players + 1))}
		/>
	</div>
	<SetupTable {players} />
	<GameModeField
		bind:modeId
		bind:restrictions
		loadScriptCharacters={async () => (await loadChosen()).loaded.characters}
	/>
	<Button variant="accent" icon="grimoire" disabled={starting} onclick={start}>Start game</Button>
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	h2 {
		margin: 0;
		font-size: 1.3rem;
	}
	.players {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.label {
		flex: 1;
		font-family: var(--font-control);
	}
	output {
		min-width: 2ch;
		font: 600 1.3rem / 1 var(--font-control);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
</style>
