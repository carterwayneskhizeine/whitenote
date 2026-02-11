# 生成备份文件名
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "D:\Code\whitenote\backups\whitenote_backup_$timestamp.sql"

# 直接让 pg_dump 写入文件，避免 PowerShell 管道
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl --encoding=UTF8 > $backupFile

Write-Host "备份完成: $backupFile"
