param(
    [switch]$SkipInstall,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot "server-analytic-system"
$venvDir = Join-Path $serverDir ".venv"
$venvPython = Join-Path $serverDir ".venv\Scripts\python.exe"
$pythonCommand = if ($env:SERVER_ANALYTIC_PYTHON) { $env:SERVER_ANALYTIC_PYTHON } else { "python" }
$createdVenv = $false

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,
        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage
    )

    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

Push-Location $serverDir
try {
    if (Test-Path $venvPython) {
        Write-Host "Reusing existing server virtual environment:" $venvPython
    }
    else {
        Write-Host "Creating server virtual environment with:" $pythonCommand
        Invoke-Step -Action { & $pythonCommand -m venv .venv } -ErrorMessage "Failed to create server virtual environment"
        if (-not (Test-Path $venvPython)) {
            throw "Virtual environment was not created correctly: $venvPython"
        }
        $createdVenv = $true
    }

    if (-not $SkipInstall) {
        if ($createdVenv) {
            Write-Host "Bootstrapping pip in the new virtual environment..."
            Invoke-Step -Action {
                & $venvPython -m pip install --upgrade pip --disable-pip-version-check
            } -ErrorMessage "Failed to bootstrap pip in the server virtual environment"
        }
        else {
            Write-Host "Using existing server virtual environment packages."
        }

        Write-Host "Installing server dependencies..."
        Invoke-Step -Action {
            & $venvPython -m pip install --disable-pip-version-check -r requirements.txt
        } -ErrorMessage "Failed to install server requirements"
    }
    else {
        Write-Host "Skipping dependency installation."
    }

    if (-not $SkipBuild) {
        Write-Host "Building server executable with PyInstaller..."
        Invoke-Step -Action {
            & $venvPython build.py --mode pyinstaller --target current --project-name server-analytic-system --clean
        } -ErrorMessage "Failed to build server executable"
    }
    else {
        Write-Host "Skipping PyInstaller build."
    }
}
finally {
    Pop-Location
}
