$ErrorActionPreference = "Stop"

$ServerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$VirtualEnvironment = Join-Path $ServerDirectory ".venv"
$Python = Join-Path $VirtualEnvironment "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -m venv $VirtualEnvironment
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv $VirtualEnvironment
    } else {
        throw "Python 3.11 이상을 먼저 설치하세요."
    }
}

& $Python -m pip install --upgrade pip
& $Python -m pip install -r (Join-Path $ServerDirectory "requirements.txt")
Push-Location $ServerDirectory
try {
    & $Python (Join-Path $ServerDirectory "setup_model.py")
} finally {
    Pop-Location
}

Write-Host "로컬 AI 설치가 완료되었습니다. .\server\start.ps1 로 서버를 실행하세요."
