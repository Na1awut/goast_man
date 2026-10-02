// Mock pool of online student runners used by the simulated matching flow
import type { Rider } from '$lib/types';

export const RIDER_POOL: Rider[] = [
	{ id: 'r-001', name: 'พี่สมชาย', fullName: 'สมชาย ใจดีมาก', faculty: 'วิศวกรรมเครื่องกล ปี 3', rating: 4.95, jobs: 312 },
	{ id: 'r-002', name: 'น้องแก้ว', fullName: 'แก้วตา ศรีสวัสดิ์', faculty: 'วิทยาศาสตร์ ปี 2', rating: 4.88, jobs: 147 },
	{ id: 'r-003', name: 'พี่โอ๊ต', fullName: 'ธนวัฒน์ รุ่งเรือง', faculty: 'สถาปัตยกรรมศาสตร์ ปี 4', rating: 4.9, jobs: 205 },
	{ id: 'r-004', name: 'น้องมายด์', fullName: 'ณัฐธิดา ทองคำ', faculty: 'SIT ปี 1', rating: 4.97, jobs: 58 }
];

export function pickRider(): Rider {
	return RIDER_POOL[Math.floor(Math.random() * RIDER_POOL.length)];
}
