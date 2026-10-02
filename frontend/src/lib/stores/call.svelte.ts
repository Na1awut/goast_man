// In-app voice calls between an order's buyer and rider (Svelte 5 runes).
//
// The database decides who may call (start_call / answer_call / end_call) and
// keeps the record; the two phones swap WebRTC offers on the private Realtime
// channel "call:<order id>", then talk peer to peer (or through TURN, from the
// call-ice Edge Function). Nobody's phone number is involved. Live mode only.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { haptic } from '$lib/feedback';
import { db, friendlyError, isLive } from '$lib/supabase';

type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
type Role = 'CUSTOMER' | 'RIDER';

/** No answer within this long counts as missed (the server says the same at 60 s) */
const RING_MS = 45_000;
const STUN: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

interface Ring {
	id: string;
	order_id: string;
	caller_role: Role;
	order_code: string;
	caller_name: string;
}

class CallStore {
	state = $state<CallState>('idle');
	/** Who is on the other end, as the app shows them (nickname + role) */
	peerName = $state('');
	peerRole = $state<Role>('RIDER');
	orderCode = $state('');
	muted = $state(false);
	seconds = $state(0);
	/** Why the call ended, shown for a moment */
	message = $state('');
	remoteStream = $state<MediaStream | null>(null);

	readonly available = isLive && typeof window !== 'undefined' && 'RTCPeerConnection' in window && !!navigator.mediaDevices?.getUserMedia;

	#userId: string | null = null;
	#watch: RealtimeChannel | null = null;
	#callId: string | null = null;
	#orderId: string | null = null;
	#caller = false;
	#pc: RTCPeerConnection | null = null;
	#local: MediaStream | null = null;
	#signal: RealtimeChannel | null = null;
	#pendingIce: RTCIceCandidateInit[] = [];
	#gotOffer = false;
	#timers: ReturnType<typeof setTimeout>[] = [];
	#clock: ReturnType<typeof setInterval> | null = null;
	#tone: Ringtone | null = null;

