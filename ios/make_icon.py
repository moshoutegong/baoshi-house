# 生成 App 图标：从参考图里裁出站立的宝石，放在 1024 x 1024 的纸色底上。
# 由云端构建流程运行（需要 Pillow），在仓库根目录执行：python ios/make_icon.py
from PIL import Image

SRC = "assets/baoshi-stickers.webp"
OUT = "ios/App/Assets.xcassets/AppIcon.appiconset/icon.png"

src = Image.open(SRC).convert("RGB")
bird = src.crop((45, 540, 435, 1005))            # 第一张贴纸：站立的宝石
paper = src.getpixel((20, 480))                   # 取原图的纸色当底色

target_h = 900
bird = bird.resize((round(bird.width * target_h / bird.height), target_h), Image.LANCZOS)
icon = Image.new("RGB", (1024, 1024), paper)      # 图标不能带透明通道
icon.paste(bird, ((1024 - bird.width) // 2, (1024 - bird.height) // 2))
icon.save(OUT)
print("icon saved:", OUT, icon.size)
