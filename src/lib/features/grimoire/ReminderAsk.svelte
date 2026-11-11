<script lang="ts">
	import { untrack } from 'svelte';
	import type { ReminderPrompt } from '#lib/core/data/parts/reminder-prompts.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import AidMenu from '#lib/features/settings/AidMenu.svelte';
	import type { AssistKey } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { reminderPlacing } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import {
		deadOwner,
		freshAsks,
		type DeadAsk,
		type FlowAsk,
		type PromptAsk,
		type ReminderLook
	} from './reminder-ask.ts';
	import { tokenLabel } from './reminders.ts';

	/**
	 * Reminders that ask (Trevor, 2026-10-19). A reminder placed by any route (bank, sheet,
	 * drag) whose words change a player's state asks first: "Dead" or "Died Today" on a living
	 * player asks to mark them dead; "Alive" on a dead one asks to revive them. Which reminders
	 * ask is data (REMINDER_PROMPTS); each kind of question has its words and setting below.
	 * Moving one to another seat asks too. A token that takes the place of an earlier one in its
	 * character's flow asks to take that one off (Trevor, 2026-11-06: "placing has should
	 * request taking mad off"). Reminders already where they were when the board
	 * opened never ask. Each one's switch is only in Settings; its ⋯ opens it there (Trevor,
	 * 2026-10-30).
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	const PROMPTS: Record<
		ReminderPrompt,
		{ title: string; verb: string; after: string; setting: AssistKey; dead: boolean }
	> = {
		markDead: {
			title: 'Mark dead?',
			verb: 'Mark',
			after: ' dead?',
			setting: 'deathReminderAsk',
			dead: true
		},
		revive: {
			title: 'Revive?',
			verb: 'Revive',
			after: '?',
			setting: 'reviveReminderAsk',
			dead: false
		}
	};

	/** Each reminder on a seat at the last look, so only new ones ask and a cancelled move goes back. */
	let look: ReminderLook | undefined;
	let promptAsk = $state<PromptAsk>();
	let promptAskOpen = $state(false);
	/**
	 * A reminder of a character whose player is dead asks first (Trevor, 2026-10-20); Cancel
	 * takes it back off, or back where it was moved from. Any other question waits for it.
	 */
	let deadAsk = $state<DeadAsk>();
	let deadAskOpen = $state(false);
	let afterDeadAsk: PromptAsk | undefined;
	/** A token that follows an earlier one on the same player asks to take that one off. */
	let flowAsk = $state<FlowAsk>();
	let flowAskOpen = $state(false);
	let afterFlowAsk: PromptAsk | undefined;
	$effect(() => {
		const fresh = freshAsks(game, characters, look);
		look = fresh.look;
		if (grimoire.open.viewOnly) return;
		const assistance = untrack(() => preferences.current.assistance);
		const ask = fresh.asks.find(({ prompt }) => assistance[PROMPTS[prompt].setting]);
		const flow = assistance.flowReminderAsk ? fresh.flow[0] : undefined;
		if (assistance.deadReminderAsk && fresh.dead.length > 0) {
			deadAsk = fresh.dead[0];
			afterDeadAsk = ask;
			pendingFlow = flow;
			deadAskOpen = true;
			return;
		}
		showFlow(flow, ask);
	});

	/** The flow question first, if any, then the state question. */
	let pendingFlow: FlowAsk | undefined;
	function showFlow(flow: FlowAsk | undefined, ask: PromptAsk | undefined) {
		if (flow) {
			flowAsk = flow;
			afterFlowAsk = ask;
			flowAskOpen = true;
			return;
		}
		if (!ask) return;
		promptAsk = ask;
		promptAskOpen = true;
	}

	function keepDeadReminder() {
		const next = afterDeadAsk;
		const flow = pendingFlow;
		afterDeadAsk = undefined;
		pendingFlow = undefined;
		showFlow(flow, next);
	}

	function afterFlow(takeOff: boolean) {
		if (takeOff && flowAsk)
			for (const r of flowAsk.earlier)
				grimoire.run({ type: 'RemoveReminder', reminderId: r.reminderId });
		const next = afterFlowAsk;
		afterFlowAsk = undefined;
		showFlow(undefined, next);
	}

	function undoDeadReminder() {
		afterDeadAsk = undefined;
		pendingFlow = undefined;
		if (!deadAsk) return;
		const { reminder, from } = deadAsk;
		if (from) {
			// Back where it was is not a new placing: it doesn't ask again.
			look?.seen.add(`${reminder.reminderId}@${from}`);
			grimoire.run({ type: 'MoveReminder', reminderId: reminder.reminderId, toSeatId: from });
		} else grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId });
	}
</script>

{#if promptAsk && game.seats[promptAsk.seatId]}
	{@const { seatId, prompt } = promptAsk}
	{@const ui = PROMPTS[prompt]}
	{@const asked = game.seats[seatId]}
	{@const askedId = asked.characterId}
	{@const name = asked.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`}
	<ConfirmDialog
		bind:open={promptAskOpen}
		title={ui.title}
		onConfirm={() =>
			grimoire.run({
				type: 'SetDead',
				seatId,
				dead: ui.dead,
				...(ui.dead && promptAsk?.cause ? { cause: promptAsk.cause } : {})
			})}
	>
		{#snippet heading()}
			{ui.verb}
			{#if askedId}<CharacterPiece
					template="badge"
					characterId={askedId}
					character={characters.get(askedId)}
					alignment={asked.alignment}
					playerName={name}
				/>{:else}{name}{/if}{ui.after}
		{/snippet}
		{#snippet headActions()}<AidMenu aid={ui.setting} />{/snippet}
	</ConfirmDialog>
{/if}

{#if flowAsk}
	{@const earlier = flowAsk.earlier[0]}
	<ConfirmDialog
		bind:open={flowAskOpen}
		title="Take token off?"
		onConfirm={() => afterFlow(true)}
		onCancel={() => afterFlow(false)}
	>
		{#snippet heading()}
			Take <ReminderToken
				label={tokenLabel(earlier)}
				character={characters.get(earlier.characterId)}
				{...reminderPlacing(game, earlier, characters)}
			/> off?
		{/snippet}
		{#snippet headActions()}<AidMenu aid="flowReminderAsk" />{/snippet}
	</ConfirmDialog>
{/if}

{#if deadAsk}
	{@const { reminder } = deadAsk}
	{@const ownerId = deadOwner(game, reminder)}
	{@const owner = ownerId ? game.seats[ownerId] : undefined}
	<ConfirmDialog
		bind:open={deadAskOpen}
		title="Place reminder?"
		onConfirm={keepDeadReminder}
		onCancel={undoDeadReminder}
	>
		{#snippet heading()}
			Place <ReminderToken
				label={tokenLabel(reminder)}
				character={characters.get(reminder.characterId)}
				{...reminderPlacing(game, reminder, characters)}
			/>?
		{/snippet}
		<p class="dead-owner">
			<CharacterPiece
				template="badge"
				characterId={reminder.characterId}
				character={characters.get(reminder.characterId)}
				alignment={owner?.alignment}
				playerName={ownerId
					? (owner?.playerName ?? `Seat ${game.seating.indexOf(ownerId) + 1}`)
					: undefined}
			/> is dead.
		</p>
		{#snippet headActions()}<AidMenu aid="deadReminderAsk" />{/snippet}
	</ConfirmDialog>
{/if}
