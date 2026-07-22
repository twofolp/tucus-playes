import os
from PIL import Image, ImageDraw

def create_rounded_corners(img, corner_radius_percent=0.22):
    w, h = img.size
    radius = int(min(w, h) * corner_radius_percent)
    
    # 4x super-sampling for silky smooth anti-aliased rounded corners
    scale = 4
    sw, sh = w * scale, h * scale
    sradius = radius * scale
    
    mask = Image.new('L', (sw, sh), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, sw - 1, sh - 1], radius=sradius, fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    
    output = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    return output

def process_icons():
    # User's uploaded image path from brain directory
    brain_dir = r"C:\Users\dahma\.gemini\antigravity-ide\brain\1c9466f9-60a1-4f41-b730-4268a6cf98f4"
    src_path = os.path.join(brain_dir, "media__1784635703004.jpg")
    
    if not os.path.exists(src_path):
        src_path = "tucus_logo.png"
        
    print(f"Using source image: {src_path}")
    img = Image.open(src_path).convert("RGBA")
    
    # Crop to square if needed
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    
    # Apply rounded corners
    rounded_img = create_rounded_corners(img, corner_radius_percent=0.20)
    
    # Save main 512x512 icon
    icon_512 = rounded_img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save("src-tauri/icons/icon.png", "PNG")
    icon_512.save("tucus_logo.png", "PNG")
    if os.path.exists("public"):
        icon_512.save("public/tucus_logo.png", "PNG")
        
    # Sizes for Tauri icon set
    sizes = {
        "32x32.png": (32, 32),
        "64x64.png": (64, 64),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "Square30x30Logo.png": (30, 30),
        "Square44x44Logo.png": (44, 44),
        "Square71x71Logo.png": (71, 71),
        "Square89x89Logo.png": (89, 89),
        "Square107x107Logo.png": (107, 107),
        "Square142x142Logo.png": (142, 142),
        "Square150x150Logo.png": (150, 150),
        "Square284x284Logo.png": (284, 284),
        "Square310x310Logo.png": (310, 310),
        "StoreLogo.png": (50, 50),
    }
    
    for filename, (sw, sh) in sizes.items():
        out_file = os.path.join("src-tauri/icons", filename)
        resized = rounded_img.resize((sw, sh), Image.Resampling.LANCZOS)
        resized.save(out_file, "PNG")
        
    # Generate multi-size icon.ico for Windows desktop & taskbar
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    rounded_img.save("src-tauri/icons/icon.ico", format="ICO", sizes=ico_sizes)
    print("Successfully generated all icons with smooth rounded corners from user attachment!")

if __name__ == "__main__":
    process_icons()
