# Mark it! 宣传片 · 双版本交付（2026-10-11）

## 最终交付物

| 版本 | 文件 | 时长 | 音轨 |
|------|------|------|------|
| 中文版（Tingting 配音） | `Mark it! 宣传片-中文版.mp4` | 69.23s | 69.73s AAC 48kHz ✓ |
| 英文版（Samantha 配音） | `Mark it! 宣传片-英文版.mp4` | 69.46s | 69.97s AAC 48kHz ✓ |

两版均为 1080×1920 竖屏、五段结构（痛点卡 → NOTED=FORGOTTEN → 过渡剧情 → 看板实操 45.4s → CTA 卡），11 段口播 + 逐句烧录字幕。

## 本次会话完成内容

1. **英文口播 + Samantha TTS 11 段**（`promo-tts-en/`）：翻译后逐句压入与中文版相同的时间窗，4 句二轮收紧（4.16/5.08/6.39/4.74/3.20/5.85/3.68/4.79/3.17/3.96/7.27s）。
2. **英文卡片 A/B/C**（`promo-cards-en/` + `promo-card-*-en.mp4`）与 **英文字幕 PNG**（`promo-subs-en/`，word-wrap 断行）。
3. **promo-seq-en.js 英化**：演出序列全英文，打字速度按字符数补偿（cps 8.5/12）保持与中文版逐拍对齐；`promo-demo.js` 加 `--seq=`/`--frames=` 参数，并改用**非持久化内存分区**（partition: demotake）杜绝上次演出残留笔记（本次踩坑：CN 旧数据曾混入 EN 画面）。
4. **UI 临时英化**：index.html 区标题×8/占位符/toast、app.js 空态文案/日历（October 2026 / M-T-W…），录制后已 `git checkout --` 还原源码。
5. **英文过渡段**（`transition-en.html` → `seg-transition-en.mp4` 5.4s）：IDE/聊天窗/看板快照全英文。
6. **合成器重构 v2（composite.swift）**：AVAssetExportSession（assetexportd XPC）在本机系统性故障（连 Passthrough 都失败、CN 复现失败），改为 **AVAssetWriter 直写管线**：视频逐段解码直通+字幕烧绘像素缓冲，音频 PCM 48k 立体声混音→AAC。音轨用 `requestMediaDataWhenReady` 与视频流穿插喂数（先写音频会死锁丢音轨）。
7. **中文版重合成**：发现 15:43 版音轨被故障 exportd 截断至 55.3s（line_10 尾部+line_11 缺失），已用新 composite 工具重合成修复（音轨完整 69.73s）。
8. **双版本验收通过**：11 个配音点位 RMS 全部有力（EN 5714-9041 / CN 3779-5344）；抽帧逐拍核对（卡片/过渡/贴纸闪/拖拽/删除撤销/胶囊/日历/CTA），中英节奏 1:1 对齐。

## 复现命令

```bash
npx electron promo-demo.js --offscreen --seq=promo-seq-en.js --frames=promo-frames-en   # 录看板段
./frames2video promo-frames-en seg-board-en.mp4 2500                                     # 编码（裁前2.5s建条阶段）
npx electron transition-demo.js transition-frames-en transition-en.html 5200             # 录过渡段
./frames2video transition-frames-en seg-transition-en.mp4
./composite plan-en.json "Mark it! 宣传片-英文版.mp4"                                     # 总合成（plan.json 驱动）
```

## 遗留说明

- `composite`（AVAssetWriter 版）为当前唯一可用合成器；`storyboard`（AVAssetExportSession 版）待系统 exportd 恢复后仍可复用。
- promo-seq-en.js 中 `Order mom's birthday cake` 与 `Book a meeting room for Lily` 的 P3 显示顺序与中文版相反（同为毫秒级 createdAt 平局排序差异），不影响叙事。
