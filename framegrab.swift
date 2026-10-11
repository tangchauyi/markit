// framegrab.swift — 从视频中按秒抽帧验证/导出
// 用法: framegrab <video> <outPrefix> <t1,t2,t3...>
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 4 else { print("usage: framegrab <video> <outPrefix> <t1,t2,...>"); exit(1) }
let url = URL(fileURLWithPath: args[1])
let prefix = args[2]
let times = args[3].split(separator: ",").compactMap { Double($0) }

let asset = AVURLAsset(url: url)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 1080, height: 1920)

let sem = DispatchSemaphore(value: 0)
let duration = CMTimeGetSeconds(asset.duration)
print("duration: \(duration)s")

for t in times {
    gen.generateCGImagesAsynchronously(forTimes: [NSValue(time: CMTime(seconds: t, preferredTimescale: 600))]) { _, img, _, _, err in
        defer { sem.signal() }
        guard let cg = img else { print("t=\(t) err: \(err!)"); return }
        let rep = NSBitmapImageRep(cgImage: cg)
        guard let data = rep.representation(using: .png, properties: [:]) else { return }
        let out = "\(prefix)_\(Int(t))s.png"
        try! data.write(to: URL(fileURLWithPath: out))
        print("saved \(out)")
    }
    sem.wait()
}
