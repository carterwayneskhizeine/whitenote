#!/bin/bash
# 修复 WhiteNote Docker 数据目录权限

echo "Fixing WhiteNote data directory permissions..."

# 修复 link_md 目录权限
docker exec -u root whitenote-app sh -c "chmod -R 777 /app/data/link_md" 2>/dev/null

# 修复 uploads 目录权限
docker exec -u root whitenote-app sh -c "chmod -R 777 /app/data/uploads" 2>/dev/null

echo "✓ Permissions fixed"
echo ""
echo "You can now export data from the web interface."
