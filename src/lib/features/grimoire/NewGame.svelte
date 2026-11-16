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
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { scriptMaxPlayers } from '#lib/core/rules/setup/teensyville.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { storytellerName } from '#lib/features/game/storyteller-name.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import GameModesPanel from '#lib/features/modes/GameModesPanel.svelte';
	import { setupHref, startInMode } from '#lib/features/modes/start.ts';
	import { NO_RESTRICTIONS, STANDARD, type SpecialRule } from '#lib/core/modes/index.ts';
	import ScriptPicker from '#lib/features/modes/ScriptPicker.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import {
		loadScriptChoice,
		scriptChoiceSource,
		type ScriptChoice
	} from '#lib/features/modes/script-choices.svelte.ts';
	import { openPlayersOnly } from '#lib/features/player/open-players-only.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { holdChoosing } from '#lib/features/room/choosing.ts';
	import { takeVotePick, type VotePick } from '#lib/features/room/vote-pick.ts';
	import { openedByBack, readDraft, saveDraft } from '#lib/features/modes/new-game-draft.ts';
	import { readNextGame } from '#lib/features/game/next-game.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props {
		/** In a sheet over the board (Game info's New game): the seat count of the game it
		 *  replaces (next-game.ts). The layout, script preview included, is the same. */
		compact?: boolean;
		/**
		 * Room vote in a sheet over the board, so running it never leaves the game screen
		 * (Trevor, 2026-11-01); without it, Room vote is its own screen, /vote.
		 */
		onRoomVote?: () => void;
	}
	let { compact = false, onRoomVote }: Props = $props();

	/** What the Storyteller played from the room vote, over what New game showed. */
	/** Whether the vote played a script, which New game keeps over its draft. */
	function votedScript(voted: VotePick | undefined): boolean {
		return voted?.subject === 'script' || (voted?.subject === 'choice' && !!voted.script);
	}

	export function applyVote(voted: VotePick | undefined): void {
		if (voted?.subject === 'mode') modeId = voted.id;
		if (voted?.subject === 'rules') ruleIds = voted.ids;
		if (voted?.subject === 'script') edition = voted.id;
		if (voted?.subject === 'choice') {
			if (voted.script) edition = voted.script as ScriptChoice;
			if (voted.mode) modeId = voted.mode;
			if (voted.rules.length) ruleIds = voted.rules;
		}
	}

	/**
	 * New game (its own screen, Trevor 2026-10-16): the script. The player count is Character
	 * selection's, beside the bag (Trevor, 2026-10-28: on both it was duplicative).
	 */
	onMount(() => {
		void restoreScripts();
		void loadOfficialData();
		// From a game, its seat count; Play on the Search page chooses that script.
		const carried = compact ? readNextGame()?.names.length : undefined;
		// Played from the room vote's screen (Trevor, 2026-10-26), over what Back put back.
		const voted = takeVotePick();
		applyVote(voted);
		if (carried) players = carried;
		// A script the vote played, even over a carried game (seat count only), is kept.
		else if (!votedScript(voted)) {
			if (quickPlayScript.takeRequest()) edition = `recent:${QUICK_PLAY_ID}`;
			// Back from the start flow puts New game back as it was (Trevor, 2026-10-23).
			else if (openedByBack()) {
				const draft = readDraft();
				if (draft.edition) edition = draft.edition as ScriptChoice;
				if (draft.players) players = draft.players;
			}
		}
		// The room's phones see the Storyteller choosing the next script (plan R1).
		return holdChoosing();
	});
	let modeId = $state(STANDARD.id);
	/** The special rules chosen; the room vote's own when it played them (Trevor, 2026-10-26). */
	let ruleIds = $state<string[]>([]);
	// ── New game ──
	/** An official edition, `recent:<scriptId>` or `profile:<id>` (script-choices.svelte.ts). */
	let edition = $state<ScriptChoice>('tb');
	/** The seats the game starts with: the game it replaces, or 8 until Character selection. */
	let players = $state<number | undefined>();
	let starting = $state(false);
	/**
	 * Who runs the game, above Game mode (Trevor, 2026-11-06). Local Grim is a game with no
	 * Storyteller in the app (plan M55): the script opens on the player screen's Grim tab,
	 * where each phone keeps its own town. The screen is the same for both ("There is no
	 * difference between setup for a storyteller or player on the first screen"); only where
	 * Create game goes changes.
	 */
	let host = $state<'storyteller' | 'local'>('storyteller');
	/** Each choice with the line that says when to use it, under Host and in its list. */
	const hostOptions = $derived([
		{
			value: 'storyteller' as const,
			label: t('player.local.storyteller'),
			description: t('player.local.storytellerHint')
		},
		{
			value: 'local' as const,
			label: t('player.local.localGrim'),
			description: t('player.local.localGrimHint')
		}
	]);

	async function startPlayersOnly(choice: ScriptChoice = edition) {
		starting = true;
		saveDraft({ edition, players });
		try {
			const loaded = loadScriptChoice(choice, await loadOfficialData());
			await openPlayersOnly(loaded, scriptChoiceSource(choice), { fresh: true });
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			starting = false;
		}
	}

	async function start(rules: readonly SpecialRule[]) {
		starting = true;
		saveDraft({ edition, players });
		try {
			const data = await loadOfficialData();
			const loaded = loadScriptChoice(edition, data);
			// The default 8, or fewer for a script made for fewer (Teensyville: 6).
			const count = players ?? Math.min(8, scriptMaxPlayers(loaded.characters) ?? 8);
			const storyteller = storytellerName.current;
			if (rules.length) {
				// Special rules on a Standard game: kept beside the game, as a mode's are.
				const open = await startInMode({
					modeId: STANDARD.id,
					rules,
					restrictions: NO_RESTRICTIONS,
					data,
					loaded,
					create: (s) => OpenGame.create(data, s, count, undefined, undefined, storyteller)
				});
				saveDraft({ gameId: open.game.gameId });
				await goto(setupHref(open.game.gameId));
				return;
			}
			const open = await OpenGame.create(
				data,
				toScript(loaded),
				count,
				undefined,
				undefined,
				storyteller
			);
			saveDraft({ gameId: open.game.gameId });
			// On to Character selection, where Game settings opens (Trevor, 2026-10-29).
			await goto(setupHref(open.game.gameId));
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
	<GameModesPanel
		standardScript={edition}
		standardPlayers={players ?? 8}
		bind:modeId
		bind:ruleIds
		local={host === 'local' ? (choice) => void startPlayersOnly(choice) : undefined}
	>
		{#snippet top()}
			<!-- Not over a game's board: that sheet starts the Storyteller's next game. A
			     drop-down, as Game mode under it (Trevor, 2026-10-18: "a dropdown, not buttons"),
			     in the settings' column (Trevor, 2026-11-06). -->
			{#if !compact}<PageSection title={t('player.local.host')}>
					<Select
						label={t('player.local.host')}
						hideLabel
						value={host}
						options={hostOptions}
						onChange={(v) => (host = v)}
					/>
					<!-- When to use each (Trevor, 2026-11-06, wording A picked 2026-11-08); its two
					     lines are kept, so nothing below moves when the choice changes. -->
					<p class="host-hint" data-testid="host-hint">
						{hostOptions.find((o) => o.value === host)?.description}
					</p>
				</PageSection>{/if}
		{/snippet}
		{#snippet standard(rules, begin)}
			<!-- The base three, then any other script by search (Trevor, 2026-10-19). -->
			<PageSection title="Script">
				{#snippet aside()}
					<!-- Opens this device's room if it has none, so the table can gather and vote
					     before any script is chosen (Trevor, 2026-10-23). -->
					<!-- The vote is its own screen (Trevor, 2026-10-26: "Not a popup"). -->
					<Button
						variant="quiet"
						icon="vote"
						href={onRoomVote ? undefined : resolve('/vote')}
						onclick={onRoomVote}>{t('room.scriptVote.button')}</Button
					>
				{/snippet}
				<ScriptPicker label="Script" hideLabel value={edition} onChange={(v) => (edition = v)} />
			</PageSection>
			<Button
				variant="accent"
				icon="grimoire"
				disabled={starting}
				onclick={() => (host === 'local' ? void startPlayersOnly() : begin(() => start(rules)))}
				>{t('modes.start')}</Button
			>
		{/snippet}
	</GameModesPanel>
</section>

<style>
	.host-hint {
		margin: var(--space-1) 0 0;
		min-height: 2lh;
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	section {
		display: grid;
		gap: var(--space-3);
	}
</style>
