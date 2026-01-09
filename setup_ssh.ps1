
# Stop the script on any error
$ErrorActionPreference = 'Stop'

Write-Output "Generating SSH key..."

# Define the SSH key name
$ssh_key_name = "lightning_rsa"

# Define the SSH key paths
$ssh_dir = "$HOME\.ssh"
$ssh_key_path = "$HOME\.ssh\$ssh_key_name"
$ssh_key_pub_path = "$HOME\.ssh\$ssh_key_name.pub"

New-Item -Path "$ssh_dir" -Name "$ssh_key_name" -ItemType "file" -Value "" -Force
New-Item -Path "$ssh_dir" -Name "$ssh_key_name.pub" -ItemType "file" -Value "" -Force

# Download the SSH private key
(Invoke-WebRequest -Uri "https://lightning.ai/setup/ssh-gen?t=7f99be1b-d08a-492a-aa33-101c003c6a49&id=ba70ddb4-47bb-4f63-9e5d-e6df166f08be&machineName=$env:COMPUTERNAME" -OutFile $ssh_key_path).Content

# Set file permission to 600 (only owner can read and write)
# PowerShell does not have a native equivalent for 'chmod 600', but we can approximate it
$acl = Get-Acl $ssh_key_path
$acl.SetAccessRuleProtection($True, $False)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, 'Read,Write', 'Allow')
$acl.SetAccessRule($rule)
Set-Acl -Path $ssh_key_path -AclObject $acl

# Download the SSH public key
(Invoke-WebRequest -Uri "https://lightning.ai/setup/ssh-public?t=7f99be1b-d08a-492a-aa33-101c003c6a49&id=ba70ddb4-47bb-4f63-9e5d-e6df166f08be" -OutFile $ssh_key_pub_path).Content

# Define the profile content
$profile_content = @"
Host ssh.lightning.ai
  IdentityFile $ssh_key_path
  IdentitiesOnly yes
  ServerAliveInterval 15
  ServerAliveCountMax 4
  	StrictHostKeyChecking no
  	UserKnownHostsFile=\\.\NUL
"@

# Define the SSH config file path
$ssh_config_file = "$HOME\.ssh\config"
New-Item $ssh_config_file -ItemType File -ErrorAction SilentlyContinue

# Check if the profile already exists in the SSH config file
$fileContent = Get-Content -Path $ssh_config_file -Raw
$pattern = "Host\s+ssh.lightning.ai\s*\n\s*IdentityFile"
if ($fileContent -match $pattern) {
    Write-Output "[OK] Profile for 'ssh.lightning.ai' already exists. Nothing to do."
} else {
    # Append the profile to the SSH config file
    Add-Content -Path $ssh_config_file -Value `r`n$profile_content -Force
    Write-Output "[OK] Profile for 'ssh.lightning.ai' added to '$ssh_config_file'."
}

Write-Output "[OK] Generated SSH key"
Write-Output "[OK] Key saved to $ssh_key_path"
Write-Output "[OK] Added SSH profile to $ssh_config_file"
Write-Output "To SSH into a running Studio: "
Write-Output ""
Write-Output "  ssh s_01kea78sgzhjfybfhnrcf5nhgm@ssh.lightning.ai"
Write-Output ""
