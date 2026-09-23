// Orders global store (Svelte 5 runes)
import type { Order } from '$lib/types';

// --- State ---
let activeOrders = $state<Order[]>([]);
let orderHistory = $state<Order[]>([]);

// --- Mock Data for Demo ---
export function initDemoOrders() {
	activeOrders = [
		{
			id: 'ord-8492',
			orderCode: '#KM-8492',
			customerId: 'u-demo-001',
			customerEmail: 'goose@mail.kmutt.ac.th',
			riderId: 'r-001',
			riderEmail: 'somchai@mail.kmutt.ac.th',
			riderName: 'พี่สมชาย',
			riderFaculty: 'วิศวกรรมเครื่องกล ปี 3',
			riderRating: 4.95,
			riderPhone: '081-234-5678',
			pickupHubId: 'canteen-male',
			pickupHubName: 'โรงอาหารพระจอมเกล้า (โรงชาย)',
			dropoffNodeId: 'lx-1',
			dropoffNodeName: 'ตึก LX ชั้น 1 หน้าตู้เต่าบิน',
			itemDetails: 'ข้าวมันไก่ผสม (ต้ม+ทอด) 1 กล่อง + ชามะนาว 1 แก้ว',
			estimatedPrice: 80,
			deliveryFee: 20,
			discount: 15,
			totalPrice: 85,
			status: 'DELIVERING',
			otpCode: '8492',
			note: 'นั่งโต๊ะม้าหินอ่อน ใส่เสื้อสีขาว',
			createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
			acceptedAt: new Date(Date.now() - 10 * 60000).toISOString(),
			deliveringAt: new Date(Date.now() - 3 * 60000).toISOString(),
		}
	];

	orderHistory = [
		{
			id: 'ord-7720',
			orderCode: '#KM-7720',
			customerId: 'u-demo-001',
			customerEmail: 'goose@mail.kmutt.ac.th',
			riderName: 'น้องแก้ว',
			riderFaculty: 'วิทยาศาสตร์ ปี 2',
			riderRating: 4.8,
			pickupHubId: 'green-canteen',
			pickupHubName: 'Green Canteen (190 ปี)',
			dropoffNodeId: 'cb2',
			dropoffNodeName: 'อาคาร CB2 ม้าหินอ่อน',
			itemDetails: 'ผัดไทกุ้งสด 1 จาน + น้ำมะนาว 1 แก้ว',
			estimatedPrice: 65,
			deliveryFee: 15,
			totalPrice: 80,
			status: 'COMPLETED',
			otpCode: '7720',
			createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
			completedAt: new Date(Date.now() - 23.5 * 3600000).toISOString(),
		} as Order,
		{
			id: 'ord-6100',
			orderCode: '#KM-6100',
			customerId: 'u-demo-001',
			customerEmail: 'goose@mail.kmutt.ac.th',
			riderName: 'พี่โอ๊ต',
			riderFaculty: 'สถาปัตยกรรมศาสตร์ ปี 4',
			riderRating: 4.7,
			pickupHubId: '7eleven-dorm',
			pickupHubName: 'เซเว่นหน้าหอใน',
			dropoffNodeId: 'dorm-s6',
			dropoffNodeName: 'หอพักหญิง S6 ล็อบบี้',
			itemDetails: 'ขนมปัง + นม + ขนมขบเคี้ยว 2 ถุง',
			estimatedPrice: 95,
			deliveryFee: 15,
			totalPrice: 110,
			status: 'COMPLETED',
			otpCode: '6100',
			createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
			completedAt: new Date(Date.now() - 2.9 * 24 * 3600000).toISOString(),
		} as Order,
	];
}

// --- Actions ---
export function addOrder(order: Order) {
	activeOrders = [order, ...activeOrders];
}

export function updateOrderStatus(orderId: string, status: Order['status']) {
	const idx = activeOrders.findIndex(o => o.id === orderId);
	if (idx > -1) {
		activeOrders[idx].status = status;
		if (status === 'COMPLETED' || status === 'CANCELLED') {
			const [completed] = activeOrders.splice(idx, 1);
			orderHistory = [completed, ...orderHistory];
		}
	}
}

// --- Getters ---
export function getActiveOrders(): Order[] {
	return activeOrders;
}

export function getOrderHistory(): Order[] {
	return orderHistory;
}

export function getAllOrders(): Order[] {
	return [...activeOrders, ...orderHistory];
}

export function getOrderById(id: string): Order | undefined {
	return activeOrders.find(o => o.id === id) || orderHistory.find(o => o.id === id);
}

export function getActiveOrderCount(): number {
	return activeOrders.length;
}
