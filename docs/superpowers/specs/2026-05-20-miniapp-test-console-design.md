# MiniApp JS SDK 真机测试控制台设计

## 背景

`miniapp-jssdk` 当前已经具备完整的 TeamGaga MiniApp 运行时能力，包括：

- 生命周期 API：`init`、`ready`、`close`
- UI API：`setHeaderColor`、`BackButton.show/hide`
- 用户与业务 API：`getOauthCode`、`getUserId`、`getUserInfo`、`getCommunityId`、`getCommunityInfo`
- 系统与设备能力：`getSystemInfo`、`downloadFile`、`saveMediaToAlbum`
- 运行时事件：`theme_changed`、`viewport_changed`、`safe_area_changed`、`content_safe_area_changed`、`fullscreen_changed`、`back_button_clicked`、`download_file_*`、`clipboard_text_received`
- CSS 变量同步：`--tgg-*`

当前仓库缺少一个面向 TeamGaga App 真机环境的统一测试页面，导致每次联调都需要临时拼接 demo、手写调用脚本或依赖业务页面顺带验证。这样的问题是：

- API 覆盖不系统，容易漏掉能力或异常路径
- 真机排查信息分散，宿主、H5、bridge 的状态不在同一视图
- CSS 变量、安全区、viewport 等运行时状态缺少可视化验证
- 后续新增 API 时没有固定的回归验证入口

本设计的目标是提供一个可长期复用的“真机联调控制台”，优先服务 SDK 开发与宿主联调效率，而不是面向业务同学的产品级 demo。

## 目标

第一版测试控制台只覆盖用户确认的 `P0 + P1 + P2` 范围：

- `P0`
  - 宿主注入状态检查
  - `init` / `ready` / `close`
  - 关键环境信息展示
  - 能力矩阵与版本判断
  - 运行时日志与事件流
- `P1`
  - `setHeaderColor`
  - `BackButton.show/hide/onClick/offClick`
  - `getOauthCode`
  - `getUserId`
  - `getUserInfo`
  - `getSystemInfo`
  - `getCommunityId`
  - `getCommunityInfo`
  - CSS 变量动态验证
- `P2`
  - `downloadFile`
  - `saveMediaToAlbum`
  - `clipboard_text_received`
  - 安全区与 viewport 可视化实验区

控制台必须满足以下使用目标：

- 在 TeamGaga App 真机中打开后可以快速看出宿主是否注入成功
- 所有第一版 API 都能在一个页面内完成调用、观察结果和复现错误
- 关键运行时状态变化可以在 UI 中即时可见
- 控制台本身可以作为后续新增 API 的扩展基础

## 非目标

第一版不做以下内容：

- 不接入完整业务数据流或业务页面 UI
- 不做复杂路由、多页面结构或单独的演示站点
- 不做自动化测试 runner 或录制回放系统
- 不覆盖未来尚未进入 SDK 的 API
- 不做宿主侧 mock 注入器
- 不在本次设计中处理“普通浏览器完全模拟 TeamGaga 宿主”的需求

普通浏览器打开测试页时，只提供清晰的降级提示和静态展示，不承诺完整模拟运行时行为。

## 方案选择

考虑过三种结构：

### 方案 A：单页长控制台

所有测试模块都在一个页面中，使用折叠面板和分区标题组织内容。

优点：

- 真机联调最快，不需要切页面或切 Tab
- 适合截图和录屏反馈
- 最容易按调用顺序从上到下排查
- 实现复杂度最低

缺点：

- 页面会偏长
- 需要依赖折叠和吸顶导航减少滚动成本

### 方案 B：Tab 控制台

将 Overview、APIs、Events、CSS、Safe Area 分成多个 Tab。

优点：

- 视觉结构更整齐
- 单屏信息密度更低

缺点：

- 真机排查时需要频繁切换
- 同一问题常常跨越多个 Tab，不利于快速核对

### 方案 C：总览页 + 弹层详情

首页只展示概要信息，每个 API 或事件通过弹层查看详情。

优点：

- 首页视觉紧凑

缺点：

- 交互层级深
- 第一版实现成本不必要地偏高

### 结论

采用 `方案 A：单页长控制台`。

原因：

- 用户目标明确偏向“联调控制台”，不是展示型页面
- 第一版优先追求信息直达和操作效率
- 结构最利于后续在同一页面继续扩展 API 分组

## 页面信息架构

页面采用单页结构，自上而下分为七个区块。

### 1. 环境总览区

负责回答“当前页面是否真的运行在 TeamGaga 宿主里，以及基础上下文是否正确”。

展示内容：

- SDK 注入状态
- `window.tgg` 是否存在
- 可用 bridge transport 类型
- `init()` 最近一次执行状态
- 当前 `appVersion`、`sdkVersion`、`platform`、`colorScheme`
- `viewportHeight`、`viewportStableHeight`
- `safeAreaInset`、`contentSafeAreaInset`
- `headerColor`、`backgroundColor`
- `launchContext`
- `canIUse` 能力总览
- `isVersionAtLeast` 输入试算

