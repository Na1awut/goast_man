"""Build route_benchmark.ipynb: a self-contained Colab notebook.

It embeds the current planner and benchmark sources, so Colab needs no
clone and no GitHub access. Re-run after changing the planner:

    python bench/routing/make_notebook.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_name("route_benchmark.ipynb")

# Only files Node actually loads; type-only imports (places.ts, types) are stripped
FILES = [
    "frontend/src/lib/routing/cost.ts",
    "frontend/src/lib/routing/planner.ts",
    "bench/package.json",
    "bench/routing/bench.ts",
    "bench/routing/ortools_compare.py",
]

INTRO = """# Goose Man: ทดสอบประสิทธิภาพตัวจัดเส้นทาง

รันบน Colab เพื่อไม่ให้กินแรมเครื่อง: **Runtime → Run all** ใช้เวลาประมาณ 5 นาที

| ส่วน | วัดอะไร |
|---|---|
| A | `planRoute` ใช้เวลาเท่าไร เมื่อคนหิ้วถือ 1-6 ออเดอร์ |
| B | `suggestAddOns` ใช้เวลาเท่าไร เมื่อมีงานเปิดรอ 10-200 งาน |
| C | รับหลายงานในรอบเดียว ประหยัดเวลาเท่าไร เทียบกับส่งทีละงาน |
| D | เทียบคุณภาพเส้นทางกับ OR-Tools (ตัวแก้โจทย์ใน `rout_hack/03`) บนโจทย์ชุดเดียวกัน |

แคมปัสในการทดสอบเป็นแบบจำลองเดียวกับ `rout_hack/03` (พื้นที่ 800 ม., ร้านรวมกลุ่มรอบโรงอาหาร, ตึก 1-12 ชั้น)
ไม่ใช่แผนที่ มจธ. จริง ตัวเลขความเร็วจึงใช้ได้ แต่ตัวเลขเวลาเดินจริงต้องรอแผนที่

สร้างโดย `bench/routing/make_notebook.py` อย่าแก้โค้ดในโน้ตบุ๊กนี้ตรงๆ ให้แก้ใน repo แล้วสร้างใหม่"""

SETUP_NODE = """%%bash
# Node ≥ 22.6 runs TypeScript directly (type stripping)
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=6)?0:1)" 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  apt-get install -y nodejs > /dev/null
fi
node -v"""

READING = """## อ่านผลอย่างไร

- **A:** ชุดทดสอบนี้ตั้งให้คนหิ้วถือได้ไม่เกิน 4 ออเดอร์ จึงดูแถว 1-4 เป็นหลัก (แถว 5-6 มีไว้ดูว่าเริ่มช้าตรงไหน) ถ้าต่ำกว่า 16 ms ผู้ใช้จะไม่รู้สึกว่ารอ
- **B:** `avg suggestions` คือจำนวนงานที่ผ่านเกณฑ์ "เพิ่มเวลาไม่เกิน 5 นาที" ถ้าเยอะมาก หน้าจอควรแสดงแค่ 3 อันดับแรก
- **C:** `rider done sooner` = คนหิ้วเสร็จเร็วขึ้นกี่ % เมื่อรับรวมรอบเดียว ส่วน `avg customer wait` ใช้ดูว่าลูกค้าต้องรอนานขึ้นหรือเปล่า
- **D:** `OR-Tools shorter` และ `only OR-Tools found` ต้องเป็น 0 ทุกแถว ถ้าไม่ใช่ แปลว่าตัวจัดเส้นทางมีบั๊ก
  `only ours found` ไม่ใช่บั๊ก แปลว่า OR-Tools หาคำตอบไม่ทันเวลาที่ให้ (ลองเพิ่ม `--time-limit`)"""


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": text.splitlines(keepends=True)}


def main():
    dirs = sorted({str(Path("/content/goose", f).parent).replace("\\", "/") for f in FILES})
    cells = [
        md(INTRO),
        md("## 1. เตรียมเครื่อง"),
        code(SETUP_NODE),
        code("!pip install -q ortools"),
        code("!mkdir -p " + " ".join(dirs)),
        md("## 2. โค้ดจาก repo"),
    ]
    # The real frontend/package.json marks its .ts files as ES modules; without it Node
    # reads planner.ts as CommonJS and finds no exports
    cells.append(code('%%writefile /content/goose/frontend/package.json\n{ "private": true, "type": "module" }\n'))
    for f in FILES:
        src = (ROOT / f).read_text(encoding="utf-8")
        cells.append(code(f"%%writefile /content/goose/{f}\n{src}"))
    cells += [
        md("## 3. รันทดสอบ (A-C และส่งออกโจทย์ให้ D)"),
        code("%cd /content/goose\n!node --experimental-strip-types --no-warnings bench/routing/bench.ts"),
        md("## 4. เทียบกับ OR-Tools (D)"),
        code("!python bench/routing/ortools_compare.py --time-limit 1"),
        md(READING),
    ]
    nb = {
        "cells": cells,
        "metadata": {"colab": {"provenance": []}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4,
        "nbformat_minor": 0,
    }
    OUT.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(cells)} cells)")


if __name__ == "__main__":
    main()
