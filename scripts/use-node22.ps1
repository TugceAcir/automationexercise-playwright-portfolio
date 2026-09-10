# Dot-source this in a PowerShell session to put the project's pinned Node 22.x
# (matching .nvmrc, package.json "engines", and all GitHub Actions workflows) first
# on PATH for this session only:
#
#   . .\scripts\use-node22.ps1
#
# Resolution order:
#   1. $env:NODE22_HOME              - set this if your Node 22 lives elsewhere
#   2. the default portable location below, under the current user's LOCALAPPDATA
#
# A portable build is used deliberately: it installs with no admin rights and does
# not disturb whatever Node version the machine has globally.

$defaultNode22 = Join-Path $env:LOCALAPPDATA 'Programs\node22-portable\node-v22.23.2-win-x64'
$node22 = if ($env:NODE22_HOME) { $env:NODE22_HOME } else { $defaultNode22 }

if (-not (Test-Path $node22)) {
    Write-Error @"
Node 22 not found at: $node22
Set NODE22_HOME to your Node 22 directory (the one containing node.exe), or install a
portable Node 22 build to the default location above. See package.json "engines".
"@
    return
}

$env:Path = "$node22;" + $env:Path
node --version
npm --version
