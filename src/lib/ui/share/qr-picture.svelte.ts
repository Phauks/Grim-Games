/**
 * The Storyteller's own picture for the middle of share QR codes (plan R1), kept on this
 * device only. It is scaled down when chosen, so it stays light to store, and kept whole:
 * Settings shapes how it sits in the square (Trevor, 2026-10-23), not the stored copy.
 */
import { unpackPicture } from '#lib/ui/picked-picture.ts';
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const KEY = 'grim-games:qr-picture:v1';
/** Pixels on the stored picture's longer side: the QR's middle, zoomed in, is never larger. */
const SIZE = 512;

function stored(): string | undefined {
	const value = readStoredText(KEY);
	return value?.startsWith('data:image/') ? value : undefined;
}

export const qrPicture = $state<{ current: string | undefined }>({ current: stored() });

/** Scales a picture file down, whole, and keeps it. False when it can't be read. */
export async function chooseQrPicture(file: File): Promise<boolean> {
	try {
		const picture = await unpackPicture(file, SIZE);
		const scale = Math.min(1, SIZE / Math.max(picture.width, picture.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(picture.width * scale));
		canvas.height = Math.max(1, Math.round(picture.height * scale));
		const context = canvas.getContext('2d');
		if (!context) {
			picture.close();
			return false;
		}
		context.drawImage(picture.image, 0, 0, canvas.width, canvas.height);
		picture.close();
		const url = canvas.toDataURL('image/png');
		if (!writeStoredText(KEY, url)) return false;
		qrPicture.current = url;
		return true;
	} catch {
		return false;
	}
}
