# Multi-Page Automation

一个用于批量跑通 ChatGPT OAuth 注册/登录流程的 Chrome 扩展。

当前版本基于侧边栏控制，支持单步执行、整套自动执行、停止当前流程、保存常用配置，以及通过 DuckDuckGo / QQ / 163 / 163 VIP / 126 / Inbucket / Hotmail / Cloud Mail 协助获取验证码。

## 插件效果

一百五十个号，一个401：

<table>
  <tr>
    <td align="center" width="100%">
      <a href="https://apikey.qzz.io/" target="_blank" rel="noreferrer">
        <img src="docs/images/交流群.jpg" alt="QQ交流群，便于大家交流" width="100%" />
      </a><br />
      <strong><a href="https://apikey.qzz.io/" target="_blank" rel="noreferrer">官网 / QQ交流群入口</a></strong><br />
      点击进入官网，查看最新地址与交流入口
    </td>
  </tr>
</table>

## Star History

<a href="https://www.star-history.com/?repos=QLHazyCoder%2Fcodex-oauth-automation-extension&type=timeline&logscale&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=QLHazyCoder/codex-oauth-automation-extension&type=timeline&logscale&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=QLHazyCoder/codex-oauth-automation-extension&type=timeline&logscale&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=QLHazyCoder/codex-oauth-automation-extension&type=timeline&logscale&legend=top-left" />
  </picture>
</a>

## 当前能力

- 从 CPA 面板自动获取 OpenAI OAuth 授权链接
- 自动打开 OpenAI 注册页并点击 `Sign up / Register`
- 自动填写邮箱与密码
- 支持自定义密码；留空时自动生成强密码
- 自动显示当前使用中的密码，便于后续保存
- 自动获取注册验证码与登录验证码
- 支持 `Hotmail`：继续使用 `邮箱 + 客户端 ID + 刷新令牌（refresh token）`，并可在远程服务与本地助手两种模式间切换
- 支持 `2925`：新增多账号池、自动登录登出、Step 4 / Step 8 命中“子邮箱已达上限邮箱”后的 24 小时禁用与自动切号
- 支持 `Cloud Mail`：可通过 skymail.ink API 生成自定义域邮箱，也可作为转发收件通道轮询验证码
- 支持 `QQ Mail`、`163 Mail`、`163 VIP Mail`、`126 Mail`、`Inbucket mailbox`
- 支持从 DuckDuckGo Email Protection 自动生成新的 `@duck.com` 地址
- 支持基于 Cloudflare 自定义域名自动生成随机邮箱前缀
- Step 5 同时兼容两种页面：
  - 页面要求填写 `birthday`
  - 页面要求填写 `age`
- 支持 `Auto` 多轮运行
- 支持中途 `Stop`
- 支持通过日志区的 `记录` 按钮查看账号记录面板，同一轮的邮箱和手机号会合并显示，按最终状态、时间、失败标签和重试次数筛选
- 支持将账号记录完整快照同步到本地 helper，便于开发者直接查看 `data/account-run-history.json`
- Step 8 会自动寻找 OAuth 同意页的“继续”按钮，并通过 Chrome debugger 输入事件发起点击，然后监听本地回调地址


## 环境要求

- Chrome 浏览器
- 打开扩展开发者模式
- 你自己的 CPA 管理面板，且页面结构与当前脚本适配
- 至少准备一种验证码接收方式：
  - DuckDuckGo `@duck.com` + QQ / 163 / Inbucket 转发
  - Cloudflare 自定义域邮箱前缀 + QQ / 163 / Inbucket 转发
  - 手动填写一个可收信邮箱
- 如果使用 `QQ` / `163` / `163 VIP` / `126` / `Inbucket`，对应页面需要提前能正常打开

## 安装

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目目录
5. 打开扩展侧边栏

## 2026-04-17 更新补充：Gmail / 2925 别名邮箱

本次版本对 `Gmail` 与 `2925 provide` 的注册邮箱逻辑做了统一整理：

- `Gmail` 与 `2925 provide` 现在都走同一套“别名邮箱”逻辑。
- 两者都不再使用“只填前缀再特殊拼接”的界面交互。
- 两者都要求先填写“基邮箱”：
  - `Gmail`：例如 `name@gmail.com`
  - `2925`（仅 provide 模式）：例如 `name@2925.com`
- 侧边栏里的“注册邮箱”输入框对这两种模式都已开放，可直接手动填写完整邮箱。
- 侧边栏里的 `获取 / 生成` 按钮对这两种模式也可用，行为与 Duck / Cloudflare 一样，都是“可自动生成，也可手动覆盖”。
- 当 `Mail = 2925` 且模式切到 `接收邮箱` 时，不再走别名基邮箱链路，而是回退到普通“邮箱生成 / 手动填写注册邮箱”路线，2925 只负责后续收信。

具体行为：

- `Gmail` 会基于完整基邮箱生成 `name+tag@gmail.com`
- `2925` 仅在 provide 模式下会基于完整基邮箱生成 `name123456@2925.com`
- 如果当前“注册邮箱”里已经是与当前基邮箱兼容的完整邮箱，流程会优先复用，不会强行重新生成

注意：

- `2925` 旧的“只填前缀”使用方式已经不再推荐，应该改为填写完整基邮箱
- 如果你手动填写了与当前 `Gmail / 2925 provide` 基邮箱不匹配的完整邮箱，侧边栏会在保存或执行 Step 3 时拦截

