# PowerShell script to execute update-spmt-regions.sql
# This script will update the database with SPMT regions

$sqlFile = "update-spmt-regions.sql"
$sqlContent = Get-Content $sqlFile -Raw

# Execute SQL using mysql command
$env:MYSQL_PWD = Read-Host "Enter MySQL password" -AsSecureString
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:MYSQL_PWD))

try {
    Write-Host "Executing SQL script to update SPMT regions..."
    $sqlContent | mysql -u root -p$password spmt_pelindo
    Write-Host "Database updated successfully with SPMT regions!"
} catch {
    Write-Error "Failed to execute SQL script: $_"
}
