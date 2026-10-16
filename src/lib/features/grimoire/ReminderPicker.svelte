<script lang="ts">
	import type { Reminder, SeatId } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { recentReminders } from './device-notes.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import {
		parseReminderKey,
		reminderCopies,
		reminderCopiesLeft,
		reminderGroups,
		reminderKey
	} from './reminders.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** The seat's name, for the title. */
		title: string;
	}

	let { open = $bindable(), grimoire, seatId, title }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const groups = $derived(reminderGroups(grimoire.game, characters));
	// Each token can be placed once unless the game gives more copies; used-up ones stay in
	// place, disabled, so nothing moves.
	const left = $derived(reminderCopiesLeft(grimoire.game, characters));
	const usedUp = (reminder: Reminder) => (left.get(reminderKey(reminder)) ?? 1) <= 0;
	// Several copies of one token are shown one by one, or as one token with a count when the
	// Storyteller turns on "Stack duplicate reminders" (Trevor, 2026-10-16).
	const total = $derived(reminderCopies(grimoire.game, characters));
	const stack = $derived(preferences.current.assistance.stackReminders);
	/** The chips for one token: one per copy (the placed ones done), or one stacked chip. */
	function copies(reminder: Reminder): { done: boolean; count?: number; label?: string }[] {
		const key = reminderKey(reminder);
		const all = total.get(key) ?? 1;
		const free = Math.max(0, left.get(key) ?? 1);
		if (all <= 1) return [{ done: free === 0 }];
		if (stack) return [{ done: free === 0, count: free, label: `${reminder.label}, ${free} left` }];
		return Array.from({ length: all }, (_, i) => ({
			done: i >= free,
			label: `${reminder.label}, copy ${i + 1} of ${all}`
		}));
	}
	/** Only reminders the picker offers now, so a recent one never brings back one not in play. */
	const offered = $derived(
		new Set(
			groups.flatMap((g) =>
				g.labels.map((label) => reminderKey({ characterId: g.character.id, label }))
			)
		)
	);

	let recent = $state<Reminder[]>([]);
	$effect(() => {
		if (open)
			recent = recentReminders
				.read()
				.flatMap((key) => parseReminderKey(key) ?? [])
				.filter((r) => offered.has(reminderKey(r)));
	});

	/** Adds a reminder and keeps the picker open, so several can be added in a row. */
	function add(reminder: Reminder) {
		if (!seatId) return;
		if (grimoire.run({ type: 'AddReminder', seatId, reminder })) {
			recentReminders.remember(reminderKey(reminder));
		}
	}

	const placed = $derived(seatId ? (grimoire.game.seats[seatId]?.reminders.length ?? 0) : 0);
</script>

<Dialog bind:open title={`Reminders for ${title}`} size="full">
	<div class="head">
		<p class="count" aria-live="polite">On this seat: {placed}</p>
		<!-- A fixed-height row: recent reminders never move the list below. -->
		<div class="recent" role="group" aria-label="Recent reminders">
			{#each recent as reminder (reminderKey(reminder))}
				<button
					type="button"
					class="chip"
					disabled={usedUp(reminder)}
					onclick={() => add(reminder)}
				>
					<ReminderToken
						label={reminder.label}
						type={characters.get(reminder.characterId)?.type}
						done={usedUp(reminder)}
					/>
				</button>
			{:else}
				<span class="none">Recent: None</span>
			{/each}
		</div>
	</div>
	<ul class="list">
		{#each groups as group (group.character.id)}
			<li>
				<span class="who">
					<CharacterToken character={group.character} size={32} />
					<span class="name">{group.character.name}</span>
				</span>
				<span class="chips" role="group" aria-label={group.character.name}>
					{#each group.labels as label (label)}
						{@const reminder = { characterId: group.character.id, label }}
						{#each copies(reminder) as copy, i (i)}
							<button
								type="button"
								class="chip"
								aria-label={copy.label}
								disabled={copy.done}
								onclick={() => add(reminder)}
							>
								<ReminderToken {label} type={group.character.type} done={copy.done} />
								{#if copy.count !== undefined}<span class="count-badge" aria-hidden="true"
										>×{copy.count}</span
									>{/if}
							</button>
						{/each}
					{/each}
				</span>
			</li>
		{/each}
	</ul>
</Dialog>

<style>
	.chip:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.head {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.count {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.recent {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.none {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.list {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	.list li {
		display: grid;
		grid-template-columns: minmax(calc(8 * var(--u)), 35%) 1fr;
		align-items: center;
		gap: var(--space-2);
		padding: calc(0.125 * var(--u)) 0;
		border-bottom: 1px solid var(--border);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-family: var(--font-character);
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: var(--space-1) 0;
	}
	/* Big, easy targets (Trevor, 2026-10-16), following the Reminder size setting. */
	.chip {
		display: inline-grid;
		place-items: center;
		min-width: calc(3.25 * var(--u) * var(--reminder-scale, 1));
		min-height: calc(3.25 * var(--u) * var(--reminder-scale, 1));
		padding: 0 calc(0.125 * var(--u));
		border: 0;
		background: none;
		cursor: pointer;
	}
	.chip {
		position: relative;
	}
	.count-badge {
		position: absolute;
		top: 0;
		right: 0;
		min-width: 1.4em;
		padding: 0 calc(0.1875 * var(--u));
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 0.75rem / 1.4 var(--font-control);
		text-align: center;
	}
	.chip:hover {
		filter: brightness(1.15);
	}
	.chip > :global(.reminder) {
		padding: 0.45em 0.7em 0.45em 0.45em;
		font-size: calc(1rem * var(--reminder-scale, 1));
	}
	.recent {
		height: calc(3.25 * var(--u) * var(--reminder-scale, 1));
	}
</style>
