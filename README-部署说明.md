# 清力技术客服 Web 产品部署说明

这是可部署的第一版 Web 产品包。

## 本地运行

在当前目录运行：

```bash
npm start
```

打开：

```text
前端客服页：http://localhost:8787/
后台管理页：http://localhost:8787/admin
健康检查：http://localhost:8787/api/health
```

后台默认账号：

```text
用户名：admin
密码：qingli2026
```

可以通过环境变量修改：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
PORT
```

## 当前数据保存方式

当前包为了方便演示和部署，默认使用本地 JSON 文件：

```text
data/customers.json
```

前端客户提交资料卡后，会写入：

```text
PUT /api/customers/:id
```

后台读取客户档案：

```text
GET /api/customers
```

后台批量保存：

```text
PUT /api/customers
```

## 部署到 Render 的步骤

1. 把 `qingli-web-product` 文件夹上传到 GitHub 仓库。
2. 在 Render 新建 Blueprint，选择仓库里的 `render.yaml`。
3. 如果不用 Blueprint，也可以手动新建 Web Service。
4. Build Command 填：

```bash
npm install
```

5. Start Command 填：

```bash
npm start
```

6. 配置环境变量：

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成更安全的密码
NODE_ENV=production
DATA_DIR=/var/data
```

7. 配置 Render Disk：

```text
mountPath=/var/data
size=1GB
```

8. 部署成功后先用 Render 临时链接测试。
9. 域名下来后，在 Render 绑定自定义域名并配置 DNS。

## 后续正式数据库版本

正式产品建议把 `data/customers.json` 替换为 PostgreSQL。

数据库结构草案在：

```text
database/schema.sql
```

建议正式上线前完成：

- PostgreSQL 客户档案持久化
- 后台登录改为更完整的 session 登录
- 操作审计日志
- 数据库自动备份
- HTTPS 与域名绑定
- 导出权限控制
