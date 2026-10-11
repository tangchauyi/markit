// composite.swift — Mark it! 宣传片总合成（plan.json 驱动，AVAssetWriter 直写版）
// 背景：AVAssetExportSession（assetexportd XPC）在本环境系统性故障，连 Passthrough 都失败；
// 而 AVAssetWriter 进程内编码（frames2video/still2video）完全正常。故改用 Writer 直写。
// 视频轨：逐段 AVAssetReader 解码 →（有时间窗则烧绘字幕）→ 拼接写入
// 音频轨：TTS m4a 解码为 48k/stereo float PCM → 按段起点+offset 混入主时间线 → AAC 编码写入
// 用法: composite <plan.json> <out.mp4> [--nosubs]
import AVFoundation
import AppKit
import CoreMedia
import Foundation

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: composite <plan.json> <out.mp4> [--nosubs]"); exit(1) }
let planPath = a[1], outPath = a[2]
let NOSUBS = a.contains("--nosubs")

struct Plan: Decodable {
    let segments: [String]
    let voices: [Voice]
    let ttsDir: String
    let subsDir: String
    struct Voice: Decodable { let line: Int; let seg: Int; let offset: Double }
}
let plan = try! JSONDecoder().decode(Plan.self, from: Data(contentsOf: URL(fileURLWithPath: planPath)))

let W = 1080, H = 1920
let SR = 48000.0, CH = 2

func loadAsset(_ p: String) -> AVURLAsset {
    let aset = AVURLAsset(url: URL(fileURLWithPath: p))
    let sem = DispatchSemaphore(value: 0)
    aset.loadValuesAsynchronously(forKeys: ["duration", "tracks"]) { sem.signal() }
    sem.wait()
    return aset
}

// ---- 段时长与起点 ----
var assets: [AVURLAsset] = []
var segDurs: [Double] = []
for p in plan.segments {
    let aset = loadAsset(p)
    assets.append(aset)
    segDurs.append(CMTimeGetSeconds(aset.duration))
}
print("durations: \(segDurs.map { String(format: "%.2f", $0) }.joined(separator: " "))")
var segStarts: [Double] = []
var acc = 0.0
for d in segDurs { segStarts.append(acc); acc += d }
let total = acc
print("total: \(String(format: "%.2f", total))s")

// ---- 音频主时间线（先混音到内存）----
let totalSamples = Int(total * SR) + Int(SR) / 2
var mix = [Float](repeating: 0, count: totalSamples * CH)
var subs: [(Int, Double, Double)] = []
for v in plan.voices {
    let p = "\(plan.ttsDir)/line_\(v.line).m4a"
    let aset = loadAsset(p)
    guard let at = aset.tracks(withMediaType: .audio).first else { print("WARN no audio \(p)"); continue }
    let reader: AVAssetReader!
    do { reader = try AVAssetReader(asset: aset) } catch { print("WARN reader fail \(p)"); continue }
    let out = AVAssetReaderTrackOutput(track: at, outputSettings: [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: SR,
        AVNumberOfChannelsKey: CH,
        AVLinearPCMBitDepthKey: 32,
        AVLinearPCMIsFloatKey: true,
        AVLinearPCMIsNonInterleaved: false,
        AVLinearPCMIsBigEndianKey: false
    ] as [String: Any])
    reader.add(out)
    reader.startReading()
    let atSec = segStarts[v.seg] + v.offset
    let baseSample = Int(atSec * SR)
    var written = 0
    while let sb = out.copyNextSampleBuffer() {
        guard let bb = CMSampleBufferGetDataBuffer(sb) else { continue }
        let len = CMBlockBufferGetDataLength(bb)
        var tmp = [Float](repeating: 0, count: len / 4)
        tmp.withUnsafeMutableBytes { ptr in
            _ = CMBlockBufferCopyDataBytes(bb, atOffset: 0, dataLength: len, destination: ptr.baseAddress!)
        }
        let frames = tmp.count / CH
        for i in 0..<(frames * CH) {
            let idx = baseSample * CH + written + i
            if idx < totalSamples * CH { mix[idx] += tmp[i] }
        }
        written += frames * CH
    }
    let dur = CMTimeGetSeconds(aset.duration)
    subs.append((v.line, atSec, atSec + dur))
    print("voice line_\(v.line) @\(String(format: "%.1f", atSec)) dur \(String(format: "%.1f", dur))s samples=\(written / CH)")
}

