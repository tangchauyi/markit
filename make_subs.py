# -*- coding: utf-8 -*-
# 生成 11 张字幕 PNG（圆角半透明黑底 + 白字，自动换行），1080 宽画布
from PIL import Image, ImageDraw, ImageFont
import math, os

FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
texts = {
    1: "你是不是也这样记事——发给自己的微信、桌面便签、备忘录",
    2: "然后记了就忘。不是记性差，是你写完的那一刻，它就沉底了",
    3: "Mark it 把看板钉死在屏幕角落，写下来，就永远看得见",
    4: "四个象限分轻重缓急，一眼看清今天先做什么",
    5: "记一条多快？打字，回车，完事",
    6: "想记进哪个象限？双击它。刚复制的文字？悬停 ⌘V",
    7: "长按一拖，换区、排序，松手即落",
    8: "做完打勾，不想干沉底，删错？撤销还在",
    9: "碍事就收成一颗胶囊，戳一下就回来",
    10: "它还替你记着，每天干过什么，点日历就能回看",
    11: "无账号无联网无埋点，笔记只在你 Mac 上 · GitHub 搜 markit",
}
W_MAX, PAD_X, PAD_Y, GAP = 920, 36, 26, 12
for n, text in texts.items():
    fs = 48 if len(text) > 18 else 56
    font = ImageFont.truetype(FONT, fs)
    tmp = Image.new("RGB", (10, 10)); d = ImageDraw.Draw(tmp)
    # 逐字累积换行
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > W_MAX and cur:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur: lines.append(cur)
    lh = fs + 14
    w = int(max(d.textlength(l, font=font) for l in lines)) + PAD_X * 2
    h = lh * len(lines) + (GAP * (len(lines)-1) if len(lines) > 1 else 0) + PAD_Y * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle([0, 0, w-1, h-1], radius=22, fill=(0, 0, 0, 158))
    y = PAD_Y
    for l in lines:
        lw = d.textlength(l, font=font)
        dr.text(((w - lw) / 2, y), l, font=font, fill=(255, 255, 255, 255))
        y += lh + (GAP if len(lines) > 1 else 0)
    img.save(f"promo-subs/sub_{n}.png")
    print(n, img.size, len(lines), "line(s)")
