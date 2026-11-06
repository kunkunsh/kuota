import Cocoa
import CoreGraphics

func createIcon(size: CGFloat) -> NSImage {
    let img = NSImage(size: NSSize(width: size, height: size))
    img.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        img.unlockFocus()
        return img
    }

    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    
    // Background: Dark obsidian with smooth squircle
    let cornerRadius = size * 0.224
    let bgPath = CGPath(roundedRect: rect.insetBy(dx: size * 0.04, dy: size * 0.04),
                        cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
    
    ctx.saveGState()
    ctx.addPath(bgPath)
    ctx.clip()
    
    // Gradient: Deep zinc to obsidian (#18181b to #09090b)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        CGColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1.0),
        CGColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1.0)
    ] as CFArray
    if let bgGradient = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(bgGradient, start: CGPoint(x: size * 0.5, y: size), end: CGPoint(x: size * 0.5, y: 0), options: [])
    }
    ctx.restoreGState()

    // Subtle border
    ctx.saveGState()
    ctx.setLineWidth(max(1.0, size * 0.015))
    ctx.setStrokeColor(CGColor(red: 0.25, green: 0.25, blue: 0.28, alpha: 0.8))
    ctx.addPath(bgPath)
    ctx.strokePath()
    ctx.restoreGState()

    // Emerald Emblem Squircle
    let innerInset = size * 0.18
    let innerRect = rect.insetBy(dx: innerInset, dy: innerInset)
    let innerRadius = size * 0.16
    let innerPath = CGPath(roundedRect: innerRect, cornerWidth: innerRadius, cornerHeight: innerRadius, transform: nil)
    
    // Glow behind emblem
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -size * 0.02),
                  blur: size * 0.12,
                  color: CGColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.5))
    ctx.setFillColor(CGColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1.0))
    ctx.addPath(innerPath)
    ctx.fillPath()
    ctx.restoreGState()

    // Emerald gradient fill
    ctx.saveGState()
    ctx.addPath(innerPath)
    ctx.clip()
    let emeraldColors = [
        CGColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0), // #34d399
        CGColor(red: 0.02, green: 0.59, blue: 0.41, alpha: 1.0)  // #059669
    ] as CFArray
    if let emGradient = CGGradient(colorsSpace: colorSpace, colors: emeraldColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(emGradient, start: CGPoint(x: size * 0.5, y: size - innerInset), end: CGPoint(x: size * 0.5, y: innerInset), options: [])
    }
    ctx.restoreGState()

    // Sharp Letter "K" in center
    let fontSize = size * 0.42
    let font = NSFont.systemFont(ofSize: fontSize, weight: .black)
    let string = "K"
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(calibratedRed: 0.04, green: 0.04, blue: 0.05, alpha: 1.0) // Deep onyx
    ]
    let attrString = NSAttributedString(string: string, attributes: attributes)
    let stringSize = attrString.size()
    let stringRect = CGRect(
        x: (size - stringSize.width) / 2.0,
        y: (size - stringSize.height) / 2.0 - (size * 0.01),
        width: stringSize.width,
        height: stringSize.height
    )
    attrString.draw(in: stringRect)

    img.unlockFocus()
    return img
}

func savePNG(image: NSImage, path: String) {
    guard let tiffData = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiffData),
          let pngData = rep.representation(using: .png, properties: [:]) else {
        print("Failed to encode PNG for \(path)")
        return
    }
    try? pngData.write(to: URL(fileURLWithPath: path))
}

let args = CommandLine.arguments
let outputDir = args.count > 1 ? args[1] : "apps/desktop/src-tauri/icons"
let fileManager = FileManager.default
try? fileManager.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let iconsetDir = "\(outputDir)/icon.iconset"
try? fileManager.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

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
    let img = createIcon(size: s)
    savePNG(image: img, path: "\(iconsetDir)/\(name)")
}

// Save standard Tauri icon files
savePNG(image: createIcon(size: 32), path: "\(outputDir)/32x32.png")
savePNG(image: createIcon(size: 64), path: "\(outputDir)/64x64.png")
savePNG(image: createIcon(size: 128), path: "\(outputDir)/128x128.png")
savePNG(image: createIcon(size: 256), path: "\(outputDir)/128x128@2x.png")
savePNG(image: createIcon(size: 512), path: "\(outputDir)/icon.png")

print("Generated iconset in \(iconsetDir)")
