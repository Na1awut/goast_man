// MOCKUP menu photos: stock photos from Unsplash picked by dish name, so the
// menu is not a wall of text until each stall sends real photos of its food.
// They show the kind of dish, not what the stall actually serves.
// Replace per item by setting MenuItem.imageUrl.

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=300&q=70`;

const P = {
	friedChicken: photo('1569058242253-92a9c755a0ec'),
	drumsticks: photo('1626082927389-6cd097cdc6ec'),
	bowl: photo('1546069901-ba9599a7e63c'),
	chickenPlate: photo('1598515214211-89d3c73ae83b'),
	grilledChicken: photo('1532550907401-a500c9a57435'),
	stirFry: photo('1604908176997-125f25cc6f3d'),
	thaiSpread: photo('1562565652-a0d8f0c59eb4'),
	friedRice: photo('1512058564366-18510be2db19'),
	ricePlate: photo('1603133872878-684f208fb84b'),
	friedNoodles: photo('1559314809-0d155014e29e'),
	stirNoodles: photo('1585032226651-759b368d7246'),
	noodleSoup: photo('1569718212165-3a8278d5f624'),
	ramen: photo('1557872943-16a5ac26437e'),
	chickenNoodleSoup: photo('1617093727343-374698b1b08d'),
	curry: photo('1455619452474-d2be8b1e70cd'),
	salad: photo('1512621776951-a57141f2eefd'),
	fish: photo('1580476262798-bddd9f4b7369'),
	beef: photo('1529692236671-f1f6cf9683ba'),
	egg: photo('1525351484163-7529414344d8'),
	fries: photo('1573080496219-bb080dd4f877'),
	skewers: photo('1541592106381-b31e9677c0e5'),
	toast: photo('1484723091739-30a097e8f929'),
	bread: photo('1509440159596-0249088772ff'),
	donut: photo('1551024601-bec78aea704b'),
	chocolateCake: photo('1578985545062-69928b1d9587'),
	brownie: photo('1606313564200-e75d5e30476c'),
	iceCream: photo('1497034825429-c343d7c6a68f'),
	fruit: photo('1490474418585-ba9bad8fd0ea'),
	bubbleTea: photo('1558857563-b371033873b8'),
	chocolateDrink: photo('1572490122747-3968b75cc699'),
	matcha: photo('1515823064-d6e0c04616a7'),
	icedTea: photo('1556679343-c7306c1976bc'),
	orangeJuice: photo('1600271886742-f049cd451bba'),
	smoothie: photo('1505252585461-04db1eb84625'),
	berrySmoothie: photo('1553530666-ba11a7da3888'),
	soda: photo('1513558161293-cdaf765ed2fd')
};

/** First match wins, so specific dishes come before broad words */
const FOOD: [RegExp, string][] = [
	[/บราวนี่/, P.brownie],
	[/เค้กช็อก/, P.chocolateCake],
	[/โดนัท/, P.donut],
	[/เค้ก/, P.bread],
	[/ขนมปัง/, P.toast],
	[/ไอศกรีม|ท็อปปิ้ง/, P.iceCream],
	[/ผลไม้/, P.fruit],
	[/เฟรนช์ฟราย|หอมทอด|เกี๊ยวทอด|ชีส$/, P.fries],
	[/ไก่ป๊อป|นักเก็ต|นิวออลีนส์/, P.drumsticks],
	// Dishes before ingredients: "ก๋วยเตี๋ยวลูกชิ้น" is noodles, "ข้าวผัดไส้กรอก" is fried rice
	[/ก๋วยเตี๋ยวไก่|ก๋วยเตี๋ยวแกงไก่|ต้มยำ/, P.chickenNoodleSoup],
	[/บะหมี่|เกี๊ยว(?!ห่อ)/, P.ramen],
	[/ก๋วยเตี๋ยว|เย็นตาโฟ|เกาเหลา|สุกี้/, P.noodleSoup],
	[/มาม่า|ผัดซีอิ๊ว|ผัดไทย/, P.stirNoodles],
	[/ข้าวผัด|กะปิ/, P.friedRice],
	[/กะเพรา|ตามสั่ง|คั่วกลิ้ง|กระเทียม|พริกไทยดำ/, P.stirFry],
	[/ลูกชิ้น|ปูอัด|เต้าหู้|ไส้กรอก|มินิสอด|เกี๊ยวห่อ|ฮอทดอก/, P.skewers],
	[/ปลา|ซาบะ/, P.fish],
	[/สลัด|กิมจิ/, P.salad],
	[/แกง|มัสมั่น|พะแนง|กะหรี่|กุรุม่า|สตู|เขียวหวาน/, P.curry],
	[/กับข้าว|หมูแดง|หมูกรอบ|หมูนึ่ง|หมูสับ/, P.thaiSpread],
	[/เนื้อ/, P.beef],
	[/ย่าง|เทอริยากิ|อบ/, P.grilledChicken],
	[/ทอด|บอนชอน|ทงคัตสึ|สามรส|ตีนไก่/, P.friedChicken],
	[/ไข่/, P.egg],
	[/ข้าวมันไก่|ข้าวหมก|ข้าวไก่|ไก่/, P.chickenPlate],
	[/ข้าว/, P.ricePlate]
];

const DRINK: [RegExp, string][] = [
	[/ชาเขียว/, P.matcha],
	[/โกโก้|ช็อกโกแลต|โอวัลติน|คาราเมล/, P.chocolateDrink],
	[/สตรอว์เบอร์รี่|แดงแมงลัก|แดงโซดา|กระเจี๊ยบ/, P.berrySmoothie],
	[/ส้ม|ฝรั่ง|สับปะรด/, P.orangeJuice],
	[/ปั่น/, P.smoothie],
	[/นม|ชาเย็น|ชาดำเย็น/, P.bubbleTea],
	[/โซดา|มะนาว|น้ำเปล่า|น้ำอัดลม|มะพร้าว/, P.soda],
	[/ชา|กาแฟ|เก๊กฮวย|ใบเตย|ลำไย|โอเลี้ยง|บัวบก|วุ้น/, P.icedTea]
];

const match = (rules: [RegExp, string][], name: string) => rules.find(([re]) => re.test(name))?.[1];

/** Menu sections that hold drinks; their items try drink photos first, so "นมสด" is milk, not food */
const DRINK_SECTION = /ดื่ม|โซดา|ปั่น|นมสด|ชา|สมุนไพร|น้ำ/;

/** Mockup photo for a menu item, chosen from its name and menu section */
export function mockMenuPhoto(name: string, section: string): string {
	const drink = DRINK_SECTION.test(section);
	return (drink ? (match(DRINK, name) ?? match(FOOD, name)) : (match(FOOD, name) ?? match(DRINK, name))) ?? (drink ? P.icedTea : P.bowl);
}