行为：

- 页面加载后自动尝试执行 `tgg.init()`
- 将 `init()` 原始返回值与 `window.tgg` 当前 getter 值并排展示
- 自动做一致性 diff，标记是否存在字段不一致
- 如果未注入，则显示明确错误提示，不阻止页面其余静态区域渲染

### 2. 生命周期与 UI API 区

集中放置最常用的基础控制能力。

覆盖 API：

- `init`
- `ready`
- `close`
- `setHeaderColor`
- `BackButton.show`
- `BackButton.hide`
- `BackButton.onClick`
- `BackButton.offClick`

每个 API 卡片统一展示：

- API 名称
- 说明
- 参数输入
- 快捷预设按钮
- 调用按钮
- 最近一次调用耗时
- 最近一次调用时间
- 成功 / 失败状态
- 原始结果或错误对象

`setHeaderColor` 额外提供预设值：

- `bg_color`
- `secondary_bg_color`
- `#18A0FB`

`BackButton` 额外展示状态：

- 当前 `isVisible`
- 当前点击监听是否已注册
- 点击次数统计

### 3. 业务与系统 API 区

覆盖读取型 API，便于快速核对宿主返回的数据形态。

覆盖 API：

- `getOauthCode`
- `getUserId`
- `getUserInfo`
- `getSystemInfo`
- `getCommunityId`
- `getCommunityInfo`

每项结果默认使用 JSON 格式化展示，并提供“复制结果”操作。

### 4. 设备能力 API 区

覆盖第一版设备侧能力和异步回调链路。

包含三类能力：

- `downloadFile`
- `saveMediaToAlbum`
- `clipboard_text_received`

`downloadFile` 需要完整展示生命周期：

- 输入参数：`url`
- 调用开始时间
- 当前任务状态：idle / running / success / fail / aborted
- 实时进度条
- `success` 回调结果
- `fail` 回调结果
- `complete` 回调结果
- `abort` 按钮

页面会内置一组默认可测参数，但允许手动修改。

`saveMediaToAlbum` 需要内置可直接点击测试的远程素材 URL，避免真机测试时还要额外准备资源。

`clipboard_text_received` 使用事件监听模式展示最近一次接收到的文本内容和接收时间。

### 5. 事件与日志区

这是控制台的核心排查区域，负责把“API 调用发生了什么”与“宿主事件进来了没有”放进统一时间线。

事件监听覆盖：

- `theme_changed`
- `viewport_changed`
- `safe_area_changed`
- `content_safe_area_changed`
- `fullscreen_changed`
- `back_button_clicked`
- `download_file_progress`
- `download_file_success`
- `download_file_fail`
- `clipboard_text_received`

额外监听：

- 全局 `tgg:event` 自定义事件

日志按来源分层展示：

- API 调用日志
- 事件日志
- 错误日志
- 系统提示日志

交互能力：

- 清空日志
- 复制日志
- 按来源筛选
- 按级别筛选

### 6. CSS 变量验证区

测试页不仅要打印变量值，还要让变量效果肉眼可见。

展示范围：

- `--tgg-color-scheme`
- `--tgg-theme-*`
- `--tgg-viewport-height`
- `--tgg-viewport-stable-height`
- `--tgg-header-color`
- `--tgg-background-color`
- `--tgg-is-fullscreen`
- `--tgg-safe-area-inset-*`
- `--tgg-content-safe-area-inset-*`

展示方式：

- 变量名
- computed value
- 可视化示例

示例包括：

- 主题颜色色块
- 高度尺和标注
- 使用安全区变量的 padding 演示
- 使用背景色变量的容器示例

这个区块必须在收到 `theme_changed`、`viewport_changed`、`safe_area_changed`、`content_safe_area_changed`、`fullscreen_changed` 事件后自动刷新。

### 7. 安全区与视口实验区

这个区块用真实布局演示安全区与 viewport 变量的使用效果，而不是只显示数字。

结构：

- 顶部 sticky header
- 中间滚动内容列表
- 底部 fixed action bar

提供三种高度模式切换：

- `100vh`
- `var(--tgg-viewport-height)`
- `var(--tgg-viewport-stable-height)`

提供两种底部适配模式切换：

- `padding-bottom: env(safe-area-inset-bottom)`
- `padding-bottom: var(--tgg-content-safe-area-inset-bottom)`

用户可以在真机里直接比较不同方案的视觉与行为差异。

## 交互与状态设计

### 自动初始化

页面加载后执行以下流程：

1. 检查 `window.tgg` 是否存在
2. 判断可用 bridge transport
3. 注册运行时事件监听
4. 尝试执行 `tgg.init()`
5. 刷新总览、CSS 变量和实验区状态

### 调用结果模型

每个 API 调用都统一记录：

- `name`
- `params`
- `startedAt`
- `finishedAt`
- `durationMs`
- `status`
- `result`
- `error`

