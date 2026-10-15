<script lang="ts">
	// Draft for Trevor's review (2026-10-15). Describes only what the app does today; update it
	// whenever a feature sends or stores something new (accounts, live rooms, script loading).
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy policy · Grim-Games</title>
</svelte:head>

<main>
	<h1>Privacy policy</h1>
	<p class="muted">Last updated 15 October 2026</p>

	<h2>Summary</h2>
	<p>
		Grim-Games has no accounts, no analytics, no advertising and no tracking cookies. Your games and
		settings stay on your device.
	</p>

	<h2>What stays on your device</h2>
	<ul>
		<li>Your games, saved in your browser's storage (IndexedDB).</li>
		<li>
			Your settings, such as theme, fonts, text size, icons and Storyteller help, and how you last
			viewed the <a href={resolve('/reference')}>Reference</a> page (localStorage).
		</li>
		<li>
			A log of up to 20 recent problems the app ran into: the error message, the app area, the page
			and when it happened. It never contains your games. You can view or clear it from About,
			Problems on this device (localStorage).
		</li>
		<li>A copy of the app itself, so it works offline.</li>
	</ul>
	<p>
		None of this is sent to us. Clearing this site's data in your browser deletes it, as does Reset
		settings for your settings.
	</p>

	<h2>Hosting</h2>
	<p>
		The app is served by Cloudflare. Like any website, each request your browser makes reaches
		Cloudflare's servers with your IP address, browser details and the page address. We keep
		Cloudflare's request logs to find and fix errors; Cloudflare keeps them for a limited time and
		we do not use them to identify or follow anyone. See
		<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener"
			>Cloudflare's privacy policy</a
		>.
	</p>

	<h2>Other sites the app contacts</h2>
	<ul>
		<li>
			<strong>Blood on the Clocktower wiki.</strong> To show rules definitions, the app downloads the
			wiki's Glossary page from wiki.bloodontheclocktower.com about once a week and keeps a copy on your
			device. The request contains nothing about you or your games beyond what any web request carries.
		</li>
		<li>
			<strong>GitHub.</strong> "Report an issue" and "Report a problem" open a form on github.com, filled
			in with the app version, the page you were on and your browser's description. Reporting a problem
			from the problem log also adds that problem's details, with web addresses shortened so no game data
			goes in. Nothing is sent until you submit it there, under your GitHub account.
		</li>
	</ul>

	<h2>Changes</h2>
	<p>
		We will update this page before the app starts sending or storing anything new. Questions can be
		asked through Report an issue.
	</p>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-size: 1.6rem;
	}
	h2 {
		margin: var(--space-5) 0 var(--space-2);
		font-size: 1.1rem;
	}
	p,
	ul {
		margin: 0 0 var(--space-3);
	}
	li + li {
		margin-top: var(--space-2);
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
