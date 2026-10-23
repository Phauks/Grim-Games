<script lang="ts">
	import { untrack } from 'svelte';
	import type { ReminderPrompt } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import {
		deadOwner,
		freshAsks,
		type DeadAsk,
		type PromptAsk,
		type ReminderLook
	} from './reminder-ask.ts';
	import { tokenLabel } from './reminders.ts';

	/**
	 * Reminders that ask (Trevor, 2026-10-19). A reminder placed by any route (bank, sheet,
	 * drag) whose words change a player's state asks first: "Dead" or "Died Today" on a living
	 * player asks to mark them dead; "Alive" on a dead one asks to revive them. Which reminders
	 * ask is data (REMINDER_PROMPTS); each kind of question has its words and setting below.
	 * Moving one to another seat asks too. Reminders already where they were when the board
	 * opened never ask. Like the day's End day, each has its setting where it is used
	 * (Trevor, 2026-10-18).
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
	$effect(() => {
		const fresh = freshAsks(game, characters, look);
		look = fresh.look;
		if (grimoire.open.viewOnly) return;
		const assistance = untrack(() => preferences.current.assistance);
		const ask = fresh.asks.find(({ prompt }) => assistance[PROMPTS[prompt].setting]);
		if (assistance.deadReminderAsk && fresh.dead.length > 0) {
			deadAsk = fresh.dead[0];
			afterDeadAsk = ask;
			deadAskOpen = true;
			return;
		}
		if (!ask) return;
		promptAsk = ask;
		promptAskOpen = true;
	});

	function keepDeadReminder() {
		const next = afterDeadAsk;
		afterDeadAsk = undefined;
		if (!next) return;
		promptAsk = next;
		promptAskOpen = true;
	}

	function undoDeadReminder() {
		afterDeadAsk = undefined;
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
			{#if askedId}<CharacterBadge
					characterId={askedId}
					character={characters.get(askedId)}
					alignment={asked.alignment}
					playerName={name}
				/>{:else}{name}{/if}{ui.after}
		{/snippet}
		<SettingToggle
			label={ASSIST_LABELS[ui.setting].label}
			description={ASSIST_LABELS[ui.setting].description}
			checked={preferences.current.assistance[ui.setting]}
			onChange={(on) =>
				preferences.update({
					assistance: { ...preferences.current.assistance, [ui.setting]: on }
				})}
		/>
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
				alignment={placingAlignment(game, reminder, characters)}
			/>?
		{/snippet}
		<p class="dead-owner">
			<CharacterBadge
				characterId={reminder.characterId}
				character={characters.get(reminder.characterId)}
				alignment={owner?.alignment}
				playerName={ownerId
					? (owner?.playerName ?? `Seat ${game.seating.indexOf(ownerId) + 1}`)
					: undefined}
			/> is dead.
		</p>
		<SettingToggle
			label={ASSIST_LABELS.deadReminderAsk.label}
			description={ASSIST_LABELS.deadReminderAsk.description}
			checked={preferences.current.assistance.deadReminderAsk}
			onChange={(on) =>
				preferences.update({
					assistance: { ...preferences.current.assistance, deadReminderAsk: on }
				})}
		/>
	</ConfirmDialog>
{/if}