## 2026-04-23 更新补充：自定义邮箱池

本次版本新增 `自定义邮箱池` 生成方式，用于把一批已经准备好的邮箱按顺序分配给自动流程：

- 在 `邮箱生成` 中选择 `自定义邮箱池`
- 在新出现的 `邮箱池` 文本框里按“每行一个邮箱”填写
- `Auto` 运行次数会自动跟随邮箱池数量，无需再手动对齐轮数
- 同一目标轮次的失败重试会继续复用当前轮邮箱，不会提前跳到下一个
- 实际收码仍然走当前 `Mail` 对应的邮箱服务，因此应保证邮箱池里的地址与当前收码链路匹配

## 2026-04-23 更新补充：自定义邮箱服务号池

当 `Mail = 自定义邮箱` 时，现在也可以直接维护一组“自定义号池”：

- 在 `邮箱服务` 选择 `自定义邮箱`
- 在新出现的 `自定义号池` 文本框里按“每行一个邮箱”填写
- `Auto` 运行次数会自动跟随号池数量
- 只要当前邮箱还没成功认证、也没出现手机号验证，就会持续复用这个邮箱重试
- 只有成功认证，或明确出现 `add-phone / 手机号验证` 时，才会切换到号池中的下一个邮箱
- 这条链路只负责分配注册邮箱；第 `4 / 8` 步仍然保持手动输入验证码，不会改成自动轮询邮箱

## 快速开始

如果你只是想先跑通一套最稳的组合，建议直接按下面三种方案之一配置。

### 方案 A：`CPA + QQ / 163 / 163 VIP / 126`

1. `CPA` 填你的管理面板 OAuth 页面地址
2. `Mail` 选择 `QQ Mail`、`163 Mail`、`163 VIP Mail` 或 `126 Mail`
3. `邮箱生成` 选择 `DuckDuckGo`、`Cloudflare` 或 `自定义邮箱池`
4. 若你选择 `Cloudflare`，先按下文把 Cloudflare Email Routing 配好
5. 若你选择 `自定义邮箱池`，就在 `邮箱池` 中按行填入邮箱；否则点击 `获取` 生成邮箱，或手动粘贴一个你能收信的邮箱
6. 先单步验证 `Step 1 ~ Step 4`
7. 验证没问题后再点右上角 `Auto`

### 方案 B：`SUB2API + QQ / 163 / 163 VIP / 126`

1. `来源` 选择 `SUB2API`
2. 填好 `SUB2API` 地址、登录邮箱、登录密码、分组名
3. `Mail` 与 `邮箱生成` 的配置方式同方案 A
4. Step 1 会直接在 SUB2API 后台生成 OAuth 链接
5. Step 10 会把 localhost 回调提交回 SUB2API，并直接创建 OpenAI 账号

### 方案 C：`Codex2API + QQ / 163 / 163 VIP / 126`

1. `来源` 选择 `Codex2API`
2. 填好 `Codex2API` 后台地址、管理密钥
3. `Mail` 与 `邮箱生成` 的配置方式同方案 A
4. Step 7 会直接通过 Codex2API 协议 `/api/admin/oauth/generate-auth-url` 生成 OAuth 链接
5. Step 10 会把 localhost 回调中的 `code / state` 通过 `/api/admin/oauth/exchange-code` 直接提交给 Codex2API

### 方案 D：`Hotmail 账号池`

1. `Mail` 选择 `Hotmail`
2. 在 `Hotmail 账号池` 中添加 `邮箱 / Client ID / Refresh Token`
3. 先点 `校验`，再点 `测试收信`
4. 通过后再执行步骤或 `Auto`
5. 当前项目中，`Mail = Hotmail` 时会直接使用账号池里的邮箱作为注册邮箱，不再走 `Duck / Cloudflare` 自动生成

### 方案 E：`2925 账号池`

1. `Mail` 选择 `2925`
2. 在 `2925 账号池` 中添加 `邮箱 / 密码`
3. 先根据你的用途选择 `2925 模式`
   - `提供邮箱`：注册邮箱本身就是 2925 别名，会显示“别名基邮箱”输入
   - `接收邮箱`：注册邮箱回退到普通“邮箱生成 / 手动填写”路线，2925 只负责收信
4. `2925 号池` 现在是独立配置行；开启 `号池` 后可从下拉框中选择当前 2925 账号。若当前处于 `提供邮箱` 模式，这个账号也会同步作为别名基邮箱
5. 可先点 `使用此账号` 让当前 2925 账号切到这条记录，再点 `登录` 手动验证网页邮箱登录态
6. 只有在 `号池` 开关开启时，自动流程执行到 Step 4 / Step 8 前才会自动检查 2925 登录态；如果未登录，会先清理登录 cookie、等待 `3 秒`，再打开登录页，并在页面打开后再等待 `3 秒`，然后使用当前账号自动登录；填写完账号密码后会额外等待 `1 秒` 再点击登录，点击后若 `40 秒`内仍未进入收件箱，则会判定当前登录失败
7. 当 Step 4 / Step 8 轮询邮箱时遇到“子邮箱已达上限邮箱”，扩展会记录当前时间；如果还有下一个可用账号，就禁用当前账号 24 小时并自动切换登录；如果没有下一个可用账号，或当前未启用号池模式，则会直接复用现有“手动暂停 / 停止”逻辑终止自动流程
8. 如果你同时开启了 `Auto` 的自动重试，当前尝试结束后会按现有逻辑自动进入下一次尝试，不需要再手动介入
9. 只有 `Mail = 2925` 且模式为 `提供邮箱` 时，才会继续走 Gmail / 2925 共用的别名邮箱链路；例如 `name@2925.com -> name123456@2925.com`

