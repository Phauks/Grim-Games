<script lang="ts">
	interface Props {
		/** The heading's words, such as "Night" or "Bag draw". */
		title: string;
		/** The section's first heading, right under its name: no space above. */
		first?: boolean;
	}

	let { title, first = false }: Props = $props();
</script>

<!-- A plain heading over a run of settings in one section, so a long list scans (Trevor,
     2026-10-17). One look in every section (Trevor, 2026-10-24); it starts a new run, so the
     first setting under it has no line above. -->
<h3 class="setting-heading" data-first={first || undefined}>{title}</h3>

<style>
	.setting-heading {
		margin: var(--space-5) 0 var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	.setting-heading[data-first] {
		margin-top: 0;
	}
</style>
