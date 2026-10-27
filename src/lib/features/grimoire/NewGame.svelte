<script lang="ts">
	import { NEW_GAME_MAX_PLAYERS } from '#lib/features/setup/selection.svelte.ts';
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
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { takeVotePick } from '#lib/features/room/vote-pick.ts';
	import { openedByBack, readDraft, saveDraft } from '#lib/features/modes/new-game-draft.ts';
	import { readNextGame } from '#lib/features/game/next-game.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ProfileSelect from '#lib/features/settings/profiles/ProfileSelect.svelte';
	import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';

	interface Props {
		/** In a sheet over the board (Game info's New game): the seat count of the game it
		 *  replaces (next-game.ts). The layout, script preview included, is the same. */
		compact?: boolean;
	}
	let { compact = false }: Props = $props();

	/** New game (its own screen, Trevor 2026-10-16): script, player count and the count table. */
	onMount(() => {
		void restoreScripts();
		void loadOfficialData();
		// From a game, its seat count; Play on the Search page chooses that script.
		const carried = compact ? readNextGame()?.names.length : undefined;
		// Played from the room vote's screen (Trevor, 2026-10-26), over what Back put back.
		const voted = takeVotePick();
		if (voted?.subject === 'mode') modeId = voted.id;
		if (voted?.subject === 'rules') ruleIds = voted.ids;
		if (carried) players = carried;
		else if (voted?.subject === 'script') edition = voted.id;
		else if (quickPlayScript.takeRequest()) edition = `recent:${QUICK_PLAY_ID}`;
		// Back from the start flow puts New game back as it was (Trevor, 2026-10-23).
		else if (openedByBack()) {
			const draft = readDraft();
			if (draft.edition) edition = draft.edition as ScriptChoice;
			if (draft.players) players = draft.players;
		}
		// The room's phones see the Storyteller choosing the next script (plan R1).
		const host = roomHost();
		if (host.code) host.setChoosing(true);
		return () => {
			if (host.code) host.setChoosing(false);
		};
	});
	let modeId = $state(STANDARD.id);
	/** The special rules chosen; the room vote's own when it played them (Trevor, 2026-10-26). */
	let ruleIds = $state<string[]>([]);
	// ── New game ──
	/** An official edition, `recent:<scriptId>` or `profile:<id>` (script-choices.svelte.ts). */
	let edition = $state<ScriptChoice>('tb');
	let players = $state(8);
	let starting = $state(false);
	/** The settings profile the game starts with (plan S18): the default one first. */
	let profile = $state(settingsProfiles.defaultId);
	$effect(() => settingsProfiles.chooseForNextGame(profile));
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
		saveDraft({ edition, players });
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
				saveDraft({ gameId: open.game.gameId });
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
			saveDraft({ gameId: open.game.gameId });
			// Every start goes on to Character selection, a plain game too (Trevor, 2026-10-23).
			await goto(resolve('/grimoire/[gameId]/setup', { gameId: open.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}
</script>

<!-- The page's title is the route's (Page); this is its content. -->
<section>
	<!-- Above the modes so every kind of game starts with it; always shown (plan S18). -->
	<ProfileSelect showLabel value={profile} onChange={(id) => (profile = id)} />
	<!-- One screen: Standard or a game mode from one drop-down (Trevor, 2026-10-18). -->
	<GameModesPanel standardScript={edition} standardPlayers={players} bind:modeId bind:ruleIds>
		{#snippet standard(rules, begin)}
			<!-- The base three, then any other script by search (Trevor, 2026-10-19). -->
			<PageSection title="Script">
				{#snippet aside()}
					<!-- Opens this device's room if it has none, so the table can gather and vote
					     before any script is chosen (Trevor, 2026-10-23). -->
					<!-- The vote is its own screen (Trevor, 2026-10-26: "Not a popup"). -->
					<Button variant="quiet" icon="vote" href={resolve('/vote')}
						>{t('room.scriptVote.button')}</Button
					>
				{/snippet}
				<ScriptPicker label="Script" hideLabel value={edition} onChange={(v) => (edition = v)} />
			</PageSection>
			<!-- The same count and setup sheet as character selection (Trevor, 2026-10-17). -->
			<PlayerCountSheet
				{players}
				onChange={(n) => (players = n)}
				max={NEW_GAME_MAX_PLAYERS}
				{maxPlayers}
			/>
			<Button
				variant="accent"
				icon="grimoire"
				disabled={starting}
				onclick={() => begin(() => start(rules))}>Start game</Button
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
