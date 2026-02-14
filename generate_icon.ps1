Add-Type -AssemblyName System.Drawing

$width = 512
$height = 512
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background: Dark Blue (#1a1a2e -> R=26, G=26, B=46)
$bgColor = [System.Drawing.Color]::FromArgb(255, 26, 26, 46) 
# Rounded Rectangle approximated by filling a path or just a rect for simplicity in icon
# For a 512x512 icon, let's just fill the whole background or a rounded rect
# Let's do a rounded rect to match SVG
$rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$radius = 112 # scaled from 28/128 * 512 = 112
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
$path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()
$bgBrush = New-Object System.Drawing.SolidBrush $bgColor
$g.FillPath($bgBrush, $path)

# Icon: Spark/Bolt (#f97316 -> R=249, G=115, B=22)
$iconColor = [System.Drawing.Color]::FromArgb(255, 249, 115, 22)
$iconBrush = New-Object System.Drawing.SolidBrush $iconColor

# Points scaled from SVG (128x128) to 512x512 (Scale factor 4)
# M68 24 -> 272, 96
# L86 54 -> 344, 216
# H72    -> 288, 216
# L78 88 -> 312, 352
# L46 50 -> 184, 200
# H60    -> 240, 200
# L68 24 -> 272, 96

$points = @(
    New-Object System.Drawing.Point 272, 96
    New-Object System.Drawing.Point 344, 216
    New-Object System.Drawing.Point 288, 216
    New-Object System.Drawing.Point 312, 352
    New-Object System.Drawing.Point 184, 200
    New-Object System.Drawing.Point 240, 200
)

$g.FillPolygon($iconBrush, $points)

# Save PNGs
$bmp.Save("d:\project\Agent-Forge\resources\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("d:\project\Agent-Forge\build\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Save ICO (Quick hack: System.Drawing saves as PNG normally, but we can try)
# Proper ICO creation is complex in pure PS without external tools or custom bytes
# But many electron builders accept PNG as icon.ico or we can use a dotnet trick if needed
# Let's try to just save as Icon format, it might work for basic usage
try {
    $iconHandle = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $fileStream = New-Object System.IO.FileStream "d:\project\Agent-Forge\build\icon.ico", [System.IO.FileMode]::Create
    $icon.Save($fileStream)
    $fileStream.Close()
    [System.Runtime.InteropServices.Marshal]::DestroyIcon($iconHandle)
} catch {
    Write-Host "ICO creation failed, skipping ICO"
}

$g.Dispose()
$bmp.Dispose()
$bgBrush.Dispose()
$iconBrush.Dispose()
