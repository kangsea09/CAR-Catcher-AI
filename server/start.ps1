$ErrorActionPreference = "Stop"

$ServerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ServerDirectory ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw ".\server\setup.ps1 을 먼저 실행하세요."
}

& $Python -m uvicorn app:app --app-dir $ServerDirectory --host 127.0.0.1 --port 8000 --reload
