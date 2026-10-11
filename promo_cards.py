#!/usr/bin/env python3
# promo_cards.py — 生成宣传片的片头痛点卡×2 与片尾 CTA 卡（1080×1920 PNG）
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'promo-cards')
os.makedirs(OUT, exist_ok=True)

def font(size, index=0):
    return ImageFont.truetype(FONT, size, index=index)

BG_LIGHT = (245, 244, 240)
INK = (30, 30, 34)
PINK = (250, 92, 141)
ORANGE = (251, 175, 93)
GRAY = (120, 120, 128)

def center_text(d, y, text, f, fill, ls=0):
    """水平居中绘制一行（支持字间距 ls）"""
    if ls == 0:
        bbox = d.textbbox((0, 0), text, font=f)
        w = bbox[2] - bbox[0]
        d.text(((W - w) / 2 - bbox[0], y), text, font=f, fill=fill)
        return bbox[3] - bbox[1]
    # 带字间距
    widths = [d.textbbox((0, 0), ch, font=f)[2] for ch in text]
    total = sum(widths) + ls * (len(text) - 1)
    x = (W - total) / 2
    for ch, cw in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill)
        x += cw + ls
    return 0

# ---------- 卡A：痛点三连（背景浅色，三行痛点文案） ----------
img = Image.new('RGB', (W, H), BG_LIGHT)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)          # 顶部品牌色条
f_tag = font(52)
f_line = font(76)
center_text(d, 300, '你的记事方式', f_tag, GRAY)
ys = [480, 800, 1120]
lines = ['发给自己的微信', '糊满壁纸的便签', '再没打开的备忘录']
for y, t in zip(ys, lines):
    # 每行一个"便签条"底
    bbox = d.textbbox((0, 0), t, font=f_line)
    tw = bbox[2] - bbox[0]
    pad = 46
    x0 = (W - tw) / 2 - pad
    d.rounded_rectangle([x0, y - 40, x0 + tw + pad * 2, y + 130], radius=24,
                        fill=(255, 255, 255), outline=(225, 222, 214), width=3)
    center_text(d, y + 8, t, f_line, INK)
    # 手绘感划线（粉橙渐变近似：三段）
    ly = y + 150
    d.line([x0 + 60, ly, x0 + tw + pad * 2 - 60, ly], fill=PINK, width=8)
center_text(d, 1560, '—— 记了，就等于没记 ——', font(46), GRAY)
img.save(f'{OUT}/card_a.png')

# ---------- 卡B：记了 = 忘了（大字题眼） ----------
img = Image.new('RGB', (W, H), (24, 24, 28))
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)
center_text(d, 640, '记  了', font(150), (255, 255, 255), ls=30)
center_text(d, 900, '=', font(140), ORANGE)
center_text(d, 1120, '忘  了', font(150), PINK, ls=30)
center_text(d, 1500, '不是记性差，是写完那一刻就沉底了', font(44), (170, 170, 178))
img.save(f'{OUT}/card_b.png')

# ---------- 卡C：CTA（品牌 + 下载信息） ----------
img = Image.new('RGB', (W, H), BG_LIGHT)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)
# logo：圆角方块 + 对勾
lx, ly, ls_ = (W - 160) / 2, 430, 160
d.rounded_rectangle([lx, ly, lx + ls_, ly + ls_], radius=40, fill=PINK)
d.line([(lx + 40, ly + 85), (lx + 70, ly + 115), (lx + 122, ly + 48)],
       fill=(255, 255, 255), width=16, joint='curve')
center_text(d, 660, 'Mark it!', font(120), INK)
center_text(d, 830, '钉在屏幕角落的四象限看板', font(48), GRAY)
feats = ['无账号 · 无联网 · 无埋点', '数据只存在你的 Mac 上', '仅 Mac · dmg 拖入即用']
fy = 1080
for t in feats:
    center_text(d, fy, t, font(50), INK)
    fy += 120
center_text(d, 1560, 'GitHub 搜 markit', font(56), PINK)
img.save(f'{OUT}/card_c.png')

print('cards saved:', os.listdir(OUT))
