/**
 * Saves text as a file on the device (a script's JSON, a character, diagnostics). One helper
 * for every download (component review, 2026-10-17: three hand-written copies).
 */
export function downloadFile(fileName: string, text: string, type = 'application/json'): void {
	downloadBlob(fileName, new Blob([text], { type }));
}

/** Saves a file already made (a picture) on the device. */
export function downloadBlob(fileName: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from a title: letters and digits joined by dashes, or `fallback`. */
export function fileNameFor(title: string, fallback: string, extension = 'json'): string {
	const base = title
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-|-$/g, '');
	return `${base || fallback}.${extension}`;
}

export function downloadJson(fileName: string, json: unknown): void {
	downloadFile(fileName, JSON.stringify(json, null, '\t'));
}
