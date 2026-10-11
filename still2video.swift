// still2video.swift — 单张静态图 → N 秒 1080×1920 H.264 MP4
// 用法: still2video <img.(png|jpg)> <seconds> <out.mp4>
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 4, let secs = Double(args[2]) else { print("usage: still2video <img> <seconds> <out>"); exit(1) }
let imgPath = args[1], outPath = args[3]

guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: imgPath) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("img decode fail"); exit(2) }

let W = 1080, H = 1920, fps = 30
let total = Int(secs * Double(fps))
let url = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: url)
let writer = try! AVAssetWriter(outputURL: url, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 10_000_000]
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H
])
writer.add(input)
writer.startWriting(); writer.startSession(atSourceTime: .zero)

let sem = DispatchSemaphore(value: 0)
DispatchQueue.global().async {
    for i in 0..<total {
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        guard let pixelBuf = pb else { continue }
        CVPixelBufferLockBaseAddress(pixelBuf, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pixelBuf), width: W, height: H,
                            bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuf),
                            space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
        ctx!.interpolationQuality = .high
        let iw = CGFloat(img.width), ih = CGFloat(img.height)
        let scale = min(CGFloat(W)/iw, CGFloat(H)/ih)
        let dw = iw*scale, dh = ih*scale
        ctx!.draw(img, in: CGRect(x: (CGFloat(W)-dw)/2, y: (CGFloat(H)-dh)/2, width: dw, height: dh))
        CVPixelBufferUnlockBaseAddress(pixelBuf, [])
        while !input.isReadyForMoreMediaData { usleep(4000) }
        adaptor.append(pixelBuf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps)))
    }
    input.markAsFinished()
    writer.finishWriting { sem.signal() }
}
sem.wait()
print("done \(outPath) \(total) frames, status \(writer.status.rawValue)")
exit(writer.status == .completed ? 0 : 3)
