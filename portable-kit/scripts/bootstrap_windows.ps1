$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$kitDir = Split-Path -Parent $scriptDir
$repoDir = Split-Path -Parent $kitDir

Write-Host "Sovereign Vault Portable Bootstrap (Windows)"
Write-Host "Repo: $repoDir"
Write-Host "This helper validates folders and prints required commands."

$runtime = Join-Path $kitDir 'runtime'
$folders = @('logs','pids','exports','workspace','data','models','tmp')
foreach ($f in $folders) {
  New-Item -ItemType Directory -Path (Join-Path $runtime $f) -Force | Out-Null
}

Write-Host "Runtime folders prepared at $runtime"
Write-Host "Next steps:"
Write-Host "1) Install Ollama (if needed)"
Write-Host "2) In backend: python -m venv .venv ; .venv\Scripts\Activate.ps1 ; pip install -r requirements.txt"
Write-Host "3) In frontend: npm install"
Write-Host "4) Start backend and frontend using the Linux scripts in WSL or equivalent PowerShell launchers"