这样 UI 层不需要为每个 API 写不同的状态处理分支。

### 配置驱动 API 渲染

第一版 API 列表不应通过手写重复 DOM 拼装实现，而应通过配置生成。

每个 API 配置包含：

- `id`
- `group`
- `title`
- `description`
- `kind`
- `defaultParams`
- `presets`
- `invoke`
- `resultFormatter`

这样新增 SDK API 时只需要补一份元数据配置和必要的参数输入定义。

## 技术实现设计

为了让测试页在真机里稳定使用，第一版不引入复杂框架，采用独立 HTML 页面方案。

建议文件结构：

- `test.html`
- `test/test-page.css`
- `test/test-page.js`
- `test/api-config.js`

职责划分：

- `test.html`
  - 页面骨架
  - 各区块挂载点
  - 引入 SDK bundle 或当前仓库构建产物
- `test/test-page.css`
  - 控制台样式
  - 折叠面板
  - 日志区
  - CSS 变量演示区
  - 安全区实验区
- `test/api-config.js`
  - API 元数据
  - 默认参数
  - 分组定义
  - 结果格式化规则
- `test/test-page.js`
  - 初始化流程
  - 事件注册
  - API 调用执行器
  - UI 渲染逻辑
  - 日志管理
  - CSS 变量采集

如果后续需要兼容更复杂页面，也可以将其迁移到构建体系中，但第一版不以此为目标。

## 错误处理与降级策略

### 未注入环境

如果 `window.tgg` 不存在：

- 总览区显示“当前不在 TeamGaga 环境中”
- 所有依赖宿主的 API 卡片禁用
- CSS 变量区仍可显示当前已存在的静态变量值
- 安全区实验区仍可渲染，便于基础样式开发

### API 调用失败

统一显示：

- 错误 message
- 错误 code
- 原始错误对象

### 参数非法

对可以在前端侧快速识别的问题提前提示，例如：

- `setHeaderColor` 非法值
- `downloadFile` 空 URL
- `downloadFile` 非法文件名

### 事件载荷异常

如果宿主发送的事件 payload 结构不符合预期：

- 日志区记录 warning
- UI 尽量展示原始 payload
- 不因为某个事件异常导致整个控制台崩溃

## 默认测试数据

为了保证真机环境开箱即测，第一版内置以下默认测试数据：

- `setHeaderColor`
  - `bg_color`
  - `secondary_bg_color`
  - `#18A0FB`
- `downloadFile.url`
  - 稳定可访问的公开测试图片地址
- `saveMediaToAlbum.url`
  - 稳定可访问的公开测试媒体地址
- `isVersionAtLeast` 预设版本
  - `1.0.0`
  - `2.0.0`
  - `3.2.0`

如果测试页部署环境不方便携带静态测试文件，再退回使用稳定的公开测试文件地址。

## 验收标准

第一版完成后，应满足以下验收要求：

1. 在 TeamGaga App 真机中打开测试页后，能够自动显示注入状态与 `init()` 结果。
2. `P0 + P1 + P2` 范围内的 API 都有独立且可操作的测试入口。
3. 每个 API 的成功态、失败态和最近一次结果都能在 UI 中看到。
4. 事件区能显示运行时事件与 `tgg:event` 自定义事件。
5. CSS 变量区能展示关键 `--tgg-*` 变量的当前值和实际视觉效果。
6. 安全区实验区能切换不同 viewport / inset 策略并立即看到差异。
7. 普通浏览器打开时，页面能优雅降级且不出现整页脚本崩溃。
8. 新增一个 API 时，只需扩展配置与少量渲染逻辑即可接入。

## 测试策略

第一版实现后，至少验证以下场景：

- TeamGaga App 真机环境
  - `init` 成功
  - `ready` 成功
  - `BackButton` 可见性与点击事件
  - `setHeaderColor` 生效
  - 业务和系统 API 返回结构正确
  - `downloadFile` 进度、成功、失败、abort
  - `saveMediaToAlbum` 返回结果正确
  - `clipboard_text_received` 能收到宿主事件
  - 主题变化或宿主布局变化后，CSS 变量区同步更新
- 普通浏览器环境
  - 明确提示未注入
  - 不发生未捕获异常
  - 静态区块可以正常渲染

## 后续扩展方向

第一版上线后，可以按以下方向演进：

- 增加异常路径的专门测试模式
- 增加更多能力矩阵和宿主版本对照信息
- 增加导出日志、导出截图指引
- 增加宿主事件模拟器
- 增加 API 搜索和快速定位
- 在控制台中接入未来新增的 SDK API

## 结论

第一版采用“单页真机联调控制台”方案，以 `P0 + P1 + P2` 为边界，使用配置驱动渲染 API 卡片，并将环境信息、日志、事件、CSS 变量和安全区实验区统一到一个页面中。

这个方案能在实现成本可控的前提下，最大化提升 TeamGaga App 真机联调效率，并为后续 SDK 能力扩展提供稳定的回归验证入口。
