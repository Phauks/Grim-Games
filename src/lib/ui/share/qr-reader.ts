/**
 * Reads a QR code from a video frame (plan J2, Scan a code). The browser's own
 * BarcodeDetector where it reads QR codes (Chrome on Android); otherwise jsQR (Apache-2.0),
 * loaded only then, which covers Safari on iPhone and iPad and desktop browsers.
 */
export type QrReader = (video: HTMLVideoElement) => Promise<string | undefined>;

interface Detected {
	rawValue: string;
}
interface Detector {
	detect(source: HTMLVideoElement): Promise<Detected[]>;
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
		return async (video) => (await detector.detect(video))[0]?.rawValue || undefined;
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
		if (!context || !video.videoWidth) return undefined;
		const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
		canvas.width = Math.round(video.videoWidth * scale);
		canvas.height = Math.round(video.videoHeight * scale);
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		const frame = context.getImageData(0, 0, canvas.width, canvas.height);
		return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data;
	};
}
