/**
 * Reads a QR code from a video frame (plan J2, Scan a code). The browser's own
 * BarcodeDetector where it reads QR codes (Chrome on Android); otherwise jsQR (Apache-2.0),
 * loaded only then, which covers Safari on iPhone and iPad and desktop browsers.
 */
/** Every code read in a frame: BarcodeDetector finds them all, jsQR one. */
export type QrReader = (video: HTMLVideoElement) => Promise<string[]>;

interface Detected {
	rawValue: string;
}
interface Detector {
	detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<Detected[]>;
}
interface DetectorClass {
	new (options: { formats: string[] }): Detector;
	getSupportedFormats(): Promise<string[]>;
}

/** Frames are read at most this wide; larger ones only slow jsQR down. */
const MAX_WIDTH = 640;

async function nativeReader(): Promise<QrReader | undefined> {
	const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
	if (!Native) return undefined;
	try {
		if (!(await Native.getSupportedFormats()).includes('qr_code')) return undefined;
		const detector = new Native({ formats: ['qr_code'] });
		return async (video) =>
			(await detector.detect(video)).map((code) => code.rawValue).filter(Boolean);
	} catch {
		return undefined;
	}
}

export async function makeQrReader(): Promise<QrReader> {
	const native = await nativeReader();
	if (native) return native;
	const { default: jsQR } = await import('jsqr');
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d', { willReadFrequently: true });
	return async (video) => {
		if (!context || !video.videoWidth) return [];
		const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
		canvas.width = Math.round(video.videoWidth * scale);
		canvas.height = Math.round(video.videoHeight * scale);
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		const frame = context.getImageData(0, 0, canvas.width, canvas.height);
		const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
		return code?.data ? [code.data] : [];
	};
}

/** A still photo is read at most this wide: a printed code is small on a whole sheet. */
const PHOTO_WIDTH = 2000;

/**
 * Every QR code in a still photo (Take a photo, plan M54: a sheet with its script's code on it
 * loads that exact script). The same readers as a video frame's.
 */
export async function readQrCodes(photo: HTMLCanvasElement): Promise<string[]> {
	const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
	try {
		if (Native && (await Native.getSupportedFormats()).includes('qr_code')) {
			const found = await new Native({ formats: ['qr_code'] }).detect(photo);
			return found.map((code) => code.rawValue).filter(Boolean);
		}
	} catch {
		// Fall through to jsQR.
	}
	const { default: jsQR } = await import('jsqr');
	const scale = Math.min(1, PHOTO_WIDTH / photo.width);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(photo.width * scale);
	canvas.height = Math.round(photo.height * scale);
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return [];
	context.drawImage(photo, 0, 0, canvas.width, canvas.height);
	const frame = context.getImageData(0, 0, canvas.width, canvas.height);
	const code = jsQR(frame.data, frame.width, frame.height);
	return code?.data ? [code.data] : [];
}