## 侧边栏配置说明

### `CPA`

你的管理面板 OAuth 页面地址，例如：

```txt
http(s)://<your-host>/management.html#/oauth
```

Step 1 和 Step 10 都依赖这个地址。

### `SUB2API`

当 `来源 = SUB2API` 时，需要配置：

- `SUB2API`：后台账号管理页地址
- `账号 / 密码`：SUB2API 管理员登录信息
- `分组`：目标 OpenAI 分组，留空时默认 `codex`
- `默认代理`：可选，填写代理名称或代理 ID；留空时不使用代理

插件会在 Step 1 和 Step 10 自动从 `/api/v1/admin/proxies/all` 解析这个代理，并在 OAuth 链接生成、授权码交换和账号创建请求中附带 `proxy_id`。如果名称匹配到多个代理，请改填代理 ID；留空则不会发送 `proxy_id`。

### `Codex2API`

当 `来源 = Codex2API` 时，需要配置：

- `Codex2API`：后台账号管理页地址，默认 `http://localhost:8080/admin/accounts`
- `管理密钥`：Codex2API 的 `Admin Secret`

插件会在：

- Step 7 调用 `POST /api/admin/oauth/generate-auth-url` 生成授权链接
- Step 10 调用 `POST /api/admin/oauth/exchange-code` 完成 localhost callback 的授权码交换并创建账号

这条来源是协议直连，不依赖 Codex2API 后台页面的“添加账号 / OAuth 授权 / 生成授权链接”按钮 DOM。

### `Mail`

支持八种验证码来源：

- `Hotmail`
- `2925`
- `Cloud Mail`
- `163 Mail`
- `163 VIP Mail`
- `126 Mail`
- `QQ Mail`
- `Inbucket`

说明：

- `Hotmail` 通过侧边栏里的 Hotmail 账号池选择账号，可切换为远程服务模式或本地助手模式
- `2925` 通过侧边栏里的 2925 账号池选择账号，并在 Step 4 / Step 8 前自动校验网页邮箱登录态
- `Cloud Mail` 通过侧边栏配置 API 地址、管理员账号、接收邮箱或生成域名，可直接生成邮箱或轮询转发收件箱
- `QQ`、`163`、`163 VIP`、`126` 用于直接轮询网页邮箱
- `Inbucket` 通过你在侧边栏里配置的 host 访问 `mailbox` 页面：`https://<your-inbucket-host>/m/<mailbox>/`

### `Hotmail 账号池`

仅当 `Mail = Hotmail` 时使用。

可配置项：

- `接码模式`
- `远程服务地址`
- `本地助手地址`

每条账号支持保存：

- `email`
- `clientId`
- `refreshToken`
- 可选邮箱密码备注

使用方式：

- 先选择 Hotmail 接码模式
- 远程模式下填写你自己的远程服务地址
- 本地模式下填写本地助手地址（默认 `http://127.0.0.1:17373`）
- Windows 运行仓库根目录的 `start-hotmail-helper.bat`
- macOS 运行仓库根目录的 `start-hotmail-helper.command`
- 本地 helper 当前仅依赖 Python 标准库，无需额外安装第三方 Python 包
- 再新增账号
- 点击 `校验`
- 校验通过后，可点击 `测试收信`
- Auto 模式每轮会自动选用一个可用账号

### `2925 账号池`

仅当 `Mail = 2925` 时使用。

每条账号支持保存：

- `email`
- `password`

使用方式：

- 添加一个或多个 `2925.com` 账号
- 点击 `使用此账号` 可以切换当前别名基邮箱来源
- 点击 `登录` 可以让扩展直接打开 / 复用 2925 邮箱标签页，并使用当前账号自动登录
- 如果账号因为“子邮箱已达上限邮箱”被临时禁用，列表里会展示上限记录时间和恢复时间
- 命中冷却的账号可手动 `清冷却`，也可以等待 24 小时后自动恢复可用
- Auto 模式在生成 2925 别名邮箱前，会自动分配当前可用账号；若 Step 4 / Step 8 命中上限，会自动切到下一个账号

#### 本地 helper 启动命令

Windows：

```powershell
.\start-hotmail-helper.bat
```

macOS：

```bash
chmod +x ./start-hotmail-helper.command
./start-hotmail-helper.command
```

如果你不想走启动脚本，也可以直接运行 Python 程序本体：

```bash
python scripts/hotmail_helper.py
```

如果你的环境里命令是 `python3`：

```bash
python3 scripts/hotmail_helper.py
```

#### 启动成功标志

本地 helper 启动成功后，终端会输出：

```text
Hotmail helper listening on http://127.0.0.1:17373
```

同时还会输出本地账号记录快照文件路径。看到这些输出后，再回到扩展里点 `校验`、`复制最新验证码`；账号记录快照会按默认本地 helper 地址自动同步，无需再手动开启本地同步。

#### 最小排错说明

