<script lang="ts">
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';

	/**
	 * One game to go back to on Join game: its script with two lines under it, the whole row one
	 * tap target. As player's rooms and the Players only towns (plan M55) both use it, so the
	 * two lists look alike.
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
		onclick: () => void;
	}

	let { name, logo, empty, line, when, onclick }: Props = $props();
</script>

<button type="button" class="resume-game" {onclick}>
	<ScriptName {name} {logo} {empty}>
		{#snippet sub()}<span class="resume-line">{line}</span>
			<!-- Its own line, so a phone shows all of it (Trevor, 2026-10-26). -->
			<span class="resume-line">{when}</span>{/snippet}
	</ScriptName>
</button>

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
		cursor: pointer;
	}
	.resume-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
