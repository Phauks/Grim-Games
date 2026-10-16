<script lang="ts">
	// Draft for Trevor's review (2026-10-15). Describes only what the app does today; update it
	// whenever a feature sends or stores something new (live rooms).
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy policy · Grim-Games</title>
</svelte:head>

<main>
	<h1>Privacy policy</h1>
	<p class="muted">Last updated 16 October 2026</p>

	<h2>Summary</h2>
	<p>
		Grim-Games has no analytics, no advertising and no tracking cookies. Your games and settings
		stay on your device. Our server stores only a custom script you choose to share, and, if you
		choose to sign in, your account.
	</p>

	<h2>What stays on your device</h2>
	<ul>
		<li>Your games, saved in your browser's storage (IndexedDB).</li>
		<li>
			Your settings, such as theme, fonts, text size, icons and Storyteller settings, and how you
			last viewed the <a href={resolve('/reference')}>Reference</a> page (localStorage).
		</li>
		<li>
			A log of up to 20 recent problems the app ran into: the error message, the app area, the page
			and when it happened. It never contains your games. You can view or clear it from About,
			Problems on this device (localStorage).
		</li>
		<li>Your 20 most recently loaded scripts (IndexedDB).</li>
		<li>
			For each script you shared with a code, a random key that lets you delete it (localStorage).
		</li>
		<li>A copy of the app itself, so it works offline.</li>
	</ul>
	<p>
		None of this is sent to us, apart from a script you share (below). Clearing this site's data in
		your browser deletes it, as does Reset settings for your settings.
	</p>

	<h2>Shared scripts</h2>
	<p>
		When you tap Share or QR code for a custom script, the app uploads that script to our server and
		stores it under a random four-word code, such as poisoned-drunk-imp-bell. Nothing is uploaded
		just by opening a page. Official editions and BotC Scripts scripts are never uploaded: their
		link only names the edition or the script's public number.
	</p>
	<ul>
		<li>No name, account or IP address is stored with the script.</li>
		<li>Anyone with the code or link can open the script.</li>
		<li>
			It is deleted automatically 90 days after it was last opened, or straight away when you tap
			Delete code on the device that shared it. That device keeps the delete key; our server keeps
			only a scrambled (hashed) copy of it.
		</li>
		<li>
			To stop people guessing codes, our server limits how many codes one IP address can look up or
			create each minute, using Cloudflare's rate limiter. We do not store the address.
		</li>
		<li>
			The code appears in our request logs as part of the page address; the script itself never
			does.
		</li>
		<li>
			If a code can't be made, for example while you are offline, the app shares a longer link that
			carries the whole script in the part of the address browsers never send to a server.
		</li>
	</ul>

	<h2>Accounts (optional)</h2>
	<p>
		Signing in is optional, and the app works fully without it. If you sign in, we store, in
		Cloudflare Durable Object storage:
	</p>
	<ul>
		<li>Your email address.</li>
		<li>
			Your sign-in sessions: a random token, stored only as a hash, with a short device description
			such as "Chrome on Android" and when the session was created and last used. A session ends
			when you sign out, or after 180 days unused.
		</li>
		<li>The scripts you save to your profile.</li>
	</ul>
	<p>
		Your browser keeps the session in a cookie that only our sign-in requests use; it is not used
		for tracking. Sign-in codes are kept as hashes and expire after 10 minutes. Sign-in requests are
		limited per network address using Cloudflare's rate limiter; we do not store the address.
		Nothing is shared with anyone. The <a href={resolve('/account')}>Account</a> page lets you download
		everything, or delete your account and all its data immediately.
	</p>
	<p>
		On the Preview (test) version no email is sent: the sign-in code is shown on screen, and the
		code and your email address are written to our server log.
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
			<strong>BotC Scripts.</strong> When you search or browse botcscripts.com, or load a script from
			it, the app sends your search words or the script's public number to our server, which asks botcscripts.com
			and keeps the answer for a few minutes. botcscripts.com sees our server, not you.
		</li>
		<li>
			<strong>A link you load a script from.</strong> "Load from a link" downloads the script straight
			from the site you name (without cookies), so that site sees your request like any page visit. Pasted
			and uploaded scripts never leave your device unless you share them.
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
