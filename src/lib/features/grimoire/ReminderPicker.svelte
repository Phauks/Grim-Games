<script lang="ts">
	import type { Reminder, SeatId } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { recentReminders } from './device-notes.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { parseReminderKey, reminderGroups, reminderKey } from './reminders.ts';

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
				<button type="button" class="chip" onclick={() => add(reminder)}>
					<ReminderToken label={reminder.label} type={characters.get(reminder.characterId)?.type} />
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
						<button
							type="button"
							class="chip"
							onclick={() => add({ characterId: group.character.id, label })}
						>
							<ReminderToken {label} type={group.character.type} />
						</button>
					{/each}
				</span>
			</li>
		{/each}
	</ul>
</Dialog>

<style>
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
		padding: 2px 0;
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
		gap: 2px;
	}
	.chip {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0 2px;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.chip:hover {
		filter: brightness(1.15);
	}
</style>
