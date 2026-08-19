# FlowPilot

`FlowPilot` 是一个 Chrome 侧边栏扩展，用来批量处理 ChatGPT / OpenAI 账号注册、授权和多目标账号交付流程。

它的定位不是“单个按钮脚本”，而是把注册、验证码、OAuth、账号交付、自动重试和记录管理放进同一套可持续使用的工具里；Plus 底层流程暂存，但当前不提供用户入口。

## 插件效果

一百五十个号，一个 401：

<div align="center">

# 交流群请进官网查看

### <a href="https://flowpilot.qlhazycoder.top/" target="_blank" rel="noreferrer">点击进入官网查看最新地址与交流群入口</a>

**最新地址、交流群入口、最新通知，统一以官网为准。**

</div>

## Star History

<a href="https://star-history.dera.page/#QLHazyCoder/FlowPilot&type=timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=QLHazyCoder/FlowPilot&type=timeline&logscale&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=QLHazyCoder/FlowPilot&type=timeline&logscale&legend=top-left" />
    <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=QLHazyCoder/FlowPilot&type=timeline&logscale&legend=top-left" />
  </picture>
</a>

## 主要功能

- 支持普通注册授权链路，既可以单步执行，也可以整套 `Auto` 执行。
- 支持 `CPA`、`SUB2API`、`Codex2API` 三种 OpenAI 来源，以及独立的 `Kiro` 和 `Grok` flow。
- 支持邮箱注册、验证码收取、登录验证码处理、OAuth 同意页确认和平台侧账号创建。
- OpenAI 来源支持按目标选择账号交付方式：`CPA` 支持 OAuth / ChatGPT Session，`SUB2API` 支持 OAuth / ChatGPT Session / Agent Identity，其他 OpenAI target 使用各自固定交付 route。
- 支持 `Hotmail`、`2925`、`QQ Mail`、`163 Mail`、`163 VIP Mail`、`126 Mail`、`Inbucket`、`Cloud Mail`、`YYDS Mail`、`iCloud` 等收码方式。
- 支持 `DuckDuckGo`、`Cloudflare`、`自定义邮箱池`、`自定义邮箱服务号池`、`Gmail / 2925 别名邮箱` 等注册邮箱生成方式。
- 支持接码平台、手机号验证、自动重试、执行范围限制、IP 代理、贡献模式和账号记录面板。
- 支持 `Stop`、暂停后继续、失败后重试，以及本地 helper 快照同步。

## 支持的来源

- `CPA`
  支持 OAuth 和 ChatGPT Session 两种账号交付方式。

- `SUB2API`
  支持 OAuth、ChatGPT Session 和 Agent Identity 三种账号交付方式。

- `Codex2API`
  当前固定使用 OAuth 交付。

- `webchat`
  OpenAI flow 的私有远程上传 target，注册成功后读取当前 ChatGPT Session 并上传。

- `ChatGPT2API`
  OpenAI flow 的私有远程上传 target，固定读取当前 ChatGPT Session 并上传。

- `Kiro`
  独立的 Builder ID 注册、桌面授权和 `kiro.rs` 上传链路，不复用 OpenAI 的 Plus 和平台接入逻辑。

- `Grok`
  独立的 xAI 注册链路。选择 `webchat2api` 时提取并上传 SSO；选择 `grok2api` 时将 SSO 上传到固定的 `pool: auto` 账号池；选择 `SUB2API` 时使用 SUB2API 官方 OAuth 自动完成授权和账号创建，也可开启双发布，先上传到 `grok2api` 再继续 OAuth。Grok 注册邮箱固定作为创建到 `SUB2API` 的账号名称。

## OpenAI 账号交付

- 在 OpenAI flow 选择来源后，多方式 target 会显示独立的 `账号交付` 控件；偏好按 target 保存，切换来源后会恢复对应 target 的选择。
- `CPA` 可选择 `OAuth` 或 `ChatGPT Session`；`SUB2API` 可选择 `OAuth`、`ChatGPT Session` 或 `Agent Identity`。
- `Codex2API` 固定使用 `OAuth`；`webchat` 和 `ChatGPT2API` 固定使用 ChatGPT Session，因此不会显示多余的选择控件。
- `Agent Identity` 会先完成 SUB2API 配置预检，再在内存中生成身份并导入；原始 ChatGPT access token、私钥和完整敏感载荷不会写入持久设置或日志。
- 账号交付方式在 workflow 运行期间、设置锁定期间以及贡献模式下不可编辑；贡献模式固定使用 OAuth。

## Plus 状态

Plus 当前暂时不可用：侧边栏和启动入口均隐藏/关闭 Plus，旧配置也会被强制归一为关闭。PayPal、Hosted 和免支付底层实现仅作为后续恢复所需的 dormant 代码保留。

## 自动化能力

- 支持手动单步执行、自动整套执行、手动跳过、失败重试和中途停止。
- 支持在同一轮里保留账号身份，自动把邮箱、手机号、注册邮箱状态和平台回调状态串起来。
- 支持“记录”面板查看成功、失败、停止、重试次数，以及同一轮的邮箱/手机号组合身份。
- 支持把账号记录同步到本地 helper，方便直接查看 `data/account-run-history.json`。

## 邮箱与验证码能力

- 支持网页邮箱轮询、API 邮箱轮询和本地 helper 读取三类模式。
- 支持注册验证码、登录验证码与绑定邮箱验证码处理。
- `2925` 支持多账号池、自动登录、自动切号、24 小时冷却。
- `Hotmail` 支持远程服务模式和本地 helper 模式。
- `自定义邮箱池` 和 `自定义邮箱服务号池` 都可以和自动运行轮数联动。

## 快速开始

1. 在 `chrome://extensions/` 打开开发者模式。
2. 点击“加载已解压的扩展程序”，选择本项目目录。
3. 打开扩展侧边栏，先选择当前要跑的 `flow` 和 `来源`。
4. 按你的使用方式配置邮箱、验证码来源、账号交付方式和目标平台参数。
5. 先手动跑通前几步，再使用 `Auto` 跑完整链路。

## 操作间延迟

- `操作间延迟` 默认开启，默认值是 `2 秒`。
- 它主要作用于页面里的点击、输入和短等待节奏，让操作更稳一些。
- 它不影响邮箱验证码轮询、短信验证码轮询、OTP 轮询，也不改变 `confirm-oauth` 和 `platform-verify` 这类后台步骤的执行节奏。

## 文档入口

- [项目文件结构说明.md](./项目文件结构说明.md)
- [项目完整链路说明.md](./项目完整链路说明.md)
- [项目开发规范（AI协作）.md](./项目开发规范（AI协作）.md)
- [使用教程总索引](./docs/使用教程/使用教程.md)

如果你只想知道“这个扩展能做什么、该怎么开用”，看本 README 就够了。

如果你要继续开发、补链路、加步骤或排查运行态，请再看上面的两份技术文档。
