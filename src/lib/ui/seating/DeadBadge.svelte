<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * A dead player's badge: a skull, or with their ghost vote a solid ghost on a night-dark
	 * badge, grey and hollow (or struck through) once spent (Trevor, 2026-10-19). One look on
	 * the board and in the seat sheet (Trevor, 2026-10-19: "match the ghost vote visual
	 * language"). Its size is `--badge-size`.
	 */
	interface Props {
		vote?: 'unused' | 'used';
		/** How a used ghost vote looks: a grey outline ghost, or struck through. */
		usedLook?: 'hollow' | 'struck';
		testid?: string;
	}

	let { vote, usedLook = 'hollow', testid }: Props = $props();
</script>

<span
	class="dead-badge"
	data-testid={testid}
	data-vote={vote}
	data-used-look={vote === 'used' ? usedLook : undefined}
	>{#if vote}<Icon name="ghostVote" weight={vote === 'used' ? 'regular' : 'fill'} />{:else}<Icon
			name="dead"
		/>{/if}</span
>

<style>
	.dead-badge {
		position: relative;
		display: inline-grid;
		flex: none;
		place-items: center;
		box-sizing: border-box;
		width: var(--badge-size, 1.75em);
		height: var(--badge-size, 1.75em);
		border: calc(0.125 * var(--u)) solid var(--on-button);
		border-radius: 50%;
		background: var(--button);
		color: var(--on-button);
		box-shadow: var(--shadow);
		--icon-size: calc(var(--badge-size, 1.75em) * 0.68);
	}
	/*
	 * With a ghost vote it is a ghost on a night-dark badge (Trevor, 2026-10-19: darker than
	 * the skull), dark on every theme so it stands out from any token face.
	 */
	.dead-badge[data-vote] {
		border-color: var(--ghost-vote-rim);
		background: var(--ghost-vote-badge);
		color: var(--ghost-vote);
	}
	/* The ghost vote spent: a grey outline ghost. */
	.dead-badge[data-vote='used'] {
		border-color: var(--ghost-used-rim);
		color: var(--ghost-used);
	}
	/* Or struck through: a red slash and rim over the grey ghost. */
	.dead-badge[data-used-look='struck'] {
		overflow: hidden;
		border-color: var(--evil);
	}
	.dead-badge[data-used-look='struck']::before {
		content: '';
		position: absolute;
		width: 140%;
		height: 12%;
		border-radius: 999em;
		background: var(--evil);
		transform: rotate(-45deg);
	}
</style>
