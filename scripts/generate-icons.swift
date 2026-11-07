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

func resizeImage(source: NSImage, size: CGFloat) -> NSImage {
    let newImg = NSImage(size: NSSize(width: size, height: size))
    newImg.lockFocus()
    source.draw(in: NSRect(x: 0, y: 0, width: size, height: size),
                from: NSRect(x: 0, y: 0, width: source.size.width, height: source.size.height),
                operation: .copy,
                fraction: 1.0)
    newImg.unlockFocus()
    return newImg
}

let args = CommandLine.arguments
let outputDir = args.count > 1 ? args[1] : "apps/desktop/src-tauri/icons"
let sourceMaster = "\(outputDir)/kuota-app-icon-dark-1024.png"

let fileManager = FileManager.default
try? fileManager.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let iconsetDir = "\(outputDir)/icon.iconset"
try? fileManager.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

guard let masterImage = NSImage(contentsOfFile: sourceMaster) else {
    print("Master icon not found at \(sourceMaster)")
    exit(1)
}

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
    let img = resizeImage(source: masterImage, size: s)
    savePNG(image: img, path: "\(iconsetDir)/\(name)")
}

// Save standard Tauri icon files
savePNG(image: resizeImage(source: masterImage, size: 32), path: "\(outputDir)/32x32.png")
savePNG(image: resizeImage(source: masterImage, size: 64), path: "\(outputDir)/64x64.png")
savePNG(image: resizeImage(source: masterImage, size: 128), path: "\(outputDir)/128x128.png")
savePNG(image: resizeImage(source: masterImage, size: 256), path: "\(outputDir)/128x128@2x.png")
savePNG(image: resizeImage(source: masterImage, size: 512), path: "\(outputDir)/icon.png")

print("Generated iconset in \(iconsetDir) from official master asset")