// ---- 字幕 PNG 预加载 ----
var subImages: [Int: CGImage] = [:]
if !NOSUBS {
    for (n, _, _) in subs {
        if let img = NSImage(contentsOfFile: "\(plan.subsDir)/sub_\(n).png"),
           let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            subImages[n] = cg
        } else { print("WARN no sub image \(n)") }
    }
}

// 字幕透明度（复刻 CA 版 keyTimes 0/0.1/0.85/1）
func subAlpha(_ t: Double, _ s: Double, _ e: Double) -> Double {
    guard t >= s && t <= e else { return 0 }
    let p = (t - s) / max(0.001, e - s)
    if p < 0.1 { return p / 0.1 }
    if p < 0.85 { return 1.0 }
    return max(0, (1 - p) / 0.15)
}
// 某时刻的激活字幕（最多1条，与 CA 版一致）
func activeSub(_ t: Double) -> (Int, Double)? {
    var best: (Int, Double)? = nil
    for (n, s, e) in subs {
        let a2 = subAlpha(t, s, e + 0.25)
        if a2 > 0 { best = (n, a2) }
    }
    return best
}

// ---- Writer ----
let outURL = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: outURL)
let writer = try! AVAssetWriter(outputURL: outURL, fileType: .mp4)
let vsettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000]
]
let vin = AVAssetWriterInput(mediaType: .video, outputSettings: vsettings)
vin.expectsMediaDataInRealTime = false
let vadaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vin, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H
])
writer.add(vin)
let asettings = [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVSampleRateKey: SR,
    AVNumberOfChannelsKey: CH,
    AVEncoderBitRateKey: 128000
] as [String: Any]
let ain = AVAssetWriterInput(mediaType: .audio, outputSettings: asettings)
ain.expectsMediaDataInRealTime = false
writer.add(ain)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

// ---- 音频写入（0.1s 块，同步先写完）----
    var asbd = AudioStreamBasicDescription(mSampleRate: SR, mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
        mBytesPerPacket: 8, mFramesPerPacket: 1, mBytesPerFrame: 8,
        mChannelsPerFrame: 2, mBitsPerChannel: 32, mReserved: 0)
    var fmt: CMAudioFormatDescription?
    CMAudioFormatDescriptionCreate(allocator: nil, asbd: &asbd, layoutSize: 0, layout: nil,
        magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &fmt)
// 音频喂数函数：一次喂一块，返回是否还有剩余
var audioPos = 0
let totalFrames = totalSamples
func feedAudioChunk() {
    guard audioPos < totalFrames else { return }
    let n = min(Int(SR) / 10, totalFrames - audioPos)
    var block: CMBlockBuffer?
    CMBlockBufferCreateWithMemoryBlock(allocator: nil, memoryBlock: nil, blockLength: n * 8,
        blockAllocator: nil, customBlockSource: nil, offsetToData: 0, dataLength: n * 8, flags: 0, blockBufferOut: &block)
    mix.withUnsafeBufferPointer { fptr in
        let src = UnsafeRawPointer(fptr.baseAddress!).advanced(by: audioPos * 8)
        _ = CMBlockBufferReplaceDataBytes(with: src, blockBuffer: block!, offsetIntoDestination: 0, dataLength: n * 8)
    }
    var timing = CMSampleTimingInfo(
        duration: CMTime(value: CMTimeValue(n), timescale: CMTimeScale(SR)),
        presentationTimeStamp: CMTime(value: CMTimeValue(audioPos), timescale: CMTimeScale(SR)),
        decodeTimeStamp: .invalid)
    var sb: CMSampleBuffer?
    var timingArray: [CMSampleTimingInfo] = [timing]
    var sizeArray: [Int] = [n * 8]
    CMSampleBufferCreateReady(allocator: nil, dataBuffer: block!, formatDescription: fmt!,
        sampleCount: n, sampleTimingEntryCount: 1, sampleTimingArray: &timingArray,
        sampleSizeEntryCount: 1, sampleSizeArray: &sizeArray, sampleBufferOut: &sb)
    if let sb = sb { ain.append(sb) }
    audioPos += n
}
// 音频用 requestMediaDataWhenReady 在独立队列喂数：编码器就绪才回调，与视频流穿插排水
let audioQueue = DispatchQueue(label: "awrite")
ain.requestMediaDataWhenReady(on: audioQueue) {
    while ain.isReadyForMoreMediaData && audioPos < totalFrames { feedAudioChunk() }
    if audioPos >= totalFrames { ain.markAsFinished() }
}

