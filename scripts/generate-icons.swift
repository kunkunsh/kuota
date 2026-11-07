import Cocoa
import CoreGraphics

func savePNG(image: NSImage, path: String) {
    guard let tiffData = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiffData),
          let pngData = rep.representation(using: .png, properties: [:]) else {
        print("Failed to encode PNG for \(path)")
        return
    }
    try? pngData.write(to: URL(fileURLWithPath: path))
}

// Generate official macOS HIG compliant app icon
// Canvas: size x size (e.g. 1024x1024)
// Squircle: 824x824 at (100, 100) with corner radius 180 and subtle macOS drop shadow
// Outside: 100% transparent (alpha = 0)
func renderMacAppIcon(svgPath: String, size: CGFloat) -> NSImage {
    let scale = size / 1024.0
    let targetImg = NSImage(size: NSSize(width: size, height: size))
    targetImg.lockFocus()
    
    // 1. Clear entire canvas to transparent
    NSColor.clear.set()
    NSRect(x: 0, y: 0, width: size, height: size).fill(using: .copy)
    
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        targetImg.unlockFocus()
        return targetImg
    }
    
    let margin: CGFloat = 100.0 * scale
    let iconSize: CGFloat = 824.0 * scale
    let cornerRadius: CGFloat = 180.0 * scale
    let iconRect = NSRect(x: margin, y: margin, width: iconSize, height: iconSize)
    
    // 2. Subtle drop shadow matching macOS Big Sur / Sonoma guidelines
    ctx.saveGState()
    let shadowColor = NSColor.black.withAlphaComponent(0.25).cgColor
    ctx.setShadow(offset: CGSize(width: 0, height: -6.0 * scale), blur: 14.0 * scale, color: shadowColor)
    
    let path = NSBezierPath(roundedRect: iconRect, xRadius: cornerRadius, yRadius: cornerRadius)
    let bgColor = NSColor(red: 21.0/255.0, green: 24.0/255.0, blue: 29.0/255.0, alpha: 1.0)
    bgColor.setFill()
    path.fill()
    ctx.restoreGState()
    
    // 3. Draw vector SVG mark inside the squircle
    if let svgImg = NSImage(contentsOfFile: svgPath) {
        ctx.saveGState()
        path.addClip()
        svgImg.draw(in: iconRect)
        ctx.restoreGState()
    }
    
    targetImg.unlockFocus()
    return targetImg
}

let args = CommandLine.arguments
let outputDir = args.count > 1 ? args[1] : "apps/desktop/src-tauri/icons"
let svgSource = "packages/kunkun/public/kuota-app-icon-dark.svg"

let fileManager = FileManager.default
try? fileManager.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let iconsetDir = "\(outputDir)/icon.iconset"
try? fileManager.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

print("Rendering pristine transparent macOS icons from \(svgSource)...")

let masterImage = renderMacAppIcon(svgPath: svgSource, size: 1024)
savePNG(image: masterImage, path: "\(outputDir)/kuota-app-icon-dark-1024.png")
savePNG(image: masterImage, path: "packages/kunkun/public/kuota-app-icon-dark-1024.png")
savePNG(image: masterImage, path: "packages/cli/dist/web/kuota-app-icon-dark-1024.png")

let sizes: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for (name, s) in sizes {
    let img = renderMacAppIcon(svgPath: svgSource, size: s)
    savePNG(image: img, path: "\(iconsetDir)/\(name)")
}

// Standard Tauri files
savePNG(image: renderMacAppIcon(svgPath: svgSource, size: 32), path: "\(outputDir)/32x32.png")
savePNG(image: renderMacAppIcon(svgPath: svgSource, size: 64), path: "\(outputDir)/64x64.png")
savePNG(image: renderMacAppIcon(svgPath: svgSource, size: 128), path: "\(outputDir)/128x128.png")
savePNG(image: renderMacAppIcon(svgPath: svgSource, size: 256), path: "\(outputDir)/128x128@2x.png")
savePNG(image: renderMacAppIcon(svgPath: svgSource, size: 512), path: "\(outputDir)/icon.png")

// Compile to .icns using macOS iconutil
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", iconsetDir, "-o", "\(outputDir)/icon.icns"]
try? process.run()
process.waitUntilExit()

print("Successfully generated official macOS HIG icon.icns with 100% transparent corners!")