- 如果提示 `Python 3 not found`，先安装 Python 3.10+
- 如果 helper 已启动但扩展仍报连接失败，先确认模式切到了 `本地助手`
- 确认本地助手地址与终端输出一致，默认应为 `http://127.0.0.1:17373`
- 如果地址一致仍失败，再检查是否有端口占用或终端里是否已经抛出异常

### `Mailbox`

仅当 `Mail = Inbucket` 时显示。

填写 Inbucket mailbox 名称，例如：

```txt
tmp-mailbox
```

脚本会自动打开：

```txt
https://<your-inbucket-host>/m/<mailbox>/
```

并且只检索未读邮件：

- 只匹配 `.message-list-entry.unseen`
- 第 2 次轮询开始会自动点击 mailbox 页面上的刷新按钮
- 识别到验证码后会尝试删除当前邮件，减少重复命中

### `Inbucket`

仅当 `Mail = Inbucket` 时显示。

这里填写 Inbucket host，支持两种格式：

- `your-inbucket-host`
- `https://your-inbucket-host`

脚本会自动规范化成 origin 后再拼接 mailbox URL。

### `Email`

Step 3 使用的注册邮箱。

来源有两种：

- 手动粘贴
- 按当前生成方式自动生成或分配邮箱（DuckDuckGo / Cloudflare / 自定义邮箱池）

注意：

- 若 `邮箱生成 = Cloudflare`，插件里只需要维护 `CF 域名`
- 若 `邮箱生成 = 自定义邮箱池`，需要在 `邮箱池` 文本框中按行维护邮箱列表
- 若 `Mail = 自定义邮箱` 且你希望多轮自动跑不同邮箱，可直接在 `自定义号池` 文本框中按行维护邮箱列表
- `CF 域名` 支持保存多个，并通过下拉框切换当前要生成的域名
- Cloudflare 侧的转发规则、Catch-all、路由目标邮箱等，都需要你自己提前在 Cloudflare 后台配置好
- 当 `Mail = Hotmail` 时，这个输入框由账号池自动同步当前账号邮箱
- 当 `Mail = Hotmail` 时，Step 3 会直接使用 Hotmail 账号池里的邮箱；`Duck / Cloudflare` 不参与自动邮箱生成
- 当 `Mail = 自定义邮箱` 且启用了 `自定义号池` 时，Auto 会先为当前轮分配一个邮箱；后续普通失败不会换号，只有成功或出现手机号验证才会切到下一个邮箱
- 若你准备走 `Cloudflare`，更推荐把 `Mail` 设为 `QQ / 163 / 163 VIP / 126`；`Inbucket` 仅在它能真实接收外部邮件并完成 Cloudflare 验证时再使用
- `Auto` 会按当前“邮箱生成”配置自动获取或分配邮箱；若当前是 `自定义邮箱池`，则会按邮箱池顺序取用
- 如果你使用 Inbucket，它只是验证码收件箱，不会自动生成 Inbucket 地址

### `邮箱生成 = Cloudflare` 时的配置

- `CF 域名`：例如 `example.xyz`
- 右侧 `添加 / 保存`：用于保存多个可切换的域名
- 下拉框：用于切换当前这次要生成邮箱所使用的域名

#### 当前实现是什么逻辑

Cloudflare 模式下，插件不会再调用 Cloudflare API 创建路由。

它现在只做一件事：

1. 根据你当前选中的 `CF 域名`
2. 本地生成一个 10 位随机前缀
3. 前缀由 `6 个小写字母 + 4 个数字` 组成，顺序随机打乱
4. 直接得到一个类似 `a3b9cd1e2f@example.xyz` 的注册邮箱
5. 把这个邮箱写入当前流程继续往下跑

也就是说，插件默认认为：

- 你已经在 Cloudflare 后台把这个域名的收件转发规则配置好了
- 这个随机前缀邮箱发来的邮件，最终能被你现有的 `163 / QQ / Inbucket` 收件链路接住

#### 你需要自己提前做什么

在 Cloudflare 后台，至少保证下面一条成立：

- 你已经配好了 Catch-all / 通配规则，能接住任意前缀邮箱
- 或者你本来就有一套能覆盖这些随机前缀邮箱的转发规则

否则插件虽然能生成 `@你的域名` 邮箱，但验证码邮件最后没人接收，后面的 Step 4 / Step 7 还是会失败。

#### 推荐搭配

- `Mail = QQ Mail`：Cloudflare 的 `Destination address / Destination addresses` 填你的 QQ 邮箱全地址
- `Mail = 163 Mail`：Cloudflare 的 `Destination address / Destination addresses` 填你的 163 邮箱全地址
- `Mail = 163 VIP Mail`：Cloudflare 的 `Destination address / Destination addresses` 填你的 163 VIP 邮箱全地址
- `Mail = 126 Mail`：Cloudflare 的 `Destination address / Destination addresses` 填你的 126 邮箱全地址
- `Mail = Inbucket`：仅当你的 Inbucket 实例本身就是一个真实可收外部邮件、且能收到 Cloudflare 验证邮件的地址时再使用
- `Mail = Hotmail`：当前项目的自动流程不推荐和 Cloudflare 同时使用；因为 `Mail = Hotmail` 时，注册邮箱会直接使用 Hotmail 账号池邮箱

#### Cloudflare 后台怎么配（按钮中英对照）

下面按钮名称以 Cloudflare 官方英文界面为准，括号内中文仅用于对照理解，不保证是 Cloudflare 的官方中文翻译。

