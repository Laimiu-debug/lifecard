#!/bin/bash
# Life Card API 部署脚本
# 使用方法: ./deploy.sh

set -e

APP_NAME="life-card-api"
APP_PORT=8080
IMAGE_NAME="life-card-api:latest"

echo "=== Life Card API 部署脚本 ==="

# 1. 构建 Docker 镜像
echo ">>> 构建 Docker 镜像..."
docker build -t $IMAGE_NAME .

# 2. 停止并删除旧容器（如果存在）
echo ">>> 停止旧容器..."
docker stop $APP_NAME 2>/dev/null || true
docker rm $APP_NAME 2>/dev/null || true

# 3. 创建 uploads 目录
echo ">>> 创建 uploads 目录..."
mkdir -p ~/life-card-uploads

# 4. 启动新容器
echo ">>> 启动新容器..."
docker run -d \
  --name $APP_NAME \
  --restart unless-stopped \
  --network host \
  -v ~/life-card-uploads:/app/uploads \
  --env-file .env.production \
  $IMAGE_NAME

# 5. 检查容器状态
echo ">>> 检查容器状态..."
sleep 3
if docker ps | grep -q $APP_NAME; then
    echo "✅ 容器启动成功！"
    echo ">>> 查看日志: docker logs -f $APP_NAME"
    echo ">>> API 地址: http://localhost:$APP_PORT"
    echo ">>> 健康检查: curl http://localhost:$APP_PORT/health"
else
    echo "❌ 容器启动失败，查看日志："
    docker logs $APP_NAME
    exit 1
fi
