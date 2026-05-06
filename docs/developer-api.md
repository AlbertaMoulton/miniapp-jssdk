# TeamGaga MiniApp SDK 开发文档

本文档面向 TeamGaga 小程序开发者，说明 `@teamgaga/miniapp-jssdk` 的使用方式、每个 API 的适用场景、参数和返回值类型。

## 基础说明

TeamGaga MiniApp SDK 分为两层：

- `core.js`：由 TeamGaga App 的 Flutter InAppWebView 在运行时注入，负责创建 `window.tgg`，并通过 `window.flutter_inappwebview.callHandler("nativeBridge", payload)` 和 Native 通信。
- `@teamgaga/miniapp-jssdk`：发布到 npm，负责提供 TypeScript 类型、`tgg` 代理对象和便捷函数。

小程序开发者通常只需要安装 npm 包：

```sh
npm install @teamgaga/miniapp-jssdk
```

推荐用法：

```ts
import { tgg } from "@teamgaga/miniapp-jssdk";

tgg.ready();
await tgg.setHeaderColor("bg_color");
await tgg.close();
```

`tgg` 本身不会创建运行时。真实的 `window.tgg` 必须由 TeamGaga App 注入；如果在普通浏览器里直接调用，SDK 会抛出错误。

## 快速类型声明

如果你直接使用 `window.tgg`，可以在项目里添加全局类型声明：

```ts
import type { TggWebApp } from "@teamgaga/miniapp-jssdk";

declare global {
  interface Window {
    tgg: TggWebApp;
  }
}
```

如果使用 `import { tgg }`，通常不需要手写 `window` 声明。

## 通用返回和错误

大多数会调用 Native 能力的 API 返回 `Promise<T>`：

- 成功时：`Promise` resolve 为对应结果。
- 失败时：`Promise` reject 为 `MiniAppSDKError`。

`MiniAppSDKError` 字段：

| 字段      | 类型                  | 说明                              |
| --------- | --------------------- | --------------------------------- |
| `name`    | `string`              | 固定为 `"MiniAppSDKError"`。      |
| `message` | `string`              | 错误描述。                        |
| `code`    | `string \| undefined` | Native 返回的错误码；可能不存在。 |

示例：

```ts
try {
  const user = await tgg.getUserInfo();
  console.log(user.nickname);
} catch (error) {
  console.error(error);
}
```

## SDK 入口

### `tgg`

```ts
import { tgg } from "@teamgaga/miniapp-jssdk";
```

使用场景：

- 推荐的小程序开发入口。
- 获得完整类型提示。
- 在运行时自动代理到 App 注入的 `window.tgg`。

参数：无。

返回值：`TggWebApp` 代理对象。访问属性或调用方法时才会读取 `window.tgg`。

注意：

- 如果 `window.tgg` 未注入，访问 `tgg` 方法会抛出错误：`[Teamgaga] window.tgg is not injected. Please run inside Teamgaga App.`
- `tgg` 不会创建 mock，也不会创建假的运行时。

### `getTgg()`

```ts
import { getTgg } from "@teamgaga/miniapp-jssdk";

const runtime = getTgg();
```

使用场景：

- 希望显式获取运行时对象。
- 希望在应用启动时检查 TeamGaga 环境是否可用。

参数：无。

返回值：`TggWebApp`。

异常：

- 当 `window.tgg` 不存在时，直接抛出 `Error`。

### 便捷函数

SDK 也导出了一组便捷函数：

```ts
import {
  getCommunityId,
  getCommunityInfo,
  getOauthCode,
  getSystemInfo,
  getUserId,
  getUserInfo,
  setHeaderColor,
} from "@teamgaga/miniapp-jssdk";
```

这些函数都等价于调用 `getTgg().对应方法()`。适合只需要单个 API 的场景。

## 生命周期 API

### `tgg.ready()`

```ts
tgg.ready(): Promise<void>
```

使用场景：

- 小程序页面初始化完成后通知 TeamGaga App。
- App 可在收到该调用后关闭 loading、统计启动完成、恢复交互状态。

参数：无。

返回值：

| 类型            | 说明                                |
| --------------- | ----------------------------------- |
| `Promise<void>` | Native 确认后 resolve；无返回数据。 |

示例：

```ts
await tgg.ready();
```