1. 登录 Cloudflare 后台，选中你要用的域名
2. 进入 `Email > Email Routing`
3. 如果这是你第一次给这个域名启用 Email Routing：
   - 先检查 Cloudflare 准备添加的记录
   - 点击 `Add records and enable（添加记录并启用）`
4. 进入 `Routing rules（路由规则）` 或 `Routes（路由）`
5. 先创建一个固定地址，用来把目标收件箱加进 Cloudflare：
   - 点击 `Create address（创建地址）`
   - 在 `Custom address（自定义地址）` 里填一个固定前缀，例如 `cf-init`
   - 在 `Action（动作）` 中选择 `Send to an email（转发到邮箱）`
   - 在 `Destination / Destination addresses（目标邮箱）` 中填你真正收验证码的邮箱
   - 点击 `Save（保存）`
6. 打开 Cloudflare 发到目标邮箱的验证邮件，依次点击：
   - `Verify email address（验证邮箱地址）`
   - `Go to Email Routing（前往 Email Routing）`
7. 回到 Cloudflare 后台后，确认这个目标邮箱的状态已经变成 `Verified（已验证）`
8. 如果 Cloudflare 还在首次启用向导里要求继续：
   - 点击 `Continue（继续）`
   - 点击 `Add records and finish（添加记录并完成）`
9. 对于本项目这种“每次都生成随机前缀”的用法，建议再打开：
   - `Catch-all address（Catch-all 地址）`
   - 让它显示为 `Active（启用）`
   - 在 `Action（动作）` 中选择 `Send to an email（转发到邮箱）`
   - 如果界面要求选择 `Destination（目标邮箱）`，就选你刚刚已经验证通过的那个邮箱
   - 点击 `Save（保存）`
10. 最后再回到插件：
   - `邮箱生成` 选择 `Cloudflare`
   - 在 `CF 域名` 里点 `添加`
   - 输入域名后点 `保存`
   - 点击 `获取`

#### Cloudflare 配好后怎么自测

1. 先在插件里点击 `获取`，拿到一个随机前缀邮箱
2. 用另一个邮箱给这个地址发一封测试邮件
3. 不要用目标邮箱给自己发测试邮件，否则某些邮箱服务会把它当成重复邮件直接吞掉
4. 如果你的 `Mail` 选的是 `QQ / 163 / 163 VIP / 126 / Inbucket`，就去对应收件链路里确认这封测试邮件能否到达

#### 官方参考

- Cloudflare Email Routing 启用流程：<https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/>
- Cloudflare Routing rules / Routes / Catch-all / Destination addresses：<https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/>

#### 最简单的使用方式

1. 在 Cloudflare 后台先把你的域名收件转发规则配好
2. 在插件里选择 `邮箱生成 = Cloudflare`
3. 在 `CF 域名` 里点 `添加`
4. 输入域名后点 `保存`
5. 以后直接从下拉框切换当前使用的域名
6. 点击 `获取`，插件就会基于这个域名生成一个随机邮箱

### `Password`

- 留空：自动生成强密码
- 手动输入：使用你自定义的密码
- 可通过输入框右侧的眼睛图标切换显示
- 配置会自动保存，也可以点击右侧 `保存` 按钮手动保存一次
- 右上角 `配置` 按钮支持导出当前配置到 JSON 文件，也支持从 JSON 文件覆盖导入配置

扩展会把本轮实际使用的密码同步回侧边栏，便于查看和复制。

### `Auto`

整套流程自动跑。

支持多轮运行，运行次数由右上角数字框决定。

`延迟` 里的“启动前倒计时”只控制整轮 Auto 开始前要不要先倒计时多少分钟。

`步间随机` 控制 Auto 流程里**每一步真正执行前**的额外等待秒数。这个设置只影响 Auto，不影响你手动单步点击执行；填 `0` 或留空表示不延迟。

如果当前面板里已经存在未完成进度，点击 `Auto` 时会弹出选择：

- `重新开始`：重置当前流程进度，从 Step 1 开始新一轮
- `继续当前`：把 `已完成 / 已跳过` 视为已处理，从第一个未处理步骤继续往后执行

### 操作间延迟

`操作间延迟` 默认开启。开启后，自动流程和手动单步在每个页面输入、选择、点击、提交、继续或授权操作完成后固定等待 2 秒；第一项页面操作不会提前等待。分格 OTP/验证码会先整组填完，然后只等待一次。

该开关不同于步间间隔，不影响邮箱轮询、短信/WhatsApp 轮询、后台 API、网络重试、后台定时器或存储持久化，也不影响 `confirm-oauth` 和 `platform-verify` 的交互节奏。

## 工作流

### 单步模式

侧边栏共有 10 个步骤按钮，可逐步执行：

1. `Open ChatGPT`
2. `Signup + Email`
3. `Fill Password`
4. `Get Signup Code`
5. `Fill Name / Birthday`
6. `Wait Registration Success`
7. `Login via OAuth`
8. `Get Login Code`
9. `Manual OAuth Confirm`
10. `CPA Verify`

### Auto 模式

点击右上角 `Auto` 后，后台会按顺序跑完整流程。

当前 Auto 逻辑是：

