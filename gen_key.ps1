$ErrorActionPreference = 'Continue'
if (Test-Path "runpod_key") { Remove-Item "runpod_key" -Force }
if (Test-Path "runpod_key.pub") { Remove-Item "runpod_key.pub" -Force }
# Use empty string for passphrase
ssh-keygen -t ed25519 -C "runpod-antigravity" -f "runpod_key" -N ""
if (Test-Path "runpod_key.pub") {
    Write-Output "--- PUBLIC KEY START ---"
    Get-Content "runpod_key.pub"
    Write-Output "--- PUBLIC KEY END ---"
} else {
    Write-Error "Key generation failed."
}
