/**
 * e2e: passes the test server's output through, leaving out workerd's report of a browser that
 * hung up mid-reply ("disconnected: write(): Broken pipe"). Tests end and pages move on while
 * replies are on their way, so a run logged it about 140 times (CI run 40606643913) and hid
 * the errors worth reading. Every other line, errors included, is kept.
 *
 * `wrangler dev ... 2>&1 | node scripts/quiet-server-log.ts --run` (playwright.config.ts).
 */
import { createInterface } from 'node:readline';

const HUNG_UP =
	/kj::getCaughtExceptionAsKj\(\).*disconnected: write\(\): (Broken pipe|Connection reset by peer)/;
/** workerd's native stack for that report, a line or two after it. */
const NATIVE_STACK = /^\s*stack: (\S*workerd@\S+\s*)+$/;

/** A filter over the server's lines: true keeps the line. Blank lines after a dropped report go too. */
export function serverLogFilter(): (line: string) => boolean {
	let dropping = false;
	return (line) => {
		if (HUNG_UP.test(line)) return !(dropping = true);
		if (dropping && (line.trim() === '' || NATIVE_STACK.test(line))) return false;
		dropping = false;
		return true;
	};
}

if (process.argv.includes('--run')) {
	const keep = serverLogFilter();
	const lines = createInterface({ input: process.stdin });
	lines.on('line', (line) => {
		if (keep(line)) process.stdout.write(`${line}\n`);
	});
}
