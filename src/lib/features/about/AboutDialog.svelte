<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { REPOSITORY_URL, shortCommit } from './report-issue.ts';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog bind:open title="About Grim-Games">
	<dl>
		<dt>Version</dt>
		<dd>{info.version}</dd>
		<dt>Commit</dt>
		<dd>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
				>{shortCommit(info)}</a
			>
		</dd>
		<dt>Branch</dt>
		<dd>{info.branch}</dd>
		<dt>Channel</dt>
		<dd>{info.channel}</dd>
		<dt>Built</dt>
		<dd>{new Date(info.builtAt).toLocaleString()}</dd>
	</dl>
	<p class="small">
		Not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven
		Medway and The Pandemonium Institute. Character data and icons from TPI's toolmaker resources
		under the Community Created Content policy.
	</p>
</Dialog>

<style>
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: calc(0.25 * var(--u)) calc(1 * var(--u));
	}
	dt {
		opacity: 0.75;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
		min-height: auto;
	}
	.small {
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
