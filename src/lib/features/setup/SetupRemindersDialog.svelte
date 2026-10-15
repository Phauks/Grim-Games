<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game, Reminder, SeatId } from '#lib/core/model/index.ts';
	import { prepTextSegments, setupReminders, type SetupReminder } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { seatLabel } from './seat-label.ts';

	interface Props {
		open: boolean;
		game: Game;
		lookup: CharacterLookup;
		onPlace: (placements: { seatId: SeatId; reminder: Reminder }[]) => void;
	}

	let { open = $bindable(), game, lookup, onPlace }: Props = $props();

	const NONE = 'none';
	const suggestions = $derived(setupReminders(game, lookup));
	/** The seat each suggestion goes on, by index; `none` leaves it out. */
	let targets = $state<string[]>([]);
	$effect(() => {
		if (open) targets = suggestions.map((s) => s.seatId ?? NONE);
	});

	const typeOf = (id: CharacterId) => lookup.get(id)?.type;
	const placements = $derived(
		suggestions.flatMap((s, i) => {
			const seatId = targets[i];
			return seatId && seatId !== NONE
				? [{ seatId, reminder: { characterId: s.characterId, label: s.label } }]
				: [];
		})
	);

	function options(s: SetupReminder) {
		const seats = s.candidates.length > 0 ? s.candidates : s.seatId ? [s.seatId] : [];
		return [
			{ value: NONE, label: 'None' },
			...seats.map((id) => ({ value: id, label: seatLabel(game, id, lookup) }))
		];
	}
</script>

<!--
	The reminder tokens the first night needs, suggested from the characters now in the
	grimoire. The Storyteller can change any seat or leave a token out (None); placed tokens
	are ordinary reminders, so they can still be moved or removed on the grimoire.
-->
<Dialog bind:open title="Setup reminders" size="full">
	<div class="body" data-testid="setup-reminders">
		{#if suggestions.length}
			<ul>
				{#each suggestions as s, i (i)}
					<li>
						<div class="what">
							<CharacterBadge characterId={s.characterId} inline />
							<ReminderToken label={s.label} type={typeOf(s.characterId)} />
							<p class="text">
								{#each prepTextSegments(s.text) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
											label={part.label}
											type={typeOf(s.characterId)}
										/>{:else if part.kind === 'character'}<CharacterBadge
											characterId={part.id}
											inline
										/>{:else}{part.text}{/if}{/each}
							</p>
						</div>
						<Select
							label="Seat for {s.label}"
							hideLabel
							value={targets[i] ?? NONE}
							options={options(s)}
							onChange={(v) => (targets[i] = v)}
						/>
					</li>
				{/each}
			</ul>
		{:else}
			<p>None</p>
		{/if}
	</div>
	{#snippet actions()}
		<Button variant="accent" disabled={placements.length === 0} onclick={() => onPlace(placements)}
			>Place {placements.length}</Button
		>
	{/snippet}
</Dialog>

<style>
	.body {
		flex: 1;
		overflow-y: auto;
	}
	ul {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.what {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.text {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.9rem;
	}
</style>
