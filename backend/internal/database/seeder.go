package database

import (
	"log"

	"kmutt-delivery-backend/internal/domain"

	"gorm.io/gorm"
)

func SeedLocationHubs(db *gorm.DB) error {
	var count int64
	db.Model(&domain.LocationHub{}).Count(&count)
	if count > 0 {
		log.Println("ℹ️ ข้อมูลจุดรับ-ส่ง และร้านค้า Mod Man มีอยู่ในฐานข้อมูลแล้ว ข้ามขั้นตอน Seeder")
		return nil
	}

	log.Println("🌱 กำลังลงข้อมูลตั้งต้นจุดรับ-ส่ง และ 14 ร้านค้าจริง มจธ. บางมด (Mod Man Seeder)...")

	// === 1. LOCATION HUBS ===
	hubs := []domain.LocationHub{
		// === จุดรับสินค้า (PICKUP HUBS) ===
		{
			Name:        "ใต้หอหญิง S6 บ้านธรรมรักษา 1",
			Code:        "HUB-PICKUP-S6-FEMALE-DORM",
			Building:    "อาคารหอพักนักศึกษาหญิง S6",
			Floor:       "ชั้น 1 (ใต้หอ)",
			Zone:        domain.ZoneDorm,
			HubType:     domain.HubTypePickup,
			Description: "ศูนย์รวมร้านอาหารตามสั่ง ข้าวแกงปักษ์ใต้ แฮมเบอร์เกอร์ และร้านน้ำใต้หอหญิง",
			IsActive:    true,
		},
		{
			Name:        "ใต้หอชาย S5 บ้านธรรมรักษา 2",
			Code:        "HUB-PICKUP-S5-MALE-DORM",
			Building:    "อาคารหอพักนักศึกษาชาย S5",
			Floor:       "ชั้น 1 (ใต้หอ)",
			Zone:        domain.ZoneDorm,
			HubType:     domain.HubTypePickup,
			Description: "ร้านสเต็ก ส้มตำแซ่บ และร้านน้ำวิภาวรรณ ขวัญใจชาวหอชาย",
			IsActive:    true,
		},
		{
			Name:        "อาคารเรียนรวม 1 (CB1)",
			Code:        "HUB-PICKUP-CB1",
			Building:    "อาคารเรียนรวม N20 (CB1)",
			Floor:       "ชั้น 1",
			Zone:        domain.ZoneAcademic,
			HubType:     domain.HubTypePickup,
			Description: "ร้านลุงหนุ่มเครื่องดื่มในตำนาน และซุ้มกาแฟสดพี่หมี",
			IsActive:    true,
		},
		{
			Name:        "อาคารเรียนรวม 5 (CB5)",
			Code:        "HUB-PICKUP-CB5",
			Building:    "อาคารเรียนรวม S11 (CB5)",
			Floor:       "ชั้น 1",
			Zone:        domain.ZoneAcademic,
			HubType:     domain.HubTypePickup,
			Description: "ร้านลุงกบ เครื่องดื่มชื่นใจ และอาหารตามสั่งจานด่วน",
			IsActive:    true,
		},
		{
			Name:        "Green Canteen (อาคาร 190 ปี)",
			Code:        "HUB-PICKUP-GREEN-CANTEEN",
			Building:    "อาคาร S14 (190 ปี)",
			Floor:       "ชั้น 1",
			Zone:        domain.ZoneCanteen,
			HubType:     domain.HubTypePickup,
			Description: "โรงอาหารติดแอร์ ข้าวมันไก่ 5 โต๊ะกลม นมสดธนพร และขนมทานเล่น",
			IsActive:    true,
		},

		// === จุดส่งสินค้า (DROPOFF HUBS) ===
		{
			Name:        "อาคารเรียนรวม CB1",
			Code:        "HUB-DROPOFF-CB1",
			Building:    "อาคาร CB1",
			Floor:       "จุดนัดรับ หน้าลิฟต์ ชั้น 1",
			Zone:        domain.ZoneAcademic,
			HubType:     domain.HubTypeDropoff,
			Description: "จุดนัดรับอาหาร/ของ หน้าโถงลิฟต์ชั้น 1 อาคาร CB1",
			IsActive:    true,
		},
		{
			Name:        "อาคารเรียนรวม CB2",
			Code:        "HUB-DROPOFF-CB2",
			Building:    "อาคาร CB2",
			Floor:       "จุดนัดรับ หน้าลิฟต์ ชั้น 1 / ม้าหินอ่อน",
			Zone:        domain.ZoneAcademic,
			HubType:     domain.HubTypeDropoff,
			Description: "จุดนัดรับอาหาร/ของ บริเวณลานม้าหินอ่อน อาคาร CB2",
			IsActive:    true,
		},
		{
			Name:        "อาคารเรียนรวม CB3",
			Code:        "HUB-DROPOFF-CB3",
			Building:    "อาคาร CB3",
			Floor:       "จุดนัดรับ ใต้ถุนตึก CB3",
			Zone:        domain.ZoneAcademic,
			HubType:     domain.HubTypeDropoff,
			Description: "จุดนัดรับอาหาร บริเวณใต้ถุนอาคาร CB3",
			IsActive:    true,
		},
		{
			Name:        "อาคารการเรียนรู้ LX Building",
			Code:        "HUB-DROPOFF-LX",
			Building:    "อาคาร LX Building",
			Floor:       "ชั้น 1 หน้าตู้เต่าบิน",
			Zone:        domain.ZoneOffice,
			HubType:     domain.HubTypeDropoff,
			Description: "จุดนัดรับยอดฮิต หน้าตู้เต่าบิน ชั้น 1 อาคาร LX",
			IsActive:    true,
		},
		{
			Name:        "อาคารเทคโนโลยีสารสนเทศ (SIT)",
			Code:        "HUB-DROPOFF-SIT",
			Building:    "อาคาร SIT",
			Floor:       "ชั้น 1 หน้าห้องโถง",
			Zone:        domain.ZoneOffice,
			HubType:     domain.HubTypeDropoff,
			Description: "จุดนัดรับสำหรับนักศึกษาคณะ SIT ชั้น 1",
			IsActive:    true,
		},
	}

	for i := range hubs {
		if err := db.Create(&hubs[i]).Error; err != nil {
			log.Printf("⚠️ ไม่สามารถบันทึก LocationHub %s: %v\n", hubs[i].Name, err)
			return err
		}
	}

	// Map hub IDs by code
	hubMap := make(map[string]domain.LocationHub)
	for _, h := range hubs {
		hubMap[h.Code] = h
	}

	// === 2. 14 REAL PARTNER STORES & MENU ITEMS SEED DATA ===
	type SeedMenuItem struct {
		Name        string
		Price       float64
		Description string
	}

	type SeedStoreData struct {
		HubCode     string
		Name        string
		Category    string
		Description string
		MenuItems   []SeedMenuItem
	}

	storesData := []SeedStoreData{
		// === โซนที่ 1: ใต้หอหญิง S6 บ้านธรรมรักษา 1 ===
		{
			HubCode:     "HUB-PICKUP-S6-FEMALE-DORM",
			Name:        "ร้านแม่น้องพั้นช์ (อาหารตามสั่งยอดฮิต)",
			Category:    "อาหารตามสั่ง",
			Description: "อาหารตามสั่งรสเด็ด ขวัญใจชาวหอพัก ปริมาณจัดเต็ม",
			MenuItems: []SeedMenuItem{
				{Name: "ข้าวกะเพราหมูกรอบ", Price: 55, Description: "หมูกรอบผัดกะเพราเข้มข้น รสชาติจัดจ้าน"},
				{Name: "ข้าวหมูกระเทียม", Price: 50, Description: "หมูหมักนุ่มผัดกระเทียมพริกไทย หอมอร่อย"},
				{Name: "ผัดพริกแกงหมูชิ้น", Price: 50, Description: "พริกแกงใต้เข้มข้น ผัดใส่ถั่วฝักยาว"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S6-FEMALE-DORM",
			Name:        "ร้านลุงชิกกี้ (อาหารตามสั่ง)",
			Category:    "อาหารตามสั่ง",
			Description: "เมนูหลากหลาย ข้าวผัด ต้มยำ ผัดซีอิ๊ว ทำสดใหม่ทุกจาน",
			MenuItems: []SeedMenuItem{
				{Name: "ข้าวผัดต้มยำทะเล", Price: 55, Description: "ข้าวผัดเครื่องต้มยำ กุ้งและปลาหมึกสด"},
				{Name: "ผัดซีอิ๊วหมู", Price: 50, Description: "เส้นใหญ่นุ่มผัดซีอิ๊วหอมกลิ่นกระทะ"},
				{Name: "ข้าวไข่เจียวทรงเครื่อง", Price: 40, Description: "ไข่เจียวฟูกรอบ ใส่หมูสับและหอมใหญ่"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S6-FEMALE-DORM",
			Name:        "ข้าวแกงปักษ์ใต้ อ.ปากพนัง นครศรี",
			Category:    "ข้าวแกง",
			Description: "ข้าวแกงใต้รสจัดจ้าน ต้นตำรับจากนครศรีธรรมราช",
			MenuItems: []SeedMenuItem{
				{Name: "คั่วกลิ้งหมู+ไข่พะโล้", Price: 55, Description: "คั่วกลิ้งหมูรสเผ็ดจัดจ้าน แกล้มไข่พะโล้หวานนุ่ม"},
				{Name: "แกงไตปลา", Price: 50, Description: "แกงไตปลาทรงเครื่อง ใส่เนื้อปลาชะอมและผักรวม"},
				{Name: "หมูหวาน", Price: 45, Description: "หมูสามชั้นเคี่ยวซอสหวานกลมกล่อม"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S6-FEMALE-DORM",
			Name:        "ร้าน Mr.Moustache",
			Category:    "ฟาสต์ฟู้ด / ทานเล่น",
			Description: "เบอร์เกอร์ เฟรนช์ฟรายส์ และแซนวิชสไตล์โฮมเมด",
			MenuItems: []SeedMenuItem{
				{Name: "แฮมเบอร์เกอร์หมูชีส", Price: 59, Description: "เบอร์เกอร์หมูนุ่มเยิ้มด้วยเชดด้าชีสแท้"},
				{Name: "เฟรนช์ฟรายส์ชีส", Price: 45, Description: "มันฝรั่งทอดกรอบราดซอสชีสเข้มข้น"},
				{Name: "แซนวิชโบราณ", Price: 35, Description: "แซนวิชโบราณไส้โบโลน่าและหมูหยองราดน้ำสลัดฉ่ำๆ"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S6-FEMALE-DORM",
			Name:        "ร้านน้ำหอหญิง",
			Category:    "เครื่องดื่ม",
			Description: "ชา โกโก้ และสมูทตี้ผลไม้สด ชื่นใจ ดับร้อน",
			MenuItems: []SeedMenuItem{
				{Name: "ชาไทยเย็นโบราณ", Price: 30, Description: "ชาไทยเข้มข้นหอมมัน นมสดแท้"},
				{Name: "ชาเขียวนมสด", Price: 30, Description: "ชาเขียวมะลิผสมนมสด หวานกำลังดี"},
				{Name: "สตรอว์เบอร์รีสมูทตี้", Price: 40, Description: "สตรอว์เบอร์รีปั่นเนื้อละเอียด เปรี้ยวหวานสดชื่น"},
			},
		},

		// === โซนที่ 2: ใต้หอชาย S5 บ้านธรรมรักษา 2 ===
		{
			HubCode:     "HUB-PICKUP-S5-MALE-DORM",
			Name:        "ร้านสเต็ก ใต้หอชาย",
			Category:    "สเต็ก",
			Description: "สเต็กจานใหญ่ อิ่มคุ้ม สปาเก็ตตี้ซอสเข้มข้น",
			MenuItems: []SeedMenuItem{
				{Name: "สเต็กไก่สไปซี่", Price: 69, Description: "อกไก่หมักพริกสไปซี่ ย่างหอมๆ พร้อมเฟรนช์ฟรายส์"},
				{Name: "สเต็กหมูพริกไทยดำ", Price: 79, Description: "สันคอหมูนุ่มราดซอสพริกไทยดำเข้มข้น"},
				{Name: "สปาเก็ตตี้ขี้เมา", Price: 55, Description: "สปาเก็ตตี้ผัดขี้เมาหมูสับ เผ็ดร้อนสมุนไพร"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S5-MALE-DORM",
			Name:        "ส้มตำ ใต้หอชาย",
			Category:    "อาหารอีสาน",
			Description: "ส้มตำ คอหมูย่าง ลาบ อีสานแท้รสแซ่บ",
			MenuItems: []SeedMenuItem{
				{Name: "ส้มตำไทยไข่เค็ม", Price: 50, Description: "ส้มตำไทยเปรี้ยวหวาน โรยไข่เค็มและกุ้งแห้ง"},
				{Name: "ส้มตำคอหมูย่าง", Price: 60, Description: "ตำปลาร้าคอหมูย่างนุ่มๆ รสแซ่บสะใจ"},
				{Name: "ลาบหมู", Price: 50, Description: "ลาบหมูสับใส่ข้าวคั่วหอมๆ พริกป่นเผ็ดกำลังดี"},
				{Name: "ข้าวเหนียว", Price: 10, Description: "ข้าวเหนียวนึ่งนุ่ม ห่อละ 10 บาท"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-S5-MALE-DORM",
			Name:        "ร้านน้ำ วิภาวรรณ ใต้หอชาย",
			Category:    "เครื่องดื่ม",
			Description: "นมสด โกโก้ มะนาวโซดา ดับกระหายยามดึก",
			MenuItems: []SeedMenuItem{
				{Name: "นมสดเย็น", Price: 30, Description: "นมสดแท้ 100% หอมมันหวานน้อย"},
				{Name: "โกโก้ดาร์กช็อก", Price: 35, Description: "โกโก้เข้มข้นดาร์กช็อกโกแลตสะใจ"},
				{Name: "มะนาวโซดา", Price: 30, Description: "น้ำมะนาวแท้ผสมโซดา เปรี้ยวซ่าดับร้อน"},
			},
		},

		// === โซนที่ 3: อาคารเรียนรวม 1 (N20 - CB1) ===
		{
			HubCode:     "HUB-PICKUP-CB1",
			Name:        "ร้านลุงหนุ่ม (เครื่องดื่มในตำนาน คิวยาวที่สุดใน มจธ.)",
			Category:    "เครื่องดื่ม",
			Description: "ร้านน้ำในตำนาน มจธ. ชาเนสที โอวัลตินภูเขาไฟ คิวยาวแต่รอคุ้ม",
			MenuItems: []SeedMenuItem{
				{Name: "ชาเนสทีนมสด", Price: 30, Description: "เมนูในตำนาน ชาเนสทีเข้มข้นผสมนมสด"},
				{Name: "ชาเขียวลุงหนุ่ม", Price: 30, Description: "ชาเขียวสูตรเฉพาะของลุงหนุ่ม หอมชื่นใจ"},
				{Name: "โอวัลตินภูเขาไฟ", Price: 35, Description: "โอวัลตินเย็นท็อปด้วยผงโอวัลตินล้นแก้ว"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-CB1",
			Name:        "ซุ้มร้านพี่หมี กาแฟสด",
			Category:    "กาแฟสด & ชา",
			Description: "กาแฟสดคั่วบดใหม่ เอสเพรสโซ่ มัทฉะลาเต้ เข้มข้น",
			MenuItems: []SeedMenuItem{
				{Name: "เอสเพรสโซ่เย็นเข้มข้น", Price: 40, Description: "กาแฟสดคั่วเข้ม ตาพรางพร้อมตื่นเรียน"},
				{Name: "อเมริกาโน่น้ำผึ้งแท้", Price: 45, Description: "กาแฟดำผสมน้ำผึ้งแท้ หวานหอมธรรมชาติ"},
				{Name: "มัทฉะลาเต้", Price: 45, Description: "มัทฉะเกรดพรีเมียมจากญี่ปุ่น ชงใส่นมสด"},
			},
		},

		// === โซนที่ 4: อาคารเรียนรวม 5 (S11 - CB5) ===
		{
			HubCode:     "HUB-PICKUP-CB5",
			Name:        "ร้านลุงกบ (เครื่องดื่ม & ตามสั่งจานด่วน)",
			Category:    "อาหาร & เครื่องดื่ม",
			Description: "อาหารตามสั่งด่วนทันใจ ชาดำเย็น ชามะนาว ชื่นใจ",
			MenuItems: []SeedMenuItem{
				{Name: "ข้าวกะเพราไก่ไข่ดาว", Price: 45, Description: "กะเพราไก่สับราดข้าว พร้อมไข่ดาวดาวกรอบ"},
				{Name: "ชาดำเย็น", Price: 25, Description: "ชาดำโบราณ หวานเย็นสดชื่น"},
				{Name: "ชามะนาว", Price: 30, Description: "ชาดำผสมน้ำมะนาวเปรี้ยวหวานลงตัว"},
			},
		},

		// === โซนที่ 5: อาคารพระจอมเกล้าราชานุสรณ์ 190 ปี (S14 - Green Canteen) ===
		{
			HubCode:     "HUB-PICKUP-GREEN-CANTEEN",
			Name:        "ร้าน 5 โต๊ะกลม ข้าวมันไก่",
			Category:    "ข้าวมันไก่",
			Description: "ข้าวมันไก่ตอน ข้าวมันไก่ทอด น้ำจิ้มเต้าเจี้ยวรสเด็ด",
			MenuItems: []SeedMenuItem{
				{Name: "ข้าวมันไก่ผสมต้ม+ทอด", Price: 50, Description: "ข้าวมันนุ่มๆ เสิร์ฟพร้อมไก่ตอนและไก่ทอดกรอบ"},
				{Name: "ข้าวมันไก่ตอนเนื้อน่อง", Price: 45, Description: "เนื้อน่องฉ่ำนุ่ม น้ำซุปฟักร้อนๆ"},
				{Name: "ไก่สับจานใหญ่", Price: 80, Description: "ไก่ตอนสับจานใหญ่ พร้อมน้ำจิ้มและแตงกวา"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-GREEN-CANTEEN",
			Name:        "ร้าน 1 ธนพร นมสด",
			Category:    "เครื่องดื่ม & ขนมปัง",
			Description: "นมสดร้อน นมชมพู และปังปิ้งเนยนมราดฉ่ำๆ",
			MenuItems: []SeedMenuItem{
				{Name: "นมสดร้อน", Price: 25, Description: "นมสดอุ่นๆ หอมละมุน เสิร์ฟแก้วร้อน"},
				{Name: "นมชมพูเย็น", Price: 30, Description: "นมสดผสมเฮลบลูบอยสีชมพู หวานหอมกลมกล่อม"},
				{Name: "ปังปิ้งเนยนมน้ำตาล", Price: 25, Description: "ขนมปังปิ้งเตาถ่านกรอบนอกนุ่มใน ราดเนยนม"},
			},
		},
		{
			HubCode:     "HUB-PICKUP-GREEN-CANTEEN",
			Name:        "ร้านอาหารทานเล่น ขนมทานว่าง",
			Category:    "ขนม & ทานเล่น",
			Description: "เกี๊ยวซ่า ขนมจีบ ซาลาเปาร้อนๆ รองท้องระหว่างวัน",
			MenuItems: []SeedMenuItem{
				{Name: "เกี๊ยวซ่าทอด", Price: 40, Description: "เกี๊ยวซ่าไส้หมูทอดกรอบ 5 ชิ้น พร้อมน้ำจิ้มพอนสึ"},
				{Name: "ขนมจีบหมูชุดละ", Price: 35, Description: "ขนมจีบหมูแน่นๆ 5 ลูก โรยกระเทียมเจียว"},
				{Name: "ซาลาเปาหมูสับไข่เค็ม", Price: 20, Description: "ซาลาเปานึ่งร้อน แป้งนุ่มไส้หมูสับไข่เค็มแน่นๆ"},
			},
		},
	}

	totalStores := 0
	totalItems := 0

	for _, sd := range storesData {
		parentHub, exists := hubMap[sd.HubCode]
		if !exists {
			log.Printf("⚠️ ไม่พบ LocationHub สำหรับ Code: %s\n", sd.HubCode)
			continue
		}

		store := domain.Store{
			LocationID:  parentHub.ID,
			Name:        sd.Name,
			Category:    sd.Category,
			Description: sd.Description,
			IsOpen:      true,
		}

		if err := db.Create(&store).Error; err != nil {
			log.Printf("⚠️ ไม่สามารถสร้าง Store %s: %v\n", store.Name, err)
			continue
		}
		totalStores++

		for _, mi := range sd.MenuItems {
			item := domain.MenuItem{
				StoreID:     store.ID,
				Name:        mi.Name,
				Price:       mi.Price,
				Description: mi.Description,
				IsAvailable: true,
			}
			if err := db.Create(&item).Error; err != nil {
				log.Printf("⚠️ ไม่สามารถสร้าง MenuItem %s: %v\n", item.Name, err)
			} else {
				totalItems++
			}
		}
	}

	log.Printf("✅ Seed ข้อมูล Mod Man สำเร็จทั้งหมด: %d LocationHubs, %d ร้านค้าพาร์ทเนอร์, %d เมนูอาหาร\n", len(hubs), totalStores, totalItems)
	return nil
}
