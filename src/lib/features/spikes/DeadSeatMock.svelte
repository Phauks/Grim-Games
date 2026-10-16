<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * Mock-ups of ways to mark a dead player on a seat (Trevor, 2026-10-16: the shroud can
	 * cover names, info and roles). Spike only: the chosen look goes into SeatDisc.
	 */
	export type DeadLook = 'current' | 'ring' | 'hood' | 'pill' | 'corner' | 'ring-pill';

	interface Props {
		look: DeadLook;
		character: Character;
		size: number;
		name: string;
		dead?: boolean;
		voteUsed?: boolean;
		showName?: boolean;
		reminders?: { label: string; character: Character }[];
	}

	let {
		look,
		character,
		size,
		name,
		dead = false,
		voteUsed = false,
		showName = false,
		reminders = []
	}: Props = $props();
</script>

<span class="seat" data-look={look} data-dead={dead || undefined} style:--size="{size}px">
	<span class="disc">
		{#if dead && look === 'hood'}<span class="hood"><Icon name="dead" /></span>{/if}
		<span class="face"><CharacterToken {character} {size} {showName} /></span>
		{#if dead && look === 'current'}<span class="shroud"><Icon name="dead" /></span>{/if}
		{#if dead && look === 'ring'}<span class="rim-skull"><Icon name="dead" /></span>{/if}
		{#if dead && look === 'corner'}<span class="corner-skull"><Icon name="dead" /></span>{/if}
		{#if dead && !voteUsed}<span class="vote"><Icon name="ghostVote" /></span>{/if}
		{#if reminders.length}
			<span class="reminders">
				{#each reminders as r (r.label)}
					<BoardReminder
						label={r.label}
						character={r.character}
						size={Math.round(size * 0.5)}
						onTap={() => {}}
					/>
				{/each}
			</span>
		{/if}
	</span>
	<span class="name"
		>{#if dead && (look === 'pill' || look === 'ring-pill')}<Icon name="dead" />{/if}<span
			class="text">{name}</span
		></span
	>
</span>

<style>
	.seat {
		--bone: oklch(0.93 0.02 85);
		--ink: oklch(0.16 0.01 60);
		position: relative;
		display: grid;
		justify-items: center;
		width: calc(var(--size) + 2 * var(--u));
		color: var(--on-surface);
	}
	.disc {
		position: relative;
		width: var(--size);
		height: var(--size);
	}
	.face {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		box-shadow: var(--shadow);
	}

	/* Today: grey and darken the token, a dark cap over its top 40%. */
	[data-look='current'][data-dead] .face {
		filter: grayscale(1) brightness(0.65);
	}
	.shroud {
		position: absolute;
		inset: 0;
		display: grid;
		justify-items: center;
		align-content: start;
		padding-top: 6%;
		border-radius: 50%;
		background: linear-gradient(to bottom, rgb(0 0 0 / 0.85) 40%, transparent 40%);
		--icon-size: calc(var(--size) * 0.26);
	}

	/* A: a black-and-bone ring round the rim, and a skull sitting on top of the rim. */
	[data-look='ring'][data-dead] .face,
	[data-look='ring-pill'][data-dead] .face {
		box-shadow:
			0 0 0 calc(var(--size) * 0.04) var(--ink),
			0 0 0 calc(var(--size) * 0.075) var(--bone),
			var(--shadow);
	}
	.rim-skull,
	.corner-skull {
		position: absolute;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--ink);
		color: var(--bone);
		border: 2px solid var(--bone);
		box-shadow: var(--shadow);
	}
	.rim-skull {
		top: calc(var(--size) * -0.24);
		left: 50%;
		translate: -50% 0;
		width: calc(var(--size) * 0.34);
		height: calc(var(--size) * 0.34);
		--icon-size: calc(var(--size) * 0.24);
	}

	/* B: the shroud moved outside the token, a dark hood over its upper rim. */
	.hood {
		position: absolute;
		left: 50%;
		top: calc(var(--size) * -0.2);
		translate: -50% 0;
		width: calc(var(--size) * 1.16);
		height: calc(var(--size) * 1.16);
		display: grid;
		justify-items: center;
		align-content: start;
		padding-top: calc(var(--size) * 0.015);
		border-radius: 50%;
		background: var(--ink);
		border: 2px solid var(--bone);
		color: var(--bone);
		clip-path: inset(0 0 52% 0);
		--icon-size: calc(var(--size) * 0.18);
	}

	/* D: one skull badge on the lower-left rim, half outside. */
	.corner-skull {
		left: -10%;
		bottom: -6%;
		width: calc(var(--size) * 0.38);
		height: calc(var(--size) * 0.38);
		--icon-size: calc(var(--size) * 0.26);
	}

	/* Ghost vote left: a small mark on the upper-left rim (as /play does today). */
	.vote {
		position: absolute;
		top: -6%;
		left: -6%;
		display: grid;
		place-items: center;
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
		--icon-size: calc(0.875 * var(--u));
	}
	[data-look='ring'] .vote,
	[data-look='hood'] .vote {
		top: 2%;
		left: -14%;
	}

	/* Reminders fan out on the table side (here: to the right). */
	.reminders {
		position: absolute;
		left: calc(100% + 0.5 * var(--u));
		top: 50%;
		translate: 0 -50%;
		display: flex;
		gap: calc(0.25 * var(--u));
	}

	/* The name in a neutral pill under the token (the agreed seat look). */
	.name {
		position: absolute;
		top: calc(100% + 0.25 * var(--u));
		left: 50%;
		translate: -50% 0;
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		max-width: calc(var(--size) * 2);
		padding: 0.1em 0.55em;
		border-radius: var(--radius-pill, 50vh);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		font-family: var(--font-player);
		font-size: 0.85rem;
		line-height: 1.2;
		white-space: nowrap;
		--icon-size: 1em;
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* C: the pill itself turns black with a skull. */
	[data-look='pill'][data-dead] .name,
	[data-look='ring-pill'][data-dead] .name {
		background: var(--ink);
		border-color: var(--bone);
		color: var(--bone);
	}
</style>
