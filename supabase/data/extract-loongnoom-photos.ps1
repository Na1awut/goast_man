# Crop existing pixels from the shop's board; no generated product imagery.
# Run from the repo root: powershell -File supabase/data/extract-loongnoom-photos.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$manifestPath = Join-Path $PSScriptRoot 'loongnoom_photos.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$outputPath = Join-Path $repoPath 'supabase/data/loongnoom-photos'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$board = [System.Drawing.Bitmap]::FromFile((Join-Path $repoPath $manifest.source))
try {
    foreach ($crop in $manifest.crops) {
        $bitmap = New-Object System.Drawing.Bitmap($manifest.outputSize, $manifest.outputSize)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $rect = $crop.rect
            $ratio = ($manifest.outputSize - 16) / [Math]::Max($rect[2], $rect[3])
            $width = [int][Math]::Round($rect[2] * $ratio)
            $height = [int][Math]::Round($rect[3] * $ratio)
            $dest = New-Object System.Drawing.Rectangle(([int](($manifest.outputSize - $width) / 2)), ([int](($manifest.outputSize - $height) / 2)), $width, $height)
            $src = New-Object System.Drawing.Rectangle($rect[0], $rect[1], $rect[2], $rect[3])
            $graphics.DrawImage($board, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
            $bitmap.Save((Join-Path $outputPath ($crop.id + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally { $board.Dispose() }
Write-Output ('Extracted ' + $manifest.crops.Count + ' original-board images.')
