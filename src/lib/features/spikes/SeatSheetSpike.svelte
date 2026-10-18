<script lang="ts">
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import SeatToken from './SeatToken.svelte';

	// Spike (06-visuals-and-ui-kit.md §3): placeholder seats, UI-only state, no game rules.
	interface SpikeSeat {
		name: string;
		dead: boolean;
		ghostVote: boolean;
		reminders: IconSlot[];
	}

	const names = ['Alex', 'Sam', 'Jo', 'Riley', 'Morgan', 'Casey', 'Drew'];
	let seats = $state<SpikeSeat[]>(
		names.map((name) => ({ name, dead: false, ghostVote: true, reminders: [] }))
	);
	let selected = $state<number | null>(null);
	let open = $state(false);
	let snap = $state<string>('');

	const seat = $derived(selected === null ? null : seats[selected]);
	const reminderChoices: IconSlot[] = ['poisoned', 'drunk', 'protected', 'demon', 'notes', 'bag'];

	function position(index: number): string {
		const angle = (index / seats.length) * 2 * Math.PI - Math.PI / 2;
		return `left: ${50 + 40 * Math.cos(angle)}%; top: ${50 + 40 * Math.sin(angle)}%`;
	}

	function select(index: number) {
		selected = index;
		open = true;
	}
</script>

<main>
	<h1>Seat sheet spike</h1>
	<p class="hint">Tap a seat. Drag the sheet up to expand, down to dismiss.</p>

	<div class="ring">
		{#each seats as s, index (s.name)}
			<div class="slot" style={position(index)}>
				<SeatToken
					name={s.name}
					dead={s.dead}
					reminders={s.reminders.length}
					onTap={() => select(index)}
				/>
			</div>
		{/each}
	</div>
	<p class="status" data-testid="snap">Sheet: {open ? `open at ${snap || '?'}` : 'closed'}</p>
</main>

<BottomSheet
	bind:open
	title={seat?.name ?? ''}
	description={seat ? (seat.dead ? 'Dead' : 'Alive') : undefined}
	snapPoints={[0.5, 1]}
	initialSnapPoint={0.5}
	height="85dvh"
	onSnap={(point) => (snap = String(point))}
>
	{#if seat}
		<div class="actions">
			<button class="action" aria-pressed={seat.dead} onclick={() => (seat.dead = !seat.dead)}>
				<Icon name="dead" />
				{seat.dead ? 'Revive' : 'Shroud'}
			</button>
			<button
				class="action"
				aria-pressed={!seat.ghostVote}
				disabled={!seat.dead}
				onclick={() => (seat.ghostVote = !seat.ghostVote)}
			>
				<Icon name="ghostVote" />
				{seat.ghostVote ? 'Ghost vote' : 'Vote used'}
			</button>
		</div>

		<h3>Add reminder</h3>
		<div class="reminders">
			{#each reminderChoices as reminder (reminder)}
				<button class="reminder" onclick={() => seat.reminders.push(reminder)}>
					<span class="disc"><Icon name={reminder} /></span>
					{reminder}
				</button>
			{/each}
		</div>

		<h3>On this seat</h3>
		{#if seat.reminders.length === 0}
			<p class="empty">No reminders yet.</p>
		{:else}
			<ul class="placed">
				{#each seat.reminders as reminder, index (index)}
					<li>
						<button class="reminder" onclick={() => seat.reminders.splice(index, 1)}>
							<span class="disc"><Icon name={reminder} /></span>
							Remove {reminder}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</BottomSheet>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	.hint,
	.status {
		color: var(--on-surface-muted);
	}
	.ring {
		position: relative;
		width: min(100%, 60dvh);
		aspect-ratio: 1;
		margin: var(--space-4) auto;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px var(--border);
		/* The grimoire surface handles its own gestures (04-architecture.md §5). */
		touch-action: manipulation;
	}
	.slot {
		position: absolute;
		translate: -50% -50%;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: var(--button-radius);
		background: var(--button-background);
		color: var(--button-color);
		font: var(--button-font);
	}
	.action[aria-pressed='true'] {
		background: var(--accent);
		color: var(--on-accent);
	}
	.action:disabled {
		opacity: 0.5;
	}
	h3 {
		margin: var(--space-5) 0 var(--space-2);
		font-size: 1rem;
		color: inherit;
	}
	.reminders,
	.placed {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(8.5 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminder {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--on-surface-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font-family: var(--font-control);
		text-transform: capitalize;
	}
	.disc {
		display: grid;
		place-items: center;
		width: calc(2.25 * var(--u));
		height: calc(2.25 * var(--u));
		border-radius: 50%;
		background: var(--reminder-face);
		color: var(--on-reminder);
	}
	.empty {
		color: var(--on-surface-muted);
	}
</style>
