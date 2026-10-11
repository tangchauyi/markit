#!/usr/bin/env python3
# promo_cards_en.py — English cards for the promo: pain card A, title card B, CTA card C (1080x1920 PNG)
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
FONT = '/System/Library/Fonts/SFNS.ttf'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'promo-cards-en')
os.makedirs(OUT, exist_ok=True)

def font(size):
    return ImageFont.truetype(FONT, size)

BG_LIGHT = (245, 244, 240)
INK = (30, 30, 34)
PINK = (250, 92, 141)
ORANGE = (251, 175, 93)
GRAY = (120, 120, 128)

def center_text(d, y, text, f, fill, ls=0):
    if ls == 0:
        bbox = d.textbbox((0, 0), text, font=f)
        w = bbox[2] - bbox[0]
        d.text(((W - w) / 2 - bbox[0], y), text, font=f, fill=fill)
        return
    widths = [d.textbbox((0, 0), ch, font=f)[2] for ch in text]
    total = sum(widths) + ls * (len(text) - 1)
    x = (W - total) / 2
    for ch, cw in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill)
        x += cw + ls

# ---------- Card A: three pain lines ----------
img = Image.new('RGB', (W, H), BG_LIGHT)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)
f_tag = font(52)
f_line = font(66)
center_text(d, 300, 'HOW YOU KEEP TRACK', f_tag, GRAY)
ys = [480, 800, 1120]
lines = ['Texts to yourself', 'Sticky notes everywhere', 'Notes apps you never open']
for y, t in zip(ys, lines):
    bbox = d.textbbox((0, 0), t, font=f_line)
    tw = bbox[2] - bbox[0]
    pad = 46
    x0 = (W - tw) / 2 - pad
    d.rounded_rectangle([x0, y - 40, x0 + tw + pad * 2, y + 130], radius=24,
                        fill=(255, 255, 255), outline=(225, 222, 214), width=3)
    center_text(d, y + 8, t, f_line, INK)
    ly = y + 150
    d.line([x0 + 60, ly, x0 + tw + pad * 2 - 60, ly], fill=PINK, width=8)
center_text(d, 1560, '—  Noted, but never seen again  —', font(46), GRAY)
img.save(f'{OUT}/card_a.png')

# ---------- Card B: NOTED = FORGOTTEN ----------
img = Image.new('RGB', (W, H), (24, 24, 28))
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)
center_text(d, 640, 'NOTED', font(150), (255, 255, 255), ls=30)
center_text(d, 900, '=', font(140), ORANGE)
center_text(d, 1120, 'FORGOTTEN', font(150), PINK, ls=30)
center_text(d, 1500, "It's not your memory — it sinks the moment you write it down", font(44), (170, 170, 178))
img.save(f'{OUT}/card_b.png')

# ---------- Card C: CTA ----------
img = Image.new('RGB', (W, H), BG_LIGHT)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=PINK)
lx, ly, ls_ = (W - 160) / 2, 430, 160
d.rounded_rectangle([lx, ly, lx + ls_, ly + ls_], radius=40, fill=PINK)
d.line([(lx + 40, ly + 85), (lx + 70, ly + 115), (lx + 122, ly + 48)],
       fill=(255, 255, 255), width=16, joint='curve')
center_text(d, 660, 'Mark it!', font(120), INK)
center_text(d, 830, 'A kanban board pinned to the corner of your screen', font(48), GRAY)
feats = ['No account · No cloud · No tracking',
         'Your notes never leave your Mac',
         'Mac only · Drag the dmg into Applications']
fy = 1080
for t in feats:
    center_text(d, fy, t, font(50), INK)
    fy += 120
center_text(d, 1560, 'Search markit on GitHub', font(56), PINK)
img.save(f'{OUT}/card_c.png')

print('cards saved:', sorted(os.listdir(OUT)))
