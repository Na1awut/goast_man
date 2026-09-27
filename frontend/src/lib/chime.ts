// A short two-tone chime drawn with Web Audio, so there is no sound file to load.
// Browsers only allow sound after the user has tapped something: call unlockChime()
// from a tap (e.g. switching "พร้อมรับงาน" on) so later chimes can play on their own.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
	try {
		ctx ??= new AudioContext();
		return ctx;
	} catch {
		return null;
	}
}

/** Call from a click/tap handler */
export function unlockChime() {
	void context()?.resume().catch(() => {});
}

export function chime() {
	const audio = context();
	if (!audio) return;
	try {
		const now = audio.currentTime;
		for (const [i, freq] of [880, 1320].entries()) {
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, now + i * 0.16);
			gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.16 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.15);
			osc.connect(gain).connect(audio.destination);
			osc.start(now + i * 0.16);
			osc.stop(now + i * 0.16 + 0.16);
		}
	} catch {
		/* no audio */
	}
}
