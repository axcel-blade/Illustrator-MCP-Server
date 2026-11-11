<# Generates a random 48-character token for MCP_AUTH_TOKEN or MCP_SECRET_PATH. #>
$bytes = New-Object byte[] 36
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
