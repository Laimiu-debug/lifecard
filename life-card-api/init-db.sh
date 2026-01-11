#!/bin/bash
# 数据库初始化脚本
# 使用方法: ./init-db.sh

set -e

# 配置 - 请根据实际情况修改
PG_CONTAINER="postgres"  # PostgreSQL 容器名称，如果不是容器运行请修改
PG_USER="postgres"
PG_PASSWORD="your_password"  # 请修改为实际密码
DB_NAME="life_card_db"

echo "=== 初始化 Life Card 数据库 ==="

# 检查 PostgreSQL 容器是否存在
if docker ps | grep -q postgres; then
    echo ">>> 检测到 PostgreSQL 容器运行中"
    
    # 创建数据库（如果不存在）
    echo ">>> 创建数据库 $DB_NAME..."
    docker exec -i $PG_CONTAINER psql -U $PG_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "数据库可能已存在，继续..."
    
    # 执行迁移脚本
    echo ">>> 执行数据库迁移..."
    docker exec -i $PG_CONTAINER psql -U $PG_USER -d $DB_NAME < migrations/001_initial_schema.sql
    
    echo "✅ 数据库初始化完成！"
else
    echo ">>> 未检测到 PostgreSQL 容器，尝试直接连接..."
    
    # 安装 psql 客户端（如果需要）
    if ! command -v psql &> /dev/null; then
        echo ">>> 安装 PostgreSQL 客户端..."
        sudo apt-get update && sudo apt-get install -y postgresql-client
    fi
    
    # 创建数据库
    echo ">>> 创建数据库 $DB_NAME..."
    PGPASSWORD=$PG_PASSWORD psql -h 127.0.0.1 -U $PG_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "数据库可能已存在，继续..."
    
    # 执行迁移脚本
    echo ">>> 执行数据库迁移..."
    PGPASSWORD=$PG_PASSWORD psql -h 127.0.0.1 -U $PG_USER -d $DB_NAME -f migrations/001_initial_schema.sql
    
    echo "✅ 数据库初始化完成！"
fi
