// The boot-failure screen, loaded by src/app.html before the app. Plain JavaScript that needs
// nothing from the app bundle, so a build that can't start shows its error instead of a blank
// page (there is no inspector on a phone). It holds the error text, build and device only, never
// game state. A file, not inline, so the Content Security Policy needs no hash for it.
(function () {
	var errors = [];
	var BUILD = (document.currentScript && document.currentScript.dataset.build) || '';
	// Games and settings live on the device, so the app can't run where the browser
	// refuses this site storage (Brave Shields or a browser set to block all cookies):
	// reading localStorage then throws SecurityError. Say so instead of failing in pieces.
	var storageBlocked = false;
	try {
		window.localStorage.getItem('grim-games:storage-check');
	} catch (e) {
		storageBlocked = !!e && e.name === 'SecurityError';
	}
	var STORAGE_HELP =
		'This browser blocks site storage here, and your games and settings are kept on this device. ' +
		'Allow cookies and site data for this site, then reload. In Brave, tap the lion in the address bar, ' +
		'open Advanced controls and stop blocking cookies.';
	// Query strings and hashes can carry share links or room secrets: never copy them.
	function scrub(text) {
		return String(text).replace(/(\b(?:https?|wss?|blob):\/\/[^\s)'"?#]+)[?#][^\s)'"]*/g, '$1');
	}
	function remember(error, fallback) {
		if (errors.length >= 5) return;
		if (error instanceof Error) {
			var stack = (error.stack || '').split('\n').slice(0, 6).join('\n');
			errors.push(scrub(error.name + ': ' + error.message + (stack ? '\n' + stack : '')));
		} else if (typeof error === 'string') errors.push(scrub(error));
		else if (fallback) errors.push(scrub(fallback));
	}
	addEventListener(
		'error',
		function (event) {
			var target = event.target;
			// A script or stylesheet that failed to load (capture phase sees those too).
			if (target && target !== window && (target.src || target.href)) {
				remember('Could not load ' + (target.src || target.href));
			} else if (!/ResizeObserver loop/.test(event.message || '')) {
				// ResizeObserver loop warnings are harmless (isBenignBrowserError in app-error.ts).
				remember(event.error, event.message);
			}
		},
		true
	);
	addEventListener('unhandledrejection', function (event) {
		remember(event.reason, 'a promise was rejected');
	});

	function booted() {
		var root = document.getElementById('app-root');
		return !!(root && root.querySelector(':scope > :not(script)'));
	}
	function el(tag, text, style) {
		var node = document.createElement(tag);
		if (text) node.textContent = text;
		if (style) node.style.cssText = style;
		return node;
	}
	var BUTTON =
		'display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;margin:0 8px 8px 0;border:1px solid #6b5a48;border-radius:8px;background:#2b1d16;color:#efe2c4;font:inherit;text-decoration:none;cursor:pointer;';
	async function reloadLatest() {
		// Drops the offline copy of the app only; saved games and settings live elsewhere.
		try {
			var registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((r) => r.unregister()));
			var keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k)));
		} catch {
			// Reloading anyway is the best left to try.
		}
		location.reload();
	}
	function show() {
		if (document.getElementById('boot-failure')) return;
		// With storage blocked the app may draw a page and then fail, so don't wait for that.
		if (!storageBlocked && booted()) return;
		var details = storageBlocked
			? STORAGE_HELP
			: errors.length
				? errors.join('\n\n')
				: 'No error was caught: the app never started.';
		var box = el(
			'div',
			'',
			'position:fixed;inset:0;z-index:2147483647;overflow:auto;padding:24px 16px;background:#1c130e;color:#efe2c4;font:16px/1.4 Georgia,serif;'
		);
		box.id = 'boot-failure';
		box.setAttribute('role', 'alert');
		box.appendChild(
			el('h1', "Grimbinder couldn't start", 'margin:0 0 8px;font-size:1.4rem;color:#e0b95b;')
		);
		box.appendChild(
			storageBlocked
				? el('p', details, 'margin:0 0 12px;')
				: el(
						'pre',
						details,
						'margin:0 0 12px;padding:12px;max-height:40vh;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#000;border-radius:8px;font:13px/1.4 ui-monospace,monospace;'
					)
		);
		box.appendChild(el('p', BUILD, 'margin:0 0 16px;font-size:0.85rem;opacity:0.75;'));
		var reload = el('button', 'Reload', BUTTON);
		reload.type = 'button';
		reload.onclick = function () {
			location.reload();
		};
		var latest = el('button', 'Load the latest version', BUTTON);
		latest.type = 'button';
		latest.onclick = reloadLatest;
		var report = el('a', 'Copy and report on GitHub', BUTTON);
		// GitHub's issue chooser: the app, and so its Report form, didn't start. It can't be prefilled,
		// so the details go on the clipboard to paste into the form.
		report.href = 'https://github.com/Phauks/Grim-Games/issues/new/choose';
		report.onclick = function () {
			try {
				navigator.clipboard.writeText(
					details + '\n\nBuild: ' + BUILD + '\nDevice: ' + navigator.userAgent
				);
			} catch {
				// No clipboard: the report page still opens.
			}
		};
		report.target = '_blank';
		report.rel = 'noopener';
		// Blocked storage isn't a bug to report, and there is no offline copy to drop.
		if (storageBlocked) box.append(reload);
		else box.append(reload, latest, report);
		document.body.appendChild(box);
	}
	if (storageBlocked) addEventListener('DOMContentLoaded', show);
	// Give the app time to load its chunks on a slow connection; sooner once it has failed.
	addEventListener('load', function () {
		setTimeout(function () {
			if (errors.length) show();
		}, 3000);
		setTimeout(show, 10000);
	});
})();