## 小程序控制 API

### `tgg.close()`

```ts
tgg.close(): Promise<void>
```

使用场景：

- 小程序业务流程结束后，请求 TeamGaga App 关闭当前 Mini App。
- 例如支付完成、提交成功、用户主动点击关闭按钮等。

参数：无。

返回值：

| 类型            | 说明                                        |
| --------------- | ------------------------------------------- |
| `Promise<void>` | Native 确认关闭请求后 resolve；无返回数据。 |

示例：

```ts
await tgg.close();
```

## 导航栏 API

TeamGaga 参考 Telegram Mini App 的顶部导航栏策略，不提供动态 `setTitle` 能力：

- `mode === "fullscreen"` 时，小程序页面可以在页面内容区域自定义标题。
- 非 fullscreen 模式，例如 compact / fullsize，原生顶部栏标题固定使用宿主侧配置的标题，不随页面路由变化。
- 小程序可以设置顶部栏背景色，但不能通过 JS 动态修改原生顶部栏标题文本。

### `tgg.setHeaderColor(color)`

```ts
tgg.setHeaderColor(color: TggHeaderColor): Promise<void>
```

使用场景：

- 修改 App 原生导航栏颜色。
- 让导航栏跟随小程序页面主题或品牌色。

参数：

| 参数    | 类型             | 必填 | 说明                                                                                                |
| ------- | ---------------- | ---- | --------------------------------------------------------------------------------------------------- |
| `color` | `TggHeaderColor` | 是   | 导航栏颜色。`"bg_color"` 和 `"secondary_bg_color"` 表示使用当前主题色；`#RRGGBB` 形式表示指定颜色。 |

返回值：

| 类型            | 说明                             |
| --------------- | -------------------------------- |
| `Promise<void>` | 设置成功后 resolve；无返回数据。 |

示例：

```ts
await tgg.setHeaderColor("bg_color");
await tgg.setHeaderColor("#18A0FB");
```

便捷函数：

```ts
await setHeaderColor("secondary_bg_color");
```

类型：

```ts
type TggHeaderColor = "bg_color" | "secondary_bg_color" | `#${string}`;
```

## 返回按钮 API

返回按钮 API 位于 `tgg.BackButton`。

### `tgg.BackButton.isVisible`

```ts
tgg.BackButton.isVisible: boolean
```

使用场景：

- 判断当前小程序是否已经请求展示原生返回按钮。
- 根据显示状态避免重复调用或同步页面 UI。

参数：无。

返回值：

| 类型      | 说明                                                                 |
| --------- | -------------------------------------------------------------------- |
| `boolean` | `true` 表示 SDK 认为返回按钮处于显示状态；`false` 表示处于隐藏状态。 |

注意：

- 该值由 SDK 在 `show()` / `hide()` 成功后维护。
- 如果 Native 侧主动改变按钮状态，小程序需要等待后续事件能力补充后再同步。

### `tgg.BackButton.show()`

```ts
tgg.BackButton.show(): Promise<void>
```

使用场景：

- 当前小程序页面有自定义返回逻辑时，展示 App 原生返回按钮。
- 例如从列表进入详情页、打开二级页面、进入多步骤流程。

参数：无。

返回值：

| 类型            | 说明                                        |
| --------------- | ------------------------------------------- |
| `Promise<void>` | Native 展示按钮成功后 resolve；无返回数据。 |

示例：

```ts
await tgg.BackButton.show();
```

### `tgg.BackButton.hide()`

```ts
tgg.BackButton.hide(): Promise<void>
```

使用场景：

- 当前页面不需要原生返回按钮时隐藏。
- 例如小程序首页、流程结束页、不可返回页面。

参数：无。

返回值：

| 类型            | 说明                                        |
| --------------- | ------------------------------------------- |
| `Promise<void>` | Native 隐藏按钮成功后 resolve；无返回数据。 |

示例：

```ts
await tgg.BackButton.hide();
```

### `tgg.BackButton.onClick(cb)`

```ts
tgg.BackButton.onClick(cb: () => void): void
```

使用场景：

- 监听用户点击 App 原生返回按钮。
- 执行小程序内部路由返回、关闭弹窗、取消编辑状态等自定义行为。

参数：

| 参数 | 类型         | 必填 | 说明                           |
| ---- | ------------ | ---- | ------------------------------ |
| `cb` | `() => void` | 是   | 返回按钮点击时执行的回调函数。 |

返回值：

| 类型   | 说明         |
| ------ | ------------ |
| `void` | 无返回数据。 |

示例：

```ts
const handleBack = () => {
  router.back();
};