	/** Listen for calls to me while signed in; also picks up a ring that woke the app */
	watch(userId: string) {
		if (!this.available || this.#userId === userId) return;
		this.reset();
		this.#userId = userId;
		this.#watch = db()
			.channel(`calls:${userId}`)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` }, () => void this.checkRinging())
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` }, (p) => this.#onRow(p.new as { id: string; status: string }))
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${userId}` }, (p) => this.#onRow(p.new as { id: string; status: string }))
			.subscribe();
		void this.checkRinging();
	}

	async checkRinging() {
		if (!this.#userId || this.state !== 'idle') return;
		const { data } = await db().rpc('my_ringing_call');
		const ring = data as Ring | null;
		if (!ring || this.state !== 'idle') return;
		this.#callId = ring.id;
		this.#orderId = ring.order_id;
		this.#caller = false;
		this.peerName = ring.caller_name;
		this.peerRole = ring.caller_role;
		this.orderCode = ring.order_code;
		this.state = 'incoming';
		this.#tone = new Ringtone('incoming');
		this.#later(() => this.state === 'incoming' && this.#finish('ไม่ได้รับสาย'), RING_MS);
	}

	/** Ring the other person on an order in hand */
	async start(orderId: string, peerName: string, peerRole: Role, orderCode = '') {
		if (!this.available || this.state !== 'idle') return;
		this.state = 'outgoing';
		this.message = '';
		this.peerName = peerName;
		this.peerRole = peerRole;
		this.orderCode = orderCode;
		this.#orderId = orderId;
		this.#caller = true;
		try {
			// Microphone first: no point ringing someone we can't talk to
			await this.#prepare(orderId);
			const { data, error } = await db().rpc('start_call', { p_order_id: orderId });
			if (error) throw error;
			this.#callId = data as string;
			await this.#join(orderId);
			this.#tone = new Ringtone('outgoing');
			this.#later(() => this.state === 'outgoing' && void this.hangup('ไม่มีผู้รับสาย'), RING_MS);
		} catch (err) {
			this.#finish(this.#explain(err));
		}
	}

	async accept() {
		if (this.state !== 'incoming' || !this.#callId || !this.#orderId) return;
		this.#tone?.stop();
		this.state = 'connecting';
		try {
			await this.#prepare(this.#orderId);
			const { error } = await db().rpc('answer_call', { p_call_id: this.#callId });
			if (error) throw error;
			await this.#join(this.#orderId);
			// The caller makes the offer once it hears we're here; say it again in case it missed it
			const ready = () => !this.#gotOffer && this.#send('ready', {});
			ready();
			this.#later(ready, 1500);
			this.#later(ready, 4000);
			this.#later(() => this.state === 'connecting' && void this.hangup('เชื่อมต่อไม่สำเร็จ'), 20_000);
		} catch (err) {
			void this.hangup(this.#explain(err));
		}
	}

	/** Hang up, cancel the ring, or decline */
	async hangup(reason = 'วางสายแล้ว') {
		if (this.state === 'idle' || this.state === 'ended') return;
		const id = this.#callId;
		this.#send('hangup', {});
		this.#finish(reason);
		if (id) await db().rpc('end_call', { p_call_id: id });
	}

	toggleMute() {
		this.muted = !this.muted;
		this.#local?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
	}

	/** Signed out: stop everything */
	reset() {
		if (this.state !== 'idle' && this.state !== 'ended') void this.hangup();
		this.#cleanup();
		if (this.#watch) void db().removeChannel(this.#watch);
		this.#watch = null;
		this.#userId = null;
		this.state = 'idle';
	}

	// ---------- internals ----------

	async #prepare(orderId: string) {
		try {
			this.#local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
		} catch {
			throw new Error('MIC_DENIED');
		}
		const { data } = await db().functions.invoke('call-ice', { body: { order_id: orderId } });
		const iceServers = (data as { iceServers?: RTCIceServer[] } | null)?.iceServers ?? STUN;
		const pc = new RTCPeerConnection({ iceServers });
		this.#pc = pc;
		this.#local.getTracks().forEach((t) => pc.addTrack(t, this.#local!));
		pc.onicecandidate = (e) => e.candidate && this.#send('ice', e.candidate.toJSON());
		pc.ontrack = (e) => (this.remoteStream = e.streams[0] ?? new MediaStream([e.track]));
		pc.onconnectionstatechange = () => {
			if (pc.connectionState === 'connected' && this.state !== 'active') this.#connected();
			if (pc.connectionState === 'failed') void this.hangup('สัญญาณขาด');
		};
	}

	async #join(orderId: string) {
		const channel = db().channel(`call:${orderId}`, { config: { private: true, broadcast: { self: false } } });
		this.#signal = channel;
		channel
			.on('broadcast', { event: 'ready' }, (m) => this.#mine(m.payload) && void this.#offer())
			.on('broadcast', { event: 'offer' }, (m) => this.#mine(m.payload) && void this.#onOffer(m.payload.sdp))
			.on('broadcast', { event: 'answer' }, (m) => this.#mine(m.payload) && void this.#onAnswer(m.payload.sdp))
			.on('broadcast', { event: 'ice' }, (m) => this.#mine(m.payload) && void this.#onIce(m.payload.candidate))
			.on('broadcast', { event: 'hangup' }, (m) => this.#mine(m.payload) && this.#finish('อีกฝ่ายวางสายแล้ว'));
		await new Promise<void>((resolve, reject) => {
			channel.subscribe((status) => {
				if (status === 'SUBSCRIBED') resolve();
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('CALL_NOT_ALLOWED'));
			});
		});
	}

	#mine(payload: { callId?: string } | undefined) {
		return !!payload && payload.callId === this.#callId;
	}

	#send(event: string, data: object) {
		if (!this.#signal || !this.#callId) return;
		const payload = event === 'ice' ? { callId: this.#callId, candidate: data } : { callId: this.#callId, ...data };
		void this.#signal.send({ type: 'broadcast', event, payload });
	}

	async #offer() {
		const pc = this.#pc;
		if (!this.#caller || !pc || pc.signalingState !== 'stable' || pc.remoteDescription) return;
		this.#tone?.stop();
		this.state = 'connecting';
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		this.#send('offer', { sdp: offer.sdp });
	}

	async #onOffer(sdp: string) {
		const pc = this.#pc;
		if (this.#caller || !pc || this.#gotOffer) return;
		this.#gotOffer = true;
		await pc.setRemoteDescription({ type: 'offer', sdp });
		await this.#flushIce();
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		this.#send('answer', { sdp: answer.sdp });
	}

	async #onAnswer(sdp: string) {
		const pc = this.#pc;
		if (!this.#caller || !pc || pc.signalingState !== 'have-local-offer') return;
		await pc.setRemoteDescription({ type: 'answer', sdp });
		await this.#flushIce();
	}

	async #onIce(candidate: RTCIceCandidateInit) {
		if (!this.#pc?.remoteDescription) return void this.#pendingIce.push(candidate);
		await this.#pc.addIceCandidate(candidate).catch(() => {});
	}

	async #flushIce() {
		const queued = this.#pendingIce.splice(0);
		for (const c of queued) await this.#pc?.addIceCandidate(c).catch(() => {});
	}

	#connected() {
		this.#tone?.stop();
		this.state = 'active';
		this.seconds = 0;
		this.#clock = setInterval(() => this.seconds++, 1000);
		haptic(20);
	}

	/** The call row changed on the server (the other side hung up, or the order ended) */
	#onRow(row: { id: string; status: string }) {
		if (row.id !== this.#callId) return;
		if (row.status === 'ACTIVE' && this.#caller && this.state === 'outgoing') this.#tone?.stop();
		if (row.status === 'DECLINED') this.#finish('ปลายสายไม่สะดวกรับ');
		else if (row.status === 'MISSED') this.#finish(this.state === 'incoming' ? 'ไม่ได้รับสาย' : 'ไม่มีผู้รับสาย');
		else if (row.status === 'ENDED') this.#finish('วางสายแล้ว');
	}

	#explain(err: unknown) {
		const text = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
		if (text.includes('MIC_DENIED')) return 'ต้องอนุญาตไมโครโฟนก่อนถึงจะโทรได้';
		return friendlyError(err);
	}

	#finish(reason: string) {
		if (this.state === 'idle' || this.state === 'ended') return;
		this.message = reason;
		this.#cleanup();
		this.state = 'ended';
		this.#later(() => this.state === 'ended' && (this.state = 'idle'), 2200);
	}

	#cleanup() {
		this.#tone?.stop();
		this.#tone = null;
		this.#timers.forEach(clearTimeout);
		this.#timers = [];
		if (this.#clock) clearInterval(this.#clock);
		this.#clock = null;
		this.#local?.getTracks().forEach((t) => t.stop());
		this.#local = null;
		this.#pc?.close();
		this.#pc = null;
		if (this.#signal) void db().removeChannel(this.#signal);
		this.#signal = null;
		this.#pendingIce = [];
		this.#gotOffer = false;
		this.#callId = null;
		this.#orderId = null;
		this.remoteStream = null;
		this.muted = false;
	}

	#later(fn: () => unknown, ms: number) {
		this.#timers.push(setTimeout(fn, ms));
	}
}

/** Ring and ringback tones from WebAudio, so there are no sound files to ship */
class Ringtone {
	#ctx: AudioContext | null = null;
	#loop: ReturnType<typeof setInterval>;

	constructor(kind: 'incoming' | 'outgoing') {
		try {
			this.#ctx = new AudioContext();
		} catch {
			this.#ctx = null;
		}
		const play = () => {
			if (kind === 'incoming') haptic([300, 200, 300]);
			const ctx = this.#ctx;
			if (!ctx) return;
			const beeps = kind === 'incoming' ? [0, 0.25] : [0];
			for (const at of beeps) {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.frequency.value = kind === 'incoming' ? 880 : 440;
				gain.gain.setValueAtTime(kind === 'incoming' ? 0.15 : 0.06, ctx.currentTime + at);
				gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2);
				osc.connect(gain).connect(ctx.destination);
				osc.start(ctx.currentTime + at);
				osc.stop(ctx.currentTime + at + 0.22);
			}
		};
		play();
		this.#loop = setInterval(play, kind === 'incoming' ? 1600 : 3000);
	}

	stop() {
		clearInterval(this.#loop);
		void this.#ctx?.close().catch(() => {});
		this.#ctx = null;
	}
}

export const call = new CallStore();
