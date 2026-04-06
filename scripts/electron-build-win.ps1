param(
    [switch]$Store,
    [switch]$Msi,
    [switch]$SkipServerBuild,
    [switch]$SkipElectronBuilder,
    [switch]$SkipProtectAsar
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$viteCli = Join-Path $repoRoot "node_modules\vite\bin\vite.js"
$buildStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $repoRoot ("release\windows-" + $buildStamp)

if ($Store -and $Msi) {
    throw "Use either -Store or -Msi, but not both in the same build."
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==>" $Description
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Description"
    }
}

Push-Location $repoRoot
try {
    $env:ELECTRON_OUTPUT_DIR = $outputDir

    Write-Host "Windows build output directory:" $outputDir
    Invoke-Step -Description "Generate icon assets" -Action { & npm.cmd run prebuild }

    if (-not $SkipServerBuild) {
        Invoke-Step -Description "Build bundled Python server" -Action { & npm.cmd run server:build:win }
        Start-Sleep -Milliseconds 750
    }
    else {
        Write-Host ""
        Write-Host "==> Skipping bundled Python server build"
    }

    Invoke-Step -Description "Build frontend with Vite" -Action { & node $viteCli build --configLoader native }
    Start-Sleep -Milliseconds 500

    Invoke-Step -Description "Run Electron pre-pack checks" -Action { & node scripts/before-build.cjs }

    if (-not $SkipElectronBuilder) {
        $builderArgs = @("electron-builder", "--win")
        $label = "Package Windows build (NSIS + portable)"

        if ($Store) {
            $builderArgs += "appx"
            $label = "Package Windows Store build"
        }
        elseif ($Msi) {
            $builderArgs += "msi"
            $label = "Package Windows MSI build"
        }
        else {
            $builderArgs += @("nsis", "portable")
        }

        $builderArgs += "--config.directories.output=$outputDir"
        Invoke-Step -Description $label -Action { & npx.cmd @builderArgs }
    }
    else {
        Write-Host ""
        Write-Host "==> Skipping electron-builder packaging"
    }

    if (-not $SkipProtectAsar) {
        Invoke-Step -Description "Protect ASAR bundle" -Action { & node scripts/protect-asar.cjs }
    }
    else {
        Write-Host ""
        Write-Host "==> Skipping ASAR protection"
    }
}
finally {
    Remove-Item Env:ELECTRON_OUTPUT_DIR -ErrorAction SilentlyContinue
    Pop-Location
}
