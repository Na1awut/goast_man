// Small physical feedback helpers. Everything degrades silently: no vibration
// API, reduced motion, or a missing target simply means no flourish.
import { prefersReducedMotion } from './utils';

/** A short tick on devices that support vibration (Android Chrome); ignored elsewhere */
export function haptic(pattern: number | number[] = 12) {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		// Some browsers throw when vibration is blocked by permissions policy
	}
}

/**
 * Send a small orange dot from the tapped control into the cart bar, the way
 * the item "drops into the bag". Resolves the target lazily because the bar may
 * only mount after the first item is added.
 */
export function flyToCart(from: Element, targetSelector = '[data-cart-target]') {
	if (prefersReducedMotion()) return;
	requestAnimationFrame(() => {
		const target = document.querySelector(targetSelector);
		if (!target) return;
		const a = from.getBoundingClientRect();
		const b = target.getBoundingClientRect();
		const size = 14;
		const dot = document.createElement('span');
		dot.setAttribute('aria-hidden', 'true');
		Object.assign(dot.style, {
			position: 'fixed',
			left: `${a.left + a.width / 2 - size / 2}px`,
			top: `${a.top + a.height / 2 - size / 2}px`,
			width: `${size}px`,
			height: `${size}px`,
			borderRadius: '9999px',
			background: '#FA4616',
			boxShadow: '0 2px 6px rgb(250 70 22 / 0.35)',
			pointerEvents: 'none',
			zIndex: '80'
		});
		document.body.appendChild(dot);
		const dx = b.left + 28 - (a.left + a.width / 2);
		const dy = b.top + b.height / 2 - (a.top + a.height / 2);
		// Arc: rise a little first, then drop into the bar
		const anim = dot.animate(
			[
				{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
				{ transform: `translate(${dx * 0.45}px, ${Math.min(dy, 0) - 40}px) scale(0.9)`, opacity: 1, offset: 0.45 },
				{ transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.6 }
			],
			{ duration: 480, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
		);
		anim.onfinish = () => {
			dot.remove();
			target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
		};
	});
}