// ---- 视频写入（逐段解码 → 拼接 → 烧字幕）----
do {
    var outCount = 0
    for (si, segAsset) in assets.enumerated() {
        guard let vt = segAsset.tracks(withMediaType: .video).first else { print("no video track seg \(si)"); continue }
        let reader: AVAssetReader!
        do { reader = try AVAssetReader(asset: segAsset) } catch { print("reader fail seg \(si)"); continue }
        let out = AVAssetReaderTrackOutput(track: vt, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ] as [String: Any])
        out.alwaysCopiesSampleData = false
        reader.add(out)
        reader.startReading()
        let segStart = segStarts[si]
        while let sb = out.copyNextSampleBuffer() {
            guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
            let pts = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sb)) + segStart
            var targetPB: CVPixelBuffer = pb
            let active = NOSUBS ? nil : activeSub(pts)
            if let (lineNo, alpha) = active, let subImg = subImages[lineNo] {
                // 需要烧字幕：从 adaptor pool 取新缓冲，绘视频帧 + 半透明字幕
                var nb: CVPixelBuffer?
                CVPixelBufferPoolCreatePixelBuffer(nil, vadaptor.pixelBufferPool!, &nb)
                if let dst = nb {
                    CVPixelBufferLockBaseAddress(pb, [])
                    CVPixelBufferLockBaseAddress(dst, [])
                    let srcCtx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: W, height: H,
                        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
                    let srcImg = srcCtx.makeImage()!
                    let dstCtx = CGContext(data: CVPixelBufferGetBaseAddress(dst), width: W, height: H,
                        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(dst),
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
                    dstCtx.interpolationQuality = .high
                    dstCtx.draw(srcImg, in: CGRect(x: 0, y: 0, width: W, height: H))
                    let iw = CGFloat(subImg.width), ih = CGFloat(subImg.height)
                    dstCtx.setAlpha(CGFloat(alpha))
                    dstCtx.draw(subImg, in: CGRect(x: (CGFloat(W) - iw) / 2, y: 110, width: iw, height: ih))
                    CVPixelBufferUnlockBaseAddress(pb, [])
                    CVPixelBufferUnlockBaseAddress(dst, [])
                    targetPB = dst
                }
            }
            while !vin.isReadyForMoreMediaData { usleep(4000) }
            vadaptor.append(targetPB, withPresentationTime: CMTime(seconds: pts, preferredTimescale: 600))
            outCount += 1
            if outCount % 300 == 0 { print("video \(outCount) @\(String(format: "%.1f", pts))s") }
        }
    }
    vin.markAsFinished()
}
// 等音频排空（最多 60s），防止 finishWriting 时音轨未完成
var waitedMs = 0
while audioPos < totalFrames && waitedMs < 60000 { usleep(10000); waitedMs += 10 }
if audioPos < totalFrames { print("WARN audio truncated at \(String(format: "%.1f", Double(audioPos) / SR))s"); ain.markAsFinished() }

// ---- 等待写入完成 ----
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("writer status: \(writer.status.rawValue), error: \(String(describing: writer.error))")
exit(writer.status == .completed ? 0 : 3)