1. Step 1 打开 `https://chatgpt.com/`
2. 根据 `Mail` 选择邮箱来源
3. 如果 `Mail = Hotmail`，会从账号池自动分配一个可用账号
4. 如果 `Mail = 自定义邮箱` 且配置了 `自定义号池`，会按号池顺序分配当前轮邮箱；否则如果不是 Hotmail，则按当前“邮箱生成”配置尝试自动获取或分配邮箱（Duck / Cloudflare / Cloud Mail / iCloud / 自定义邮箱池等）
5. Step 2 点击注册、填写邮箱，并按真实落地页进入密码页或直接进入邮箱验证码页
6. 如果自动获取失败，暂停并等待你在侧边栏填写邮箱后点击 `Continue`
7. 继续执行 Step 3 ~ Step 10

也就是说：

- 如果邮箱可自动获取，整套流程更接近全自动
- 如果自动获取失败，后台会先自动重试 5 次；仍失败时，Auto 才会在邮箱阶段暂停
- Auto 的暂停状态会保存在会话状态中，重新打开侧边栏后仍可继续
- 如果你在 Auto 暂停时改为手动点步骤或跳过步骤，面板会先确认并停止 Auto，再切回手动控制
- 选择 `继续当前` 时，后台不会先做大而全的前置校验，而是从当前步骤状态直接继续；缺什么条件，就在运行到那一步时再报错或暂停
- 除了现有的页面切换等待外，Auto 还会在每一步执行前按 `步间随机` 的秒数额外等待；填 `0` 或留空表示不延迟

## 详细步骤说明

### Step 1: Open ChatGPT

通过动态注入的 `content/signup-page.js`：

- 打开 `https://chatgpt.com/`
- 确认官网首页或注册入口弹窗已经可操作

这一步不再获取 `OAuth` 链接；`OAuth` 链接会在 Step 7 内部按需刷新。

### Step 2: Signup + Email

通过 `content/signup-page.js`：

- 在官网首页查找 `免费注册 / Sign up / Register / 创建账户`
- 自动点击进入注册流程
- 自动填写邮箱
- 点击 `继续`
- 等待真实落地页；进入 `https://auth.openai.com/create-account/password` 时继续 Step 3，进入 `https://auth.openai.com/email-verification` 时自动跳过 Step 3 直接进入 Step 4

### Step 3: Fill Password

- 使用第 2 步已经确定好的邮箱
- 使用自定义密码或自动生成密码
- 在密码页填写密码并提交注册表单
- 后台会在真正把 Step 3 记为完成前，再确认页面是否已经推进；如果此时出现认证页 `重试` 页面，或 `/email-verification` 上的 `405 / Route Error` 重试页，会先通过共享恢复逻辑最多自动点击 5 次 `重试` 尝试恢复，再继续后续链路
- Step 3 收尾阶段如果页面切换导致旧内容脚本失联，后台单次消息等待不会再卡住超过当前收尾预算；若最终仍未恢复，则会输出中文的步骤级错误，而不是直接暴露底层英文通信超时

实际使用的密码会写入会话状态，并同步到侧边栏显示。

### Step 4: Get Signup Code

根据 `Mail` 配置，轮询邮箱并提取 6 位验证码。

进入邮箱轮询前，脚本会先确认认证页是否已经进入验证码页面；如果注册认证流程出现 `糟糕，出错了 / 操作超时（Operation timed out）`，或 `/email-verification` 上的 `405 / Route Error` 且带有 `重试` 按钮，会先通过共享恢复逻辑最多自动点击 5 次 `重试`，必要时回到密码页重新提交，再继续等待验证码页面。

在 `Auto` 模式下，如果 Step 4 当前轮失败，后台不会立刻丢弃这轮邮箱；而是沿用当前邮箱回到 Step 1 重新开始当前轮，避免刚拿到的邮箱被直接换掉。
但如果 Step 4 的认证重试页正文里出现 `user_already_exists`，则会直接判定“当前用户已存在”，不会点击 `重试`，而是立即结束当前轮；开启自动重试时会直接继续下一轮。

支持：

- `Hotmail`（远程服务 / 本地助手）
- `content/qq-mail.js`
- `content/mail-163.js`（163 / 163 VIP / 126）
- `content/inbucket-mail.js`

邮件匹配规则以以下关键词为主：

- 发件人：`openai`、`noreply`、`verify`、`auth`、`duckduckgo`、`forward`
- 标题：`verify`、`verification`、`code`、`验证`、`confirm`

### Step 5: Fill Name / Birthday

随机生成人名与生日。

当前脚本支持两种页面结构：

- 页面要求 `birthday`
- 页面要求 `age`

如果页面是生日模式，会填写年月日；如果页面上存在 `input[name='age']`，则直接填写年龄。
如果资料页出现顶部“我同意以下所有各项”总勾选框，脚本会优先自动勾选，再点击 `完成帐户创建`。
点击 `完成帐户创建` 后，Step 5 会立刻记为完成，不再等待页面跳转结果；自动运行在进入 Step 6 前只会等待当前页面加载完成，不再接管 ChatGPT 跳转或 onboarding 跳过逻辑。

### Step 6: Wait Registration Success

这一步只负责等待注册完成后的页面状态稳定：

- 固定等待 20 秒
- 默认不清理 `chatgpt.com / openai.com` 相关 cookies；侧栏开启第六步 `清 Cookies` 后才会在等待结束后执行清理
- 等待完成后直接进入后续 OAuth 登录链路


### Step 7: Login via OAuth

这一步会重新获取一遍最新的 CPA OAuth 链接，再使用刚注册的账号登录。

当前 Step 7 的完成标准不是“邮箱/密码已提交”，而是：

