# -*- coding: utf-8 -*-
# make_subs_en.py — 11 English subtitle PNGs (rounded translucent black bar + white text, word wrap), 1080 canvas
from PIL import Image, ImageDraw, ImageFont
import os

FONT = "/System/Library/Fonts/SFNS.ttf"
texts = {
    1: "How do you keep track? Texts to yourself, sticky notes, apps you never open.",
    2: "And then you forget. It's not your memory — it's gone from view the moment you write it down.",
    3: "Mark it does one thing: it pins a kanban board to the corner of your screen. Write it down, and it stays in sight.",
    4: "Four quadrants sort urgent from important. See what to do first, at a glance.",
    5: "How fast is one note? Type, Enter, done.",
    6: "Want it in a certain quadrant? Double-click it. Just copied something? Hover and press Command-V.",
    7: "Hold and drag to move it between zones, or reorder within one.",
    8: "Done? Check it off. Not today? Let it sink. Mistake? Undo.",
    9: "In the way? Collapse it to a pill. One click back.",
    10: "It keeps your history too. Click the calendar to see what you did each day.",
    11: "No account, no cloud, no tracking. Your notes never leave your Mac. Search markit on GitHub, drag it in and go.",
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "promo-subs-en")
os.makedirs(OUT, exist_ok=True)
W_MAX, PAD_X, PAD_Y, GAP = 920, 36, 26, 12
for n, text in texts.items():
    fs = 44 if len(text) > 46 else 52
    font = ImageFont.truetype(FONT, fs)
    tmp = Image.new("RGB", (10, 10)); d = ImageDraw.Draw(tmp)
    # word-based wrap
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        trial = (cur + " " + w) if cur else w
        if d.textlength(trial, font=font) > W_MAX and cur:
            lines.append(cur); cur = w
        else:
            cur = trial
    if cur: lines.append(cur)
    lh = fs + 14
    wd = int(max(d.textlength(l, font=font) for l in lines)) + PAD_X * 2
    h = lh * len(lines) + (GAP * (len(lines) - 1) if len(lines) > 1 else 0) + PAD_Y * 2
    img = Image.new("RGBA", (wd, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle([0, 0, wd - 1, h - 1], radius=22, fill=(0, 0, 0, 158))
    y = PAD_Y
    for l in lines:
        lw = d.textlength(l, font=font)
        dr.text(((wd - lw) / 2, y), l, font=font, fill=(255, 255, 255, 255))
        y += lh + (GAP if len(lines) > 1 else 0)
    img.save(f"{OUT}/sub_{n}.png")
    print(n, img.size, len(lines), "line(s)")
