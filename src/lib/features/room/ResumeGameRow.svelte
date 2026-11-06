<script lang="ts">
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';

	/**
	 * One game to go back to on Join game: its script with two lines under it, the whole row one
	 * tap target. As player's rooms, the Players only towns (plan M55), the menu's last game and
	 * the leave dialog all use it, so a game looks the same wherever it is named. With neither
	 * `href` nor `onclick` it is the card alone (the leave dialog's).
	 */
	interface Props {
		name: string | undefined;
		logo?: string;
		/** Shown when there is no script name yet. */
		empty?: string;
		/** What it is (a room's code and Storyteller, or a town's seats). */
		line: string;
		/** When this device last opened it, and anything after that. */
		when: string;
		/** A place to go: the row is a link. */
		href?: string;
		onclick?: () => void;
		/** The row's own name, when it says more than its text (the menu's last game). */
		label?: string;
		/** This page is the game. */
		current?: boolean;
		testid?: string;
	}

	let { name, logo, empty, line, when, href, onclick, label, current, testid }: Props = $props();
</script>

{#snippet card()}
	<ScriptName {name} {logo} {empty}>
		{#snippet sub()}<span class="resume-line">{line}</span>
			<!-- Its own line, so a phone shows all of it (Trevor, 2026-10-26). -->
			<span class="resume-line">{when}</span>{/snippet}
	</ScriptName>
{/snippet}

{#if href}<!-- eslint-disable svelte/no-navigation-without-resolve -- href is already resolved -->
	<a
		class="resume-game"
		{href}
		{onclick}
		aria-label={label}
		aria-current={current ? 'page' : undefined}
		data-testid={testid}>{@render card()}</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else if onclick}<button
		type="button"
		class="resume-game"
		{onclick}
		aria-label={label}
		data-testid={testid}>{@render card()}</button
	>{:else}<div class="resume-game still" data-testid={testid}>{@render card()}</div>{/if}

<style>
	/* Three lines always, so a room's details arriving move nothing. */
	.resume-game {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		text-decoration: none;
		cursor: pointer;
	}
	.still {
		cursor: default;
	}
	/* As the menu's rows do (Trevor, 2026-11-06: "should have hover effect"). */
	@media (hover: hover) and (pointer: fine) {
		.resume-game:not(.still):hover {
			background: var(--surface-hover);
		}
	}
	.resume-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
