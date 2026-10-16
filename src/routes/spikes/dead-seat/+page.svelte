<script lang="ts">
	import { onMount } from 'svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import DeadSeatMock, { type DeadLook } from '#lib/features/spikes/DeadSeatMock.svelte';
	import { PRESETS } from '#lib/features/grimoire/backgrounds.ts';

	onMount(() => void loadOfficialData());

	const only =
		typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('only');
	const all: { look: DeadLook; title: string }[] = [
		{ look: 'current', title: 'Today: shroud over the token' },
		{ look: 'ring', title: 'A · Mourning ring + skull on the rim' },
		{ look: 'hood', title: 'B · Shroud as a hood outside the token' },
		{ look: 'pill', title: 'C · Black name pill with skull' },
		{ look: 'corner', title: 'D · Skull badge on the lower rim' },
		{ look: 'ring-pill', title: 'E · Ring + black name pill' },
		{ look: 'dim-corner', title: 'F · Dimmed token + skull badge' }
	];
	const looks = only ? all.filter((l) => only.split(',').includes(l.look)) : all;

	const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
	const size = Number(params.get('size') ?? 56);
	const bg = (params.get('bg') ?? 'wood') as keyof typeof PRESETS;
	const by = (id: string) => officialData.current?.byId.get(id as never);
</script>

<main style:background={PRESETS[bg].css}>
	{#if officialData.current}
		{@const empath = by('empath')!}
		{@const poisoner = by('poisoner')!}
		{@const fortune = by('fortuneteller')!}
		{#each looks as l (l.look)}
			<section>
				<h2>{l.title}</h2>
				<div class="row">
					<div class="cell">
						<DeadSeatMock look={l.look} character={empath} {size} name="Sam" />
						<small>Alive</small>
					</div>
					<div class="cell">
						<DeadSeatMock look={l.look} character={empath} {size} name="Sam" dead />
						<small>Dead, vote left</small>
					</div>
					<div class="cell">
						<DeadSeatMock look={l.look} character={empath} {size} name="Sam" dead voteUsed />
						<small>Vote used</small>
					</div>
					<div class="cell wide">
						<DeadSeatMock
							look={l.look}
							character={fortune}
							{size}
							name="Bartholomew-Jones"
							dead
							showName
							reminders={[
								{ label: 'Poisoned', character: poisoner },
								{ label: 'Red herring', character: fortune }
							]}
						/>
						<small>Name on token, reminders, long name</small>
					</div>
				</div>
			</section>
		{/each}
	{/if}
</main>

<style>
	main {
		min-height: 100dvh;
		padding: calc(0.75 * var(--u));
		display: grid;
		gap: calc(0.5 * var(--u));
		align-content: start;
	}
	h2 {
		margin: 0 0 calc(0.75 * var(--u));
		font: 600 0.9rem / 1.2 var(--font-control);
		color: oklch(0.97 0 0);
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.9);
	}
	section {
		padding-bottom: calc(1.25 * var(--u));
		border-bottom: 1px solid rgb(255 255 255 / 0.15);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: calc(1.25 * var(--u)) calc(1 * var(--u));
		align-items: start;
		padding-top: calc(0.5 * var(--u));
	}
	.cell {
		display: grid;
		justify-items: center;
		gap: calc(2.25 * var(--u));
	}
	.cell.wide {
		justify-items: start;
	}
	small {
		font: 0.7rem / 1.2 var(--font-control);
		color: oklch(0.97 0 0);
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.9);
	}
</style>
