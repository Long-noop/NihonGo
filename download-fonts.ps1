# Script to download Google Fonts locally for offline PWA

$fontsDir = ".\asserts\fonts"

# Create fonts directory
if (!(Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null
}

# Font URLs to download (from Google Fonts gstatic.com)
$fonts = @(
    "https://fonts.gstatic.com/s/notoSerifJp/v15-rg-kR9Q9UFVG-xI5L5RivnA-Xg.woff2",
    "https://fonts.gstatic.com/s/notoSerifJp/v15-rg-kR9Q9UFVG-xI5L5RivnA-Xw.woff2",
    "https://fonts.gstatic.com/s/notoSerifJp/v15-rg-kR9Q9UFVG-xI5L5RivnA-Zw.woff2",
    "https://fonts.gstatic.com/s/notoSansJp/v52-_Xmo9KwMn-Kz-Y4DJGDq.0.woff2",
    "https://fonts.gstatic.com/s/notoSansJp/v52-_Xmo9KwMn-Kz-Y4D6GDq.0.woff2",
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBVSZc.woff2",
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBgSZc.woff2",
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBUVZc.woff2",
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBZVZc.woff2"
)

Write-Host "Downloading $($fonts.Count) font files..."
$downloaded = 0

foreach ($url in $fonts) {
    $fileName = Split-Path -Leaf $url
    $fileName = $fileName -replace '\?.*', ''
    $filePath = Join-Path $fontsDir $fileName
    
    if (Test-Path $filePath) {
        Write-Host "Already exists: $fileName"
        continue
    }
    
    try {
        Write-Host "Downloading: $fileName..."
        Invoke-WebRequest -Uri $url -OutFile $filePath -UseBasicParsing
        $sizeKB = [math]::Round((Get-Item $filePath).Length / 1024, 2)
        Write-Host "Downloaded: $fileName ($sizeKB KB)"
        $downloaded++
    } catch {
        Write-Warning "Failed to download $fileName"
    }
}

Write-Host "Download complete! Downloaded/existing: $downloaded new files"
Write-Host "Next: Run 'node generate-fonts-css.js' to generate fonts.css"
