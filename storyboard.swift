// storyboard.swift — Mark it! 宣传片总合成（plan.json 驱动，支持任意段数/双语）
// 用法: storyboard <plan.json> <out.mp4>
// plan.json: {
//   "segments": ["a.mp4", "b.mp4", ...],            // 顺序拼接的视频段
//   "voices":   [{"line":1,"seg":0,"offset":0.25}], // line_N.m4a 放在第 seg 段起点+offset
//   "ttsDir":   "promo-tts",                        // 配音目录
//   "subsDir":  "promo-subs"                        // 字幕 PNG 目录（sub_N.png）
// }
import AVFoundation
import AppKit
import CoreMedia
import Foundation

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: storyboard <plan.json> <out.mp4>"); exit(1) }
let planPath = a[1], outPath = a[2]

struct Plan: Decodable {
    let segments: [String]
    let voices: [Voice]
    let ttsDir: String
    let subsDir: String
    struct Voice: Decodable {
        let line: Int
        let seg: Int
        let offset: Double
    }
}
let plan = try! JSONDecoder().decode(Plan.self, from: Data(contentsOf: URL(fileURLWithPath: planPath)))

func asset(_ p: String) -> AVURLAsset { AVURLAsset(url: URL(fileURLWithPath: p)) }
func duration(_ p: String) -> Double {
    let aset = asset(p)
    let sem = DispatchSemaphore(value: 0)
    var d = 0.0
    aset.loadValuesAsynchronously(forKeys: ["duration"]) {
        d = CMTimeGetSeconds(aset.duration); sem.signal()
    }
    sem.wait()
    return d
}

// ---- 段时长与段起点 ----
var segDurs: [Double] = []
for p in plan.segments { segDurs.append(duration(p)) }
print("durations: \(segDurs.map { String(format: "%.2f", $0) }.joined(separator: " "))")
var segStarts: [Double] = []
var acc = 0.0
for d in segDurs { segStarts.append(acc); acc += d }
let total = acc
print("total: \(String(format: "%.2f", total))s")

let comp = AVMutableComposition()
// ---- 视频轨拼接 ----
let vtrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
var cursor = CMTime.zero
for p in plan.segments {
    let src = asset(p)
    guard let vt = src.tracks(withMediaType: .video).first else { print("no video track in \(p)"); exit(3) }
    try! vtrack.insertTimeRange(CMTimeRange(start: .zero, duration: vt.asset!.duration), of: vt, at: cursor)
    cursor = CMTimeAdd(cursor, vt.asset!.duration)
}

// ---- 音轨：TTS 按（段起点+offset）放置 ----
let atrack = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
var subs: [(Int, Double, Double)] = []
for v in plan.voices {
    let p = "\(plan.ttsDir)/line_\(v.line).m4a"
    let src = asset(p)
    guard let at2 = src.tracks(withMediaType: .audio).first else { print("no audio \(p)"); continue }
    let d = at2.asset!.duration
    let at = segStarts[v.seg] + v.offset
    try! atrack.insertTimeRange(CMTimeRange(start: .zero, duration: d), of: at2, at: CMTime(seconds: at, preferredTimescale: 600))
    let ds = CMTimeGetSeconds(d)
    subs.append((v.line, at, at + ds))
    print("voice line_\(v.line) @\(String(format: "%.1f", at)) dur \(String(format: "%.1f", ds))s")
}

// ---- 字幕层（预渲染 PNG 贴图 + 逐条显隐） ----
let parent = CALayer()
parent.frame = CGRect(x: 0, y: 0, width: 1080, height: 1920)
let videoLayer = CALayer()
videoLayer.frame = parent.frame
parent.addSublayer(videoLayer)

func addSubtitle(_ n: Int, _ start: Double, _ end: Double) {
    let p = "\(plan.subsDir)/sub_\(n).png"   // PIL 预渲染字幕（底条+文字一体，规避 CATextLayer 导出不渲染）
    guard let img = NSImage(contentsOfFile: p),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("WARN: no sub image \(p)"); return
    }
    let container = CALayer()
    container.frame = CGRect(x: (1080 - cg.width) / 2, y: 110, width: cg.width, height: cg.height)
    container.contents = cg
    container.contentsScale = 1

    // 每条字幕独立时间窗：beginTime=显始，duration=窗长（导出工具时间轴=视频时间轴）
    let anim = CAKeyframeAnimation(keyPath: "opacity")
    anim.duration = max(0.1, end - start)
    anim.beginTime = start
    anim.isRemovedOnCompletion = false
    anim.fillMode = .both
    anim.keyTimes = [0, 0.1, 0.85, 1]
    anim.values = [0, 1, 1, 0]
    anim.timingFunctions = [CAMediaTimingFunction(name: .easeOut), CAMediaTimingFunction(name: .linear), CAMediaTimingFunction(name: .easeIn)]
    container.add(anim, forKey: "vis")
    parent.addSublayer(container)
}
for (n, s, e) in subs { addSubtitle(n, s, e + 0.25) }

let vcomp = AVMutableVideoComposition(propertiesOf: comp)
vcomp.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)

// ---- 导出 ----
let out = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: out)
let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
export.outputURL = out
export.outputFileType = .mp4
export.videoComposition = vcomp
let sem = DispatchSemaphore(value: 0)
export.exportAsynchronously { sem.signal() }
sem.wait()
print("export status: \(export.status.rawValue), error: \(String(describing: export.error))")
exit(export.status == .completed ? 0 : 3)
