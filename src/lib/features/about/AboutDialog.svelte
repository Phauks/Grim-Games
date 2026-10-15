<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { REPOSITORY_URL, shortCommit } from './report-issue.ts';

	// Native <dialog> for now; moves onto the Ark UI Dialog primitive once it exists.
	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} aria-labelledby="about-title" closedby="any">
	<h2 id="about-title">About Grim-Games</h2>
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
	<form method="dialog">
		<button type="submit">Close</button>
	</form>
</dialog>

<style>
	dialog {
		max-width: min(28rem, calc(100vw - 2rem));
		border: 1px solid var(--accent);
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--on-surface);
		padding: 1rem 1.25rem;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	h2 {
		margin-top: 0;
		font-family: var(--font-display);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
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
	form {
		display: flex;
		justify-content: flex-end;
	}
	button {
		padding: 0 1.25rem;
		border-radius: 0.5rem;
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		font: inherit;
	}
</style>
