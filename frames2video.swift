// frames2video.swift — JPEG 帧序列 → 1080×1920 H.264 MP4（按时间戳对齐 30fps）
// 用法: frames2video <framesDir> <out.mp4>
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: frames2video <framesDir> <out.mp4> [startMs]"); exit(1) }
let dir = args[1], outPath = args[2]
let startMs = args.count >= 4 ? (Int(args[3]) ?? 0) : 0   // 掊头：丢弃 ts < startMs 的帧，时间轴平移

// 1. 读帧清单（按时间戳排序）
let fm = FileManager.default
let entries = try fm.contentsOfDirectory(atPath: dir)
    .filter { $0.hasSuffix(".jpg") && $0.hasPrefix("f_") }
    .map { name -> (ts: Int, path: String) in
        let parts = name.split(separator: "_")
        let tsPart = parts[2].split(separator: ".")[0]
        return (Int(tsPart) ?? 0, dir + "/" + name)
    }
    .sorted { $0.ts < $1.ts }
    .filter { $0.ts >= startMs }
    .map { (ts: $0.ts - startMs, path: $0.path) }
guard entries.count > 10 else { print("no frames"); exit(2) }
let totalMs = entries.last!.ts + 600
print("frames: \(entries.count), duration: \(String(format: "%.2f", Double(totalMs)/1000))s")

// 2. 输出规格
let outW = 1080, outH = 1920
let fps = 30
let url = URL(fileURLWithPath: outPath)
try? fm.removeItem(at: url)
let writer = try! AVAssetWriter(outputURL: url, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: outW,
    AVVideoHeightKey: outH,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: outW,
    kCVPixelBufferHeightKey as String: outH
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

// 3. 解码帧 → CGImage 缓存策略：顺序游标（帧时间戳单调）
func decode(_ path: String) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

let frameDur = CMTime(value: 1, timescale: CMTimeScale(fps))
var outFrame = 0
var cursor = 0
var currentImage = decode(entries[0].path)!

let sem = DispatchSemaphore(value: 0)
let queue = DispatchQueue(label: "enc")

queue.async {
    let totalOut = Int(Double(totalMs) / 1000.0 * Double(fps))
    while outFrame < totalOut {
        let tMs = Int64(Double(outFrame) / Double(fps) * 1000)
        // 游标推进：取 ts <= tMs 的最后一帧
        while cursor + 1 < entries.count && entries[cursor + 1].ts <= tMs {
            cursor += 1
            if let img = decode(entries[cursor].path) { currentImage = img }
        }
        // 绘制到 1080×1920（保持宽高比填充，720×1280 正好 1.5x 等比）
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        guard let pixelBuf = pb else { outFrame += 1; continue }
        CVPixelBufferLockBaseAddress(pixelBuf, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pixelBuf),
                            width: outW, height: outH, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuf),
                            space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
        ctx!.interpolationQuality = .high
        ctx!.setFillColor(CGColor(red: 0.96, green: 0.955, blue: 0.94, alpha: 1))
        ctx!.fill(CGRect(x: 0, y: 0, width: outW, height: outH))
        let iw = CGFloat(currentImage.width), ih = CGFloat(currentImage.height)
        let scale = min(CGFloat(outW)/iw, CGFloat(outH)/ih)
        let dw = iw*scale, dh = ih*scale
        // CGContext 坐标系左下原点：图像居中
        ctx!.draw(currentImage, in: CGRect(x: (CGFloat(outW)-dw)/2, y: (CGFloat(outH)-dh)/2, width: dw, height: dh))
        CVPixelBufferUnlockBaseAddress(pixelBuf, [])
        while !input.isReadyForMoreMediaData { usleep(4000) }
        adaptor.append(pixelBuf, withPresentationTime: CMTime(value: CMTimeValue(outFrame), timescale: CMTimeScale(fps)))
        outFrame += 1
        if outFrame % 150 == 0 { print("encoded \(outFrame)/\(totalOut)") }
    }
    input.markAsFinished()
    writer.finishWriting { sem.signal() }
}
sem.wait()
print("done: \(outPath), status: \(writer.status.rawValue)")
exit(writer.status == .completed ? 0 : 3)
