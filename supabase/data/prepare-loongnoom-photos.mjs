// Extract existing board artwork, without synthesizing product photos.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dataURL = new URL('./loongnoom_square.json', import.meta.url);
const data = JSON.parse(readFileSync(dataURL, 'utf8'));
const crops = [];
const add = (id, rect, codes = [id], shared = false) => crops.push({ id, rect, codes, shared });
const first = ['frozen-blueberry','frozen-cantaloupe','frozen-fuji','frozen-white-malt','frozen-fuji-white-white','frozen-pink-milk','frozen-corn-milk','frozen-extra-milo','frozen-x-tream'];
const firstRects = [[165,13,47,70],[224,13,43,70],[280,13,44,70],[340,13,43,70],[396,13,47,70],[450,13,45,70],[508,13,46,70],[565,13,46,70],[621,13,46,70]];
first.forEach((id,n) => add(id,firstRects[n]));
const second = ['frozen-black-white','frozen-pink-sky','frozen-taro','frozen-elsa','frozen-strawberry-yogurt','frozen-anna','frozen-mint','frozen-vanilla','frozen-mocha','frozen-banana','frozen-strawberry'];
const secondRects = [[44,112,41,62],[108,111,41,64],[164,111,43,63],[221,111,43,63],[282,111,41,63],[337,111,41,63],[394,111,42,63],[450,111,47,63],[512,111,41,63],[568,111,42,63],[625,111,46,63]];
second.forEach((id,n) => add(id,secondRects[n]));
const third = ['black-widow','chathai-frozen','extra-cocoa','strawberry-cream-cheese','dsi','brown-sugar-milk','cs'];
const thirdRects = [[401,216,39,59],[457,211,43,62],[512,211,45,62],[568,219,47,56],[629,211,44,62],[682,218,51,60],[739,220,51,56]];
third.forEach((id,n) => add(id,thirdRects[n]));
add('coffee',[988,58,55,74],data.sections[0].items.map(i=>i.code),true);
add('sticky-cocoa',[895,111,68,64],['sticky-cocoa-teen','sticky-cocoa-pro'],true);
add('milk-smoothies',[1163,51,56,80],['milk-caramel','milk-honey','milk-chocolate'],true);
add('smoothie-coconut',[1071,63,51,94]);
add('fruit-smoothies',[1241,107,111,75],['smoothie-orange','smoothie-watermelon','smoothie-strawberry','smoothie-pineapple','smoothie-carrot','smoothie-mixed-fruit'],true);
add('smoothie-strawberry-yogurt',[1443,68,69,90]);
add('italian-sodas',[1354,74,71,65],['soda-lychee','soda-blue-hawaii','soda-blueberry','soda-strawberry'],true);
const butter = ['original','slytherin','gryffindor','ravenclaw','hufflepuff','blueberry'];
butter.forEach((name,n)=>add(`butter-beer-${name}`,[890+n*52,200,49,70]));
add('thai-tea',[1234,195,59,63]);
add('cocoa',[1275,222,49,63]);
add('milk-tea',[1311,196,53,63]);
add('green-tea',[1350,222,53,63]);
add('white-malt',[1382,198,57,61]);
add('black-tea',[1418,223,59,63]);
add('waffle-banana',[204,229,45,36]);
add('waffle-almond',[251,229,45,36]);
add('waffle-chocolate',[298,229,44,36]);
add('waffle-strawberry',[343,229,43,36]);
add('waffle-assortment',[204,229,183,36],['waffle-blueberry','waffle-butter-milk','waffle-pandan'],true);
add('takoyaki',[78,232,88,70],data.sections.at(-1).items.map(i=>i.code),true);
const items = data.sections.flatMap(s=>s.items);
const byCode = new Map(items.map(i=>[i.code,i]));
const seen = new Set();
for (const crop of crops) {
  const [x,y,w,h]=crop.rect;
  assert(x>=0 && y>=0 && w>0 && h>0 && x+w<=1536 && y+h<=307);
  for(const code of crop.codes) {
    assert(byCode.has(code) && !seen.has(code), `Bad mapping: ${code}`);
    seen.add(code);
    byCode.get(code).imageUrl = `https://pguhzjtdwgualqeqzleu.supabase.co/storage/v1/object/public/store-banners/loongnoom-square/menu/${crop.id}.png`;
    byCode.get(code).imageKind = crop.shared ? 'shared-board-artwork' : 'individual-board-artwork';
  }
}
assert.equal(seen.size,87);
data.photoManifest = 'supabase/data/loongnoom_photos.json';
data.notes = data.notes.map(n => n.startsWith('รูปเครื่องดื่มและวาฟเฟิลใช้เป็นภาพรวมร้าน')
  ? 'รูปเมนูแยกจากป้ายต้นฉบับ ใช้ภาพหมวดร่วมกันเมื่อป้ายไม่ได้แสดงรูปเฉพาะรสชาติหรือชนิด ดู imageKind และ photoManifest'
  : n);
writeFileSync(dataURL,JSON.stringify(data,null,2)+'\n');
writeFileSync(new URL('./loongnoom_photos.json',import.meta.url), JSON.stringify({source:data.source,sourceSize:[1536,307],outputSize:256,crops},null,2)+'\n');
const q = value => `'${value.replaceAll("'", "''")}'`;
const photoSQL = `-- Existing shop: fill empty menu photos only, preserving all other fields.
-- Original source pixels and shared-photo mappings: loongnoom_photos.json.
begin;
do $photos$
declare updated_count integer;
begin
  update public.menu_items m set image_url = photos.image_url
  from (values
${items.map(i => `    (${q(data.store.id+'-'+i.code)}, ${q(i.imageUrl)})`).join(',\n')}
  ) as photos(id, image_url)
  where m.id = photos.id and m.store_id = ${q(data.store.id)}
    and coalesce(m.image_url, '') = '' and not m.archived;
  get diagnostics updated_count = row_count;
  if updated_count > 0 then
    insert into public.admin_log(actor_name, action, target_type, target_id, target_label, detail)
    values ('SQL import (Supabase CLI)', 'STORE_EDITED', 'store', ${q(data.store.id)}, ${q(data.store.name)},
      jsonb_build_object('note', 'Added original menu-board photos', 'menu_photos_added', updated_count,
        'source', ${q(data.source)}, 'photo_manifest', 'loongnoom_photos.json'));
  end if;
end
$photos$;
commit;
`;
writeFileSync(new URL('./loongnoom_menu_photos.sql', import.meta.url),photoSQL);
console.log(`Prepared ${crops.length} crops mapped to ${seen.size} menu entries.`);