tgg.BackButton.onClick(handleBack);
```

事件分发规则：

- 一次点击事件会通知触发前已经注册的监听器。
- 如果某个监听器抛出异常，SDK 会记录错误并继续执行后续监听器。
- 分发期间新增的监听器不会在本次点击事件中执行。

### `tgg.BackButton.offClick(cb)`

```ts
tgg.BackButton.offClick(cb: () => void): void
```

使用场景：

- 页面卸载时移除监听，避免重复注册和内存泄漏。
- 某个业务状态结束后取消返回按钮处理。

参数：

| 参数 | 类型         | 必填 | 说明                                                              |
| ---- | ------------ | ---- | ----------------------------------------------------------------- |
| `cb` | `() => void` | 是   | 需要移除的原始回调函数引用，必须和 `onClick` 传入的是同一个函数。 |

返回值：

| 类型   | 说明         |
| ------ | ------------ |
| `void` | 无返回数据。 |

示例：

```ts
const handleBack = () => {
  router.back();
};

tgg.BackButton.onClick(handleBack);

onUnmounted(() => {
  tgg.BackButton.offClick(handleBack);
});
```

## 用户和授权 API

### `tgg.getOauthCode()`

```ts
tgg.getOauthCode(): Promise<string>
```

使用场景：

- 获取当前小程序登录或授权所需的 OAuth code。
- 小程序前端通常会把该 code 发送给业务后端，再由后端换取登录态或用户信息。

参数：无。

返回值：

| 类型              | 说明                |
| ----------------- | ------------------- |
| `Promise<string>` | OAuth code 字符串。 |

示例：

```ts
const code = await tgg.getOauthCode();
await api.loginWithTeamGagaCode(code);
```

便捷函数：

```ts
const code = await getOauthCode();
```

### `tgg.getUserId()`

```ts
tgg.getUserId(): Promise<string>
```

使用场景：

- 获取当前 TeamGaga 用户 ID。
- 用于前端埋点、业务查询、接口参数等轻量场景。

参数：无。

返回值：

| 类型              | 说明          |
| ----------------- | ------------- |
| `Promise<string>` | 当前用户 ID。 |

示例：

```ts
const userId = await tgg.getUserId();
```

便捷函数：

```ts
const userId = await getUserId();
```

### `tgg.getUserInfo()`

```ts
tgg.getUserInfo(): Promise<UserInfo>
```

使用场景：

- 获取当前用户的基础资料。
- 用于展示头像、昵称、用户名等轻量个人信息。

参数：无。

返回值：`Promise<UserInfo>`。

`UserInfo` 字段：

| 字段       | 类型     | 说明           |
| ---------- | -------- | -------------- |
| `userId`   | `string` | 用户 ID。      |
| `avatar`   | `string` | 用户头像 URL。 |
| `username` | `string` | 用户名。       |
| `nickname` | `string` | 用户昵称。     |

示例：

```ts
const user = await tgg.getUserInfo();
console.log(user.nickname, user.avatar);
```

便捷函数：

```ts
const user = await getUserInfo();
```

## 系统信息 API

### `tgg.getSystemInfo()`

```ts
tgg.getSystemInfo(): Promise<SystemInfo>
```

使用场景：

- 获取设备和 WebView 环境信息。
- 用于适配安全区、屏幕尺寸、语言、暗色模式等。

参数：无。

返回值：`Promise<SystemInfo>`。

`SystemInfo` 字段：

| 字段                 | 类型                | 说明                           |
| -------------------- | ------------------- | ------------------------------ |
| `devicePixelRatio`   | `number`            | 设备像素比。                   |
| `textScaleFactor`    | `number`            | 系统字体缩放比例。             |
| `locale`             | `SystemLocale`      | 系统语言和地区信息。           |
| `physicalSize`       | `PhysicalSize`      | 设备物理尺寸信息。             |
| `platformBrightness` | `"light" \| "dark"` | 系统外观模式。                 |
| `viewPadding`        | `ViewPadding`       | WebView 安全区或系统保留边距。 |

`SystemLocale` 字段：

| 字段           | 类型                       | 说明                            |
| -------------- | -------------------------- | ------------------------------- |
| `countryCode`  | `string \| number \| null` | 国家或地区代码；可能为空。      |
| `languageCode` | `string`                   | 语言代码，例如 `"zh"`、`"en"`。 |

`PhysicalSize` 字段：

| 字段     | 类型     | 说明       |
| -------- | -------- | ---------- |
| `width`  | `number` | 物理宽度。 |
| `height` | `number` | 物理高度。 |

`ViewPadding` 字段：

| 字段     | 类型     | 说明                   |
| -------- | -------- | ---------------------- |
| `left`   | `number` | 左侧安全区或保留边距。 |
| `right`  | `number` | 右侧安全区或保留边距。 |
| `top`    | `number` | 顶部安全区或保留边距。 |
| `bottom` | `number` | 底部安全区或保留边距。 |

示例：

```ts
const systemInfo = await tgg.getSystemInfo();