- 已刷新到最新 OAuth 链接
- 认证页已经真正进入登录验证码页面
- 在真正把 Step 7 记为完成前，还会再做一轮收尾确认；如果页面只是短暂进入登录验证码页、随后又掉进登录重试页，则不会直接进入 Step 8，而是先按共享恢复逻辑处理并重跑 Step 7
- 如遇登录超时报错，会先尝试通过共享恢复逻辑最多自动点击 5 次认证页上的 `重试` 恢复当前页面；若仍未恢复，再按既有逻辑重跑整个 Step 7
- 如遇登录页长时间停滞，会由后台刷新 OAuth 后重跑整个 Step 7
- 如果重试页内容中出现 `max_check_attempts`，会立刻完全停止流程，并在侧边栏复用现有确认弹窗提示这是 Cloudflare 风控拦截，确认按钮显示为“我知道了”
- Step 8 不负责替代 Step 7 的收尾确认；它默认消费的是“已经由 Step 7 确认稳定进入”的登录验证码页，只在后台入口做防御性状态兜底

支持：

- 邮箱 + 密码登录
- 必要时切换到一次性验证码登录
- 直到登录验证码页就绪才算步骤完成

### Step 8: Get Login Code

Step 8 默认要求当前认证页已经处于登录验证码页。

它只负责：

- 打开邮箱并轮询登录验证码
- 填写并提交登录验证码
- 验证码链路失败后按有限次数回退到 Step 7
- 如果进入登录超时报错/重试页，包括 `/email-verification` 上的 `405 / Route Error` 登录重试页，会直接报错并回到 Step 7，不会在 Step 8 内部点击 `重试`
- 如果重试页内容中出现 `max_check_attempts`，会直接完全停止整个流程，并复用现有确认弹窗提醒先等待 15 到 30 分钟或更换浏览器，确认按钮显示为“我知道了”
- 当 `Mail = 自定义邮箱` 时，Step 8 的手动确认弹窗会额外提供一个“出现手机号验证”按钮；点击后会直接按真实 `add-phone` fatal 错误处理，日志和自动切号行为与页面实际进入手机号验证时保持一致

与 Step 4 类似，但会使用稍微不同的关键词组合去找登录验证码邮件。

### Step 9: Manual OAuth Confirm

严格回调捕获规则：

- 步骤 9 现在只接受 `http(s)://localhost:<port>/auth/callback?code=...&state=...` 或 `http(s)://127.0.0.1:<port>/auth/callback?code=...&state=...`
- 监听范围只限于当前 OAuth 认证标签页的主 frame 跳转
- 普通 `localhost` 页面，包括本地部署的 CPA 面板，不会再被误判为回调地址

虽然按钮名称还是 `Manual OAuth Confirm`，但当前代码已经做了自动尝试：

- 在授权页定位“继续”按钮
- 等待按钮可点击
- 获取按钮坐标
- 通过 Chrome `debugger` 的输入事件点击该按钮
- 点击后会持续检查页面是否真正离开当前状态；如果点击后出现认证页 `重试` 页面，则直接报错，不会在 Step 9 内部点击 `重试`
- 同时监听 `chrome.webNavigation.onBeforeNavigate`
- 一旦捕获本地回调地址，就把结果保存到 `Callback`

注意：

- 这一步仍然是最容易因页面变化而失效的一步
- 如果 120 秒内没有捕获到 localhost 回调，会报错超时
- README 中的按钮名称沿用了旧文案，但代码行为是“自动尝试点击”

### Step 10: CPA Verify

校验规则：

- 步骤 10 会拒绝任何不是真实 `/auth/callback`，或缺少 `code` / `state` 的本地回调地址
- 成功后的清理只会针对 `/auth` 这一类真实回调标签页，不会再泛化清理任意 localhost 路径
- 侧边栏可切换“回调方式”，默认是 `服务器部署`
- 选择 `服务器部署` 时，即使 CPA 部署在本地，也会执行步骤 10
- 选择 `本地部署` 时，仅当本地 CPA 且步骤 9 已拿到回调地址时，才会直接跳过步骤 10

回到 CPA 面板：

- 自动填写 localhost 回调地址
- 自动点击“提交回调 URL”
- 必须等到 CPA 面板出现精确的 `认证成功！` 状态徽标后，才判定成功
- 成功后会自动关闭匹配 `http://localhost:1455/auth` 这一类前缀的 localhost 残留页面

## Duck 邮箱自动获取

通过 `content/duck-mail.js`：

- 打开 DuckDuckGo Email Protection Autofill 设置页
- 查找当前私有地址
- 如需要，点击 `Generate Private Duck Address`
- 读取新的 `@duck.com` 地址

这个功能会被：

- 侧边栏 `Email` 旁边的 `Auto` 按钮使用
- `Auto Run` 流程优先尝试使用

## 停止机制

扩展内置了停止当前流程的能力：

- 侧边栏点击 `Stop`
- Background 会广播 `STOP_FLOW`
- 各 content script 会在等待、轮询、sleep、元素查找中尽量中断

适合以下场景：

- 卡在某一步
- 邮件迟迟不来
- 页面结构变化导致等待超时
- Auto 暂停后，明确放弃 Auto、改为手动接管

## 状态与数据

运行时状态主要使用 `chrome.storage.session` 保存：

