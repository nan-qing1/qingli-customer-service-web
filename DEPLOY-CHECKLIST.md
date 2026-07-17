# 第二步：部署平台准备清单

推荐部署平台：Render。

## 需要你准备

1. Render 账号
2. GitHub 账号
3. 一个后台密码
4. 域名申请完成后再绑定，当前可以先用 Render 临时链接

## Render 配置

本项目已经包含：

```text
render.yaml
```

Render 会识别：

```text
buildCommand: npm install
startCommand: npm start
```

建议环境变量：

```text
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
DATA_DIR=/var/data
```

## 数据保存

当前版本使用 JSON 数据库文件。

Render 上建议使用 Disk：

```text
mountPath: /var/data
size: 1GB
```

这样客户资料会保存到：

```text
/var/data/customers.json
```

后续正式产品可以替换成 PostgreSQL。

## 部署后测试

部署成功后测试：

```text
/api/health
/
/admin
```

后台登录：

```text
用户名：admin
密码：你在 Render 环境变量里设置的 ADMIN_PASSWORD
```

功能测试：

- 前端提交资料卡
- 后台看到客户档案
- 修改跟进阶段
- 修改风险等级
- 知识库审核弹窗
- 导出 Excel / CSV / JSON
- 分析看板导出 Excel 透视表
