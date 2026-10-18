<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The group's name, shown on its preview box. */
		title: string;
		/** The preview box's own test id, if a test needs it. */
		testid?: string;
		/** The live preview: give it a fixed height, so a change never moves the settings. */
		preview: Snippet;
		children: Snippet;
	}

	let { title, testid, preview, children }: Props = $props();
	const id = $props.id();
</script>

<!--
	A group of settings with its own live preview box (Trevor, 2026-10-18: "separate each into
	its own box, only pin the box of that associated thing while it is there"). Wide: the box
	sits left of its settings and stays in view while they scroll past. Narrow: the box sits
	above them and stays under the section's name row until the group has scrolled away.
-->
<section class="setting-group" aria-labelledby="{id}-title">
	<div class="layout">
		<div class="box" data-testid={testid}>
			<h3 id="{id}-title">{title}</h3>
			<div class="body" aria-hidden="true">{@render preview()}</div>
		</div>
		<div class="settings">{@render children()}</div>
	</div>
</section>

<style>
	.setting-group {
		container-type: inline-size;
		margin: 0 0 var(--space-6);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	.box {
		position: sticky;
		/* Just under the Settings section's sticky heading row; only within this group. */
		top: var(--settings-heading-height, 0);
		z-index: 1;
		align-self: start;
		padding: var(--space-2) 0;
		background: var(--dialog-background);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	/* One card look for every preview. Short phone screens: the card stays small, leaving
	   room for the settings. */
	.body {
		max-height: 30dvh;
		overflow: hidden;
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	@container (min-width: 26rem) {
		.layout {
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			gap: var(--space-5);
		}
		.body {
			max-height: none;
		}
	}
</style>