- 当前步骤
- 每一步状态
- OAuth 链接
- 当前邮箱
- 当前密码
- localhost 回调地址
- 账号记录
- tab 注册信息
- 各来源最近一次打开的地址（用于打开新地址前清理旧标签）
- Auto 当前阶段、当前轮次、暂停信息

配置项另外使用 `chrome.storage.local` 持久化保存：

- CPA 地址
- CPA 管理密钥
- 自定义密码
- 邮箱服务
- Inbucket 主机
- Inbucket 邮箱名
- Hotmail 账号池与对应令牌
- 兜底开关

特点：

- 运行时步骤状态是浏览器会话级存储
- 配置项会持久化保存，关闭浏览器后重新打开仍会恢复
- 扩展运行期间可在多个步骤之间共享
- 代码里已启用 `storage.session` 对 content script 的访问
- 同一来源打开新地址前，会先按来源/站点范围关闭旧标签，避免旧页面残留

## 项目结构

```txt
background.js              后台主控，编排 1~9 步、Tab 复用、状态管理
manifest.json              扩展清单
data/names.js              随机姓名、生日数据
content/utils.js           通用工具：等待元素、点击、日志、停止控制
content/vps-panel.js       CPA 面板步骤：内部 OAuth 刷新 / Step 10
content/signup-page.js     ChatGPT 官网 + OpenAI 注册/登录页步骤：Step 1 / 2 / 3 / 5 / 7 / 9
hotmail-utils.js           Hotmail 收信相关通用辅助
mail-provider-utils.js     网页邮箱 provider 配置辅助
content/duck-mail.js       Duck 邮箱自动获取
content/qq-mail.js         QQ 邮箱验证码轮询
content/mail-163.js        163 / 163 VIP / 126 邮箱验证码轮询
content/inbucket-mail.js   Inbucket mailbox 验证码轮询
sidepanel/                 侧边栏 UI
```

## 常见使用建议

### 1. 先单步验证，再开 Auto

推荐先手动跑通一次：

1. Step 1
2. Step 2
3. Step 3
4. Step 4

确认邮箱和验证码链路稳定后，再使用 `Auto`。

### 2. Inbucket 建议使用专用 mailbox

当前 Inbucket 逻辑只看未读邮件，但还是建议：

- 给脚本准备一个相对独立的 mailbox
- 避免收件箱里混入过多无关邮件

### 3. 自动获取失败时直接手填

如果 Duck 页面打不开、Cloudflare 域名未配置、未登录或按钮变化：

- 直接在 `Email` 输入框中粘贴邮箱
- 手动点 `Step 3` 时，如果邮箱为空，脚本会先自动尝试获取 Duck 邮箱；失败后再改为手填
- Auto 暂停时，仍可手动粘贴邮箱后点击 `Continue`

### 4. 跳过步骤

- 每个步骤右侧都会在满足顺序条件时出现一个小按钮，用来直接跳过该步骤
- 点击后会先弹窗确认；它不会真正执行脚本，只会把该步骤状态改为“已跳过”，从而放行后续步骤
- 跳过按钮的规则很简单：只要上一步已完成、当前步骤没在运行，就可以使用；Step 1 没有前置步骤，也可直接跳过
- 如果 Auto 处于暂停状态，点击该按钮会先确认是否接管 Auto

### 5. Step 8 失败时重点检查

补充检查项：

- 确认回调路径仍然是 `/auth/callback`
- 确认回调 query 里仍然同时包含 `code` 和 `state`
- 如果 CPA 部署在 `localhost`，确认当前看到的页面是真实 OAuth 回调，而不是 CPA 面板自身页面

- OAuth 同意页 DOM 是否变化
- “继续”按钮是否变成了别的文案
- localhost 回调是否真的触发
- 浏览器是否允许 debugger 附加

## 已知限制

- Step 8 对页面结构较敏感
- Duck 自动获取依赖 Duck 页面真实 DOM
- CPA 面板 DOM 也需要和当前脚本选择器匹配
- `Auto` 按钮名称和 Step 8 的旧文案还未完全统一，但代码行为以实际实现为准

## 调试建议

- 打开扩展侧边栏看日志
- 查看 Service Worker 控制台
- 查看目标页面的 content script 控制台日志
- 当某一步频繁失败时，优先检查当前页面选择器是否仍然匹配

## 安全说明

- 所有状态仅保存在浏览器会话中
- 没有硬编码你的 CPA 地址、密码或账户
- 自定义密码只存在当前会话存储中
- 邮箱和密码会被记录到本轮 `accounts` 中，便于追踪本次运行结果

## 来源与致谢

本项目早期代码与 [whwh1233/StepFlow-Duck](https://github.com/whwh1233/StepFlow-Duck) 同源，共同历史截至 `387e177e005e9863f3de193ad8b954e9efb5fd1d`。当前维护者最初接触到的是社群内分享的 zip 软件包，当时压缩包内没有 `LICENSE` 文件，也没有任何 GitHub 远程仓库地址或开源协议声明。

后续核对发现，原作者也将同源早期代码发布到了 GitHub，并在 `72218aab151a2ff74bf1763684a6370657c7bc57` 提交补充 MIT License。当前仓库已改为 MIT License，并补充原作者署名与来源说明。完整时间线见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

感谢原作者 whwh1233、Jimmy 以及后续所有贡献者的早期工作和持续改进。当前仓库中的相关服务入口、贡献入口、交流群入口和其他维护者整理的入口，不代表原项目作者背书。
