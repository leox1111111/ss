param(
    [Parameter(Mandatory=$true)][string]$Server,
    [Parameter(Mandatory=$true)][string]$Nick,
    [Parameter(Mandatory=$true)][string]$Text
)

$body = @{ nick = $Nick; text = $Text } | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$Server/api/messages" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "[nie udalo sie wyslac wiadomosci]"
}