if (systemInfo.platformBrightness === "dark") {
  document.documentElement.dataset.theme = "dark";
}
```

便捷函数：

```ts
const systemInfo = await getSystemInfo();
```

## 社群 API

### `tgg.getCommunityId()`

```ts
tgg.getCommunityId(): Promise<string>
```

使用场景：

- 获取当前小程序所在的 TeamGaga 社群 ID。
- 用于按社群加载配置、内容、权限或业务数据。

参数：无。

返回值：

| 类型              | 说明          |
| ----------------- | ------------- |
| `Promise<string>` | 当前社群 ID。 |

示例：

```ts
const communityId = await tgg.getCommunityId();
```

便捷函数：

```ts
const communityId = await getCommunityId();
```

### `tgg.getCommunityInfo()`

```ts
tgg.getCommunityInfo(): Promise<CommunityInfo>
```

使用场景：

- 获取当前社群的基础信息。
- 用于展示社群名称、图标，或作为业务上下文。

参数：无。

返回值：`Promise<CommunityInfo>`。

`CommunityInfo` 字段：

| 字段          | 类型                  | 说明                       |
| ------------- | --------------------- | -------------------------- |
| `communityId` | `string`              | 社群 ID。                  |
| `name`        | `string \| undefined` | 社群名称；可能不存在。     |
| `icon`        | `string \| undefined` | 社群图标 URL；可能不存在。 |

示例：

```ts
const community = await tgg.getCommunityInfo();
console.log(community.name);
```

便捷函数：

```ts
const community = await getCommunityInfo();
```

## 能力检测和版本信息

### `tgg.canIUse(capability)`

```ts
tgg.canIUse(capability: string): boolean
```

使用场景：

- 判断当前 TeamGaga App 注入的 runtime 是否支持某个能力。
- 做低版本兼容处理。

参数：

| 参数         | 类型     | 必填 | 说明                                                                          |
| ------------ | -------- | ---- | ----------------------------------------------------------------------------- |
| `capability` | `string` | 是   | 能力名，例如 `"setHeaderColor"`、`"BackButton.show"`、`"backButtonClicked"`。 |

返回值：

| 类型      | 说明                                  |
| --------- | ------------------------------------- |
| `boolean` | `true` 表示支持；`false` 表示不支持。 |

当前可检测能力：

| 能力名                | 说明                       |
| --------------------- | -------------------------- |
| `"ready"`             | 页面 ready 通知。          |
| `"close"`             | 关闭当前 Mini App。        |
| `"setHeaderColor"`    | 设置原生导航栏颜色。       |
| `"BackButton.show"`   | 展示原生返回按钮。         |
| `"BackButton.hide"`   | 隐藏原生返回按钮。         |
| `"getOauthCode"`      | 获取 OAuth code。          |
| `"getUserId"`         | 获取用户 ID。              |
| `"getUserInfo"`       | 获取用户基础信息。         |
| `"getSystemInfo"`     | 获取系统信息。             |
| `"getCommunityId"`    | 获取社群 ID。              |
| `"getCommunityInfo"`  | 获取社群基础信息。         |
| `"themeChanged"`      | 主题变化事件能力。         |
| `"backButtonClicked"` | 原生返回按钮点击事件能力。 |

示例：

```ts
if (tgg.canIUse("setHeaderColor")) {
  await tgg.setHeaderColor("bg_color");
}
```

### `tgg.version`

```ts
tgg.version: string
```

使用场景：

- 查看当前注入的 core runtime 版本。
- 排查兼容性问题。

返回值：

| 类型     | 说明                  |
| -------- | --------------------- |
| `string` | core runtime 版本号。 |

### `tgg.sdkVersion`

```ts
tgg.sdkVersion: string
```

使用场景：

- 查看当前 runtime 对应的 SDK 版本。
- 排查 npm 包和 App 内置 runtime 的版本差异。

返回值：

| 类型     | 说明         |
| -------- | ------------ |
| `string` | SDK 版本号。 |

### `tgg.platform`

```ts
tgg.platform: string
```

使用场景：

- 判断当前运行平台。
- 做平台差异化适配。

返回值：

| 类型     | 说明                                           |
| -------- | ---------------------------------------------- |
| `string` | 平台标识，例如 `"ios"`、`"android"`、`"web"`。 |

### `tgg.appVersion`

```ts
tgg.appVersion: string
```

使用场景：

- 获取 TeamGaga App 版本。
- 做 App 版本兼容判断。

返回值：

| 类型     | 说明                                  |
| -------- | ------------------------------------- |
| `string` | TeamGaga App 版本号，例如 `"3.2.0"`。 |

## Host 集成入口

以下 API 主要给 TeamGaga App / Flutter Host 使用。普通小程序业务代码不建议直接调用。

### `window.__tgg_emit(eventName, payload?)`

```ts
window.__tgg_emit(eventName: TggEventName | string, payload?: unknown): void
```

使用场景：

- Flutter Host 主动向小程序 runtime 派发事件。
- 当前用于通知原生返回按钮点击、主题变化等事件。
- 这是 Host 专用入口；小程序业务代码应使用 SDK 提供的事件 API，例如 `tgg.BackButton.onClick(cb)`。

参数：

| 参数        | 类型                     | 必填 | 说明                                       |
| ----------- | ------------------------ | ---- | ------------------------------------------ |
| `eventName` | `TggEventName \| string` | 是   | 事件名，例如 `"backButtonClicked"`。       |
| `payload`   | `unknown`                | 否   | 事件数据。返回按钮事件通常不需要 payload。 |

返回值：

| 类型   | 说明         |
| ------ | ------------ |
| `void` | 无返回数据。 |

Flutter 示例：

```dart
controller.evaluateJavascript(
  source: 'window.__tgg_emit("backButtonClicked")',
);
```

类型：

```ts
type TggEventName = "backButtonClicked" | "themeChanged";
type TggEventPayload = unknown;
```

### Flutter H5 调用 Native

`core.js` 内部会通过 Flutter InAppWebView 调用 Native：

```js
window.flutter_inappwebview.callHandler("nativeBridge", {
  id: "tgg_req_1",
  method: "getUserInfo",
  params: {},
  sdkVersion: "0.1.5",
  timestamp: Date.now(),
});
```

Flutter Host 应使用 `addJavaScriptHandler` 注册同名 handler：

```dart
controller.addJavaScriptHandler(
  handlerName: 'nativeBridge',
  callback: (args) async {
    final payload = args.first as Map<String, dynamic>;
    final method = payload['method'] as String;
    final params = payload['params'] as Map<String, dynamic>?;

    try {
      final data = await dispatchMiniAppMethod(method, params);
      return {'success': true, 'data': data};
    } catch (error) {
      return {
        'success': false,
        'error': {'message': error.toString()},
      };
    }
  },
);
```

Native 返回成功：

```js
{ success: true, data: { userId: "user-123" } }
```

Native 返回失败：

```js
{ success: false, error: { code: "USER_UNAVAILABLE", message: "User is unavailable" } }
```

`MiniAppNativeError` 字段：

| 字段      | 类型                  | 说明                          |
| --------- | --------------------- | ----------------------------- |
| `code`    | `string \| undefined` | Native 错误码；可能不存在。   |
| `message` | `string \| undefined` | Native 错误描述；可能不存在。 |

## 内部构建和测试 API

以下 API 已导出，但主要用于 TeamGaga SDK 自身、Flutter 集成测试或本地调试，不建议小程序业务直接使用。

### `createMiniAppSDK(options?)`

```ts
createMiniAppSDK(options?: MiniAppSDKOptions): MiniAppSDK
```

使用场景：

- SDK 内部创建 bridge-powered API 对象。
- 测试时指定自定义 native handler、权限白名单或能力覆盖。

参数：

| 参数      | 类型                | 必填 | 说明           |
| --------- | ------------------- | ---- | -------------- |
| `options` | `MiniAppSDKOptions` | 否   | SDK 创建选项。 |

`MiniAppSDKOptions` 字段：

| 字段           | 类型                                        | 说明                                                   |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| `handlerName`  | `string \| undefined`                       | Flutter JavaScript handler 名。默认 `"nativeBridge"`。 |
| `permissions`  | `readonly MiniAppPermission[] \| undefined` | 当前小程序允许使用的权限白名单。                       |
| `sdkVersion`   | `string \| undefined`                       | SDK 版本。默认使用包内版本。                           |
| `capabilities` | `readonly CapabilityConfig[] \| undefined`  | 能力覆盖配置，可用于禁用或扩展能力。                   |

返回值：`MiniAppSDK`。

### `createTggRuntime(options?)`

```ts
createTggRuntime(options?: TggRuntimeOptions): TggWebApp
```

使用场景：

- `core.js` 构建 runtime 时使用。
- Flutter 集成测试或本地调试时手动创建 `window.tgg`。

参数：

| 参数      | 类型                | 必填 | 说明               |
| --------- | ------------------- | ---- | ------------------ |
| `options` | `TggRuntimeOptions` | 否   | runtime 创建选项。 |

`TggRuntimeOptions` 字段：

| 字段           | 类型                                        | 说明                                                   |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| `appVersion`   | `string \| undefined`                       | TeamGaga App 版本。默认空字符串。                      |
| `handlerName`  | `string \| undefined`                       | Flutter JavaScript handler 名。默认 `"nativeBridge"`。 |
| `permissions`  | `readonly MiniAppPermission[] \| undefined` | 当前小程序允许使用的权限白名单。                       |
| `platform`     | `string \| undefined`                       | 平台标识。默认 `"web"`。                               |
| `sdkVersion`   | `string \| undefined`                       | SDK 版本。默认使用包内版本。                           |
| `version`      | `string \| undefined`                       | core runtime 版本。默认使用包内版本。                  |
| `capabilities` | `readonly CapabilityConfig[] \| undefined`  | 能力覆盖配置，可用于禁用或扩展能力。                   |

返回值：`TggWebApp`，并会挂载到 `window.tgg`。

### `installTggRuntime(options?)`

```ts
installTggRuntime(options?: TggRuntimeOptions): TggWebApp
```

使用场景：

- `dist/core.js` 加载时自动调用。
- 幂等安装 runtime：如果 `window.tgg` 已存在，会直接返回现有对象。

参数：同 `createTggRuntime(options?)`。

返回值：`TggWebApp`。

### `getSupportedCapabilities()`

```ts
getSupportedCapabilities(): readonly MiniAppMethod[]
```

使用场景：

- SDK 内部测试或生成能力列表。

参数：无。

返回值：

| 类型                       | 说明                                    |
| -------------------------- | --------------------------------------- |
| `readonly MiniAppMethod[]` | 当前 runtime 支持的 Native 方法名列表。 |

## 类型总览

### `TggWebApp`

```ts
type TggWebApp = MiniAppSDK & {
  readonly version: string;
  readonly sdkVersion: string;
  readonly platform: string;
  readonly appVersion: string;
};
```

### `MiniAppMethod`

```ts
type MiniAppMethod =
  | "ready"
  | "close"
  | "setHeaderColor"
  | "BackButton.show"
  | "BackButton.hide"
  | "getOauthCode"
  | "getUserId"
  | "getUserInfo"
  | "getSystemInfo"
  | "getCommunityId"
  | "getCommunityInfo";
```

### `TggCapability`

```ts
type TggCapability = MiniAppMethod | "themeChanged" | "backButtonClicked";
```

### `TggBackButton`

```ts
type TggBackButton = {
  readonly isVisible: boolean;
  show(): Promise<void>;
  hide(): Promise<void>;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
};
```
