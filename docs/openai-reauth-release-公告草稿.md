# 新增 OpenAI 重新授权流程（含新增浏览器权限）

本次更新新增独立的 OpenAI Reauth flow，并因「批量结果一键下载整文件」能力新增 `downloads` 权限。**升级扩展时浏览器会弹出权限授予提示，属正常现象，授权后即可正常使用全部功能。**

## 本次调整

- 新增独立流程 **「OpenAI 重新授权」**：针对 `refresh_token` 路径已被服务端 revoke、必须重新走完整 OAuth 才能拿到新 token 的 sub2api 账号
- 支持单账号 / sub2api 整文件 / accounts 数组三种 JSON 输入
- 支持「批量模式」：一次性对整文件内所有账号执行重新授权，自动累计成功 / 失败结果
- 批量结果可一键下载为整文件 JSON（保留原文件结构，失败账号原样保留）
- 提供 2925 / Hotmail / iCloud / LuckMail / Cloud Mail / YYDS Mail / Cloudflare Temp Email 七种邮箱来源

## 影响范围

- **新增浏览器权限**：`downloads`（仅用于批量结果整文件下载）
- 升级后首次启用时，Chrome 会显示「此扩展需要新权限」提示，需要点击「启用扩展」/「授予」才会继续运行
- 不影响现有 OpenAI 注册流程 / Kiro / Grok flow 的使用

## 用户需要做什么

- 升级后在 `chrome://extensions` 页面**确认授予新权限**（仅一次）
- 如果没有重新授权需求，可继续使用原 flow，无需任何操作
- 需要重新授权时：sidepanel 切到「OpenAI 重新授权」→ 选 sub2api JSON 文件 → 选邮箱来源 → 单账号点「自动」/ 多账号开启「批量模式」→ 完成后下载更新后的整文件 JSON

## 补充说明

- 本次新增的 `downloads` 权限仅在用户主动点击「下载完整 JSON 文件」时使用，不会主动写入任何本地文件
- 所有 token / refresh_token 全程在本机处理，不外发任何第三方
- 升级后如未弹权限提示但流程报错，请手动 disable / re-enable 扩展触发权限授予
