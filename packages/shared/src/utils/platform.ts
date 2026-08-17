// Browser detection is based on Quasar's latest Platform implementation:
//
// 浏览器检测基于 Quasar 最新的 Platform 实现
//
// https://github.com/quasarframework/quasar/blob/dev/ui/src/plugins/platform/Platform.js
//
// This module deliberately has no runtime dependencies. It also avoids direct
// access to DOM globals so that importing it during SSR is safe.
//
// 本模块有意保持零运行时依赖，同时避免直接访问 DOM 全局对象，以确保在 SSR 期间安全导入

type BrowserToken = 'chrome' | 'crios' | 'edge' | 'edg' | 'edga' | 'edgios' | 'firefox' | 'fxios' | 'opera' | 'opr' | 'safari' | 'vivaldi' | 'webkit'
type PlatformToken = 'android' | 'cros' | 'ipad' | 'iphone' | 'kindle' | 'linux' | 'mac' | 'silk' | 'win'

const MAX_USER_AGENT_LENGTH = 512

const EDGE_RE = /(edg|edge|edga|edgios)\/([\w.]+)/
const OPR_RE = /(opr)\/([\w.]+)/
const VIVALDI_RE = /(vivaldi)\/([\w.]+)/
const CHROME_RE = /(chrome|crios)\/([\w.]+)/
const FIREFOX_RE = /(firefox|fxios)\/([\w.]+)/
const WEBKIT_RE = /(webkit)\/([\w.]+)/
const WECHAT_RE = /micromessenger\/([\w.]+)/
const NATIVE_APP_RE = /(?:^|\s)nativeapp\/([\w.-]+)(?:\/([\w.-]+))?(?=\s|$)/

const SAFARI_VERSION_RE = /(?:^|\s)version\/([\w.]+)/
const APPLE_WEBKIT_RE = /(?:^|\s)applewebkit\/[\w.]+/
const SAFARI_AGENT_RE = /(?:^|\s)safari\/[\w.]+/
const OPERA_AGENT_RE = /(?:^|\s)opera\/([\w.]+)/
const OPERA_VERSION_RE = /(?:^|\s)version\/([\w.]+)/

interface BrowserMatch {
  browser: BrowserToken | ''
  version: string
}

interface RuntimeNavigator {
  maxTouchPoints?: number
  userAgent?: string
  userAgentData?: { mobile?: boolean }
  vendor?: string
}

interface RuntimeGlobal {
  __NATIVE_APP_CONTEXT_V1__?: unknown
  __wxjs_environment?: string
  document?: { location?: { href?: string } }
  innerHeight?: number
  innerWidth?: number
  navigator?: RuntimeNavigator
  ontouchstart?: unknown
  opera?: string
  self?: unknown
  top?: unknown
}

/**
 * Runtime hints used to refine user-agent detection.
 *
 * 用于提高用户代理检测准确性的运行时信息
 */
export interface PlatformEnvironment {
  /**
   * Current document URL, used to detect browser extensions.
   *
   * 当前文档 URL，用于检测浏览器扩展环境
   */
  href?: string
  /**
   * Explicit touch capability.
   *
   * 明确指定是否支持触摸操作
   */
  hasTouch?: boolean
  /**
   * Current viewport height, used for iPad desktop-UA correction.
   *
   * 当前视口高度，用于修正使用桌面端用户代理的 iPad
   */
  innerHeight?: number
  /**
   * Current viewport width, used for iPad desktop-UA correction.
   *
   * 当前视口宽度，用于修正使用桌面端用户代理的 iPad
   */
  innerWidth?: number
  /**
   * Whether the current window is inside an iframe.
   *
   * 当前窗口是否位于 iframe 中
   */
  iframe?: boolean
  /**
   * Value of navigator.maxTouchPoints.
   *
   * navigator.maxTouchPoints 的值
   */
  maxTouchPoints?: number
  /**
   * Value of navigator.userAgentData.mobile.
   *
   * navigator.userAgentData.mobile 的值
   */
  mobileUserAgentData?: boolean
  /**
   * Native app marker injected by the host WebView.
   *
   * 由宿主 WebView 注入的原生应用标识
   *
   * @example
   * ```ts
   * window.__NATIVE_APP_CONTEXT_V1__ = {
   *   nativeApp: {
   *     name: 'Example App',
   *     version: '2.3.0',
   *   },
   * }
   * ```
   *
   * 原生 WebView 也可以在用户代理末尾追加 `NativeApp/<name>/<version>`
   *
   * ```text
   * Mozilla/5.0 (...) NativeApp/ExampleApp/2.3.0
   * ```
   *
   */
  nativeApp?: NativeAppMetadata
  /**
   * Legacy window.opera user-agent fallback.
   *
   * 旧版 `window.opera` 用户代理回退值
   */
  opera?: string
  /**
   * Browser vendor user-agent fallback.
   *
   * 浏览器厂商提供的用户代理回退值
   */
  vendor?: string
  /**
   * WeChat's injected JavaScript environment marker.
   *
   * 微信注入的 JavaScript 环境标识
   */
  wechatJsEnvironment?: string
}

/**
 * Metadata supplied by a native application hosting the WebView.
 *
 * 承载 WebView 的原生应用提供的元数据
 *
 * The host can inject this metadata through `window.__NATIVE_APP_CONTEXT_V1__`
 *
 * 宿主可以通过 `window.__NATIVE_APP_CONTEXT_V1__` 注入这些元数据
 *
 * The same metadata can be identified from the `NativeApp/<name>/<version>` user-agent token
 *
 * 也可以通过 `NativeApp/<name>/<version>` 用户代理标识识别相同的元数据
 *
 * The platform field is optional and can usually be inferred from the user agent
 *
 * platform 字段是可选的，通常可以从用户代理中推断
 */
export interface NativeAppMetadata {
  /**
   * Native application name.
   *
   * 原生应用名称
   */
  name?: string
  /**
   * Native application version.
   *
   * 原生应用版本
   */
  version?: string
  /**
   * Native application platform.
   *
   * 原生应用平台
   */
  platform?: string
}

/**
 * Normalized browser and operating-system information.
 *
 * 标准化的浏览器和操作系统信息
 */
export interface PlatformInfo {
  /**
   * Whether the operating system is Android.
   *
   * 操作系统是否为 Android
   */
  android: boolean
  /**
   * Whether the page is running inside a browser extension.
   *
   * 页面是否运行在浏览器扩展中
   */
  bex: boolean
  /**
   * Whether the browser is Google Chrome or Chrome for iOS.
   *
   * 浏览器是否为 Google Chrome 或 iOS 版 Chrome
   */
  chrome: boolean
  /**
   * Whether the operating system is ChromeOS.
   *
   * 操作系统是否为 ChromeOS
   */
  cros: boolean
  /**
   * Whether the runtime is classified as a desktop environment.
   *
   * 运行环境是否被识别为桌面端
   */
  desktop: boolean
  /**
   * Whether the browser is Microsoft Edge.
   *
   * 浏览器是否为 Microsoft Edge
   */
  edge: boolean
  /**
   * Whether Microsoft Edge uses its Chromium-based implementation.
   *
   * Microsoft Edge 是否基于 Chromium
   */
  edgeChromium: boolean
  /**
   * Whether the page is running inside Electron.
   *
   * 页面是否运行在 Electron 中
   */
  electron: boolean
  /**
   * Whether the browser is Firefox or Firefox for iOS.
   *
   * 浏览器是否为 Firefox 或 iOS 版 Firefox
   */
  firefox: boolean
  /**
   * Whether the operating system is iOS or iPadOS.
   *
   * 操作系统是否为 iOS 或 iPadOS
   */
  ios: boolean
  /**
   * Whether the device is identified as an iPad.
   *
   * 设备是否被识别为 iPad
   */
  ipad: boolean
  /**
   * Whether the device is identified as an iPhone.
   *
   * 设备是否被识别为 iPhone
   */
  iphone: boolean
  /**
   * Whether the device is identified as an Amazon Kindle.
   *
   * 设备是否被识别为 Amazon Kindle
   */
  kindle: boolean
  /**
   * Whether the operating system is Linux.
   *
   * 操作系统是否为 Linux
   */
  linux: boolean
  /**
   * Whether the operating system is macOS.
   *
   * 操作系统是否为 macOS
   */
  mac: boolean
  /**
   * Whether the runtime is classified as a mobile environment.
   *
   * 运行环境是否被识别为移动端
   */
  mobile: boolean
  /**
   * Whether the page is running inside a native application WebView.
   *
   * 页面是否运行在原生应用 WebView 中
   */
  nativeApp: boolean
  /**
   * Detected native application name.
   *
   * 检测到的原生应用名称
   */
  nativeAppName?: string
  /**
   * Detected native application version.
   *
   * 检测到的原生应用版本
   */
  nativeAppVersion?: string
  /**
   * Detected native application platform.
   *
   * 检测到的原生应用平台
   */
  nativeAppPlatform?: string
  /**
   * Normalized browser name, such as "chrome", "safari", or "edge".
   *
   * 标准化的浏览器名称，例如 "chrome"、"safari" 或 "edge"
   */
  name: string
  /**
   * Whether the browser is Opera.
   *
   * 浏览器是否为 Opera
   */
  opera: boolean
  /**
   * Normalized operating-system or device token from the user agent.
   *
   * 从用户代理中提取的标准化操作系统或设备标识
   */
  platform: string
  /**
   * Whether the browser is Safari.
   *
   * 浏览器是否为 Safari
   */
  safari: boolean
  /**
   * Whether the browser is Amazon Silk.
   *
   * 浏览器是否为 Amazon Silk
   */
  silk: boolean
  /**
   * Full detected browser version.
   *
   * 检测到的完整浏览器版本
   */
  version: string
  /**
   * Major detected browser version as a number.
   *
   * 检测到的浏览器主版本号
   */
  versionNumber: number
  /**
   * Whether the browser is Vivaldi.
   *
   * 浏览器是否为 Vivaldi
   */
  vivaldi: boolean
  /**
   * Whether the browser belongs to the WebKit-compatible browser family.
   *
   * 浏览器是否属于 WebKit 兼容浏览器家族
   */
  webkit: boolean
  /**
   * Whether the operating system is Windows.
   *
   * 操作系统是否为 Windows
   */
  win: boolean
}

/**
 * A point-in-time snapshot of the current runtime platform.
 *
 * 当前运行平台在特定时刻的快照
 */
export interface PlatformSnapshot {
  has: {
    touch: boolean
  }
  is: PlatformInfo
  userAgent: string
  within: {
    iframe: boolean
    /**
     * Whether the page is running inside the WeChat browser or WebView.
     *
     * 页面是否运行在微信浏览器或微信 WebView 中
     */
    wechat: boolean
    wechatMiniProgram: boolean
    /**
     * Detected WeChat client version when available.
     *
     * 检测到的微信客户端版本（如果可用）
     */
    wechatVersion?: string
  }
}

function normalizeUserAgent(userAgent: unknown): string {
  return typeof userAgent === 'string' ? userAgent.slice(0, MAX_USER_AGENT_LENGTH).toLowerCase() : ''
}

function getUserAgentNativeApp(userAgent: string): NativeAppMetadata | undefined {
  const match = NATIVE_APP_RE.exec(userAgent)

  if (match) {
    return {
      name: match[1],
      version: match[2],
    }
  }
}

function getInjectedNativeApp(marker: unknown): NativeAppMetadata | undefined {
  if (marker === true) return {}
  if (typeof marker !== 'object' || marker === null) return

  const value = marker as Record<string, unknown>
  const nativeApp = 'nativeApp' in value ? value.nativeApp : marker

  if (nativeApp === true) return {}
  if (typeof nativeApp !== 'object' || nativeApp === null) return

  const metadata = nativeApp as Record<string, unknown>
  return {
    name: typeof metadata.name === 'string' ? metadata.name : void 0,
    version: typeof metadata.version === 'string' ? metadata.version : void 0,
    platform: typeof metadata.platform === 'string' ? metadata.platform : void 0,
  }
}

function getSafariMatch(userAgent: string): BrowserMatch | undefined {
  const versionMatch = SAFARI_VERSION_RE.exec(userAgent)

  if (versionMatch && APPLE_WEBKIT_RE.test(userAgent) && SAFARI_AGENT_RE.test(userAgent)) {
    return { browser: 'safari', version: versionMatch[1] ?? '0' }
  }
}

function getOperaMatch(userAgent: string): BrowserMatch | undefined {
  const operaMatch = OPERA_AGENT_RE.exec(userAgent)

  if (operaMatch) {
    const versionMatch = OPERA_VERSION_RE.exec(userAgent)
    return { browser: 'opera', version: versionMatch?.[1] ?? operaMatch[1] ?? '0' }
  }
}

function toBrowserMatch(match: RegExpExecArray | null): BrowserMatch | undefined {
  if (match?.[1]) {
    return {
      browser: match[1] as BrowserToken,
      version: match[2] ?? '0',
    }
  }
}

function getBrowserMatch(userAgent: string): BrowserMatch {
  const chromiumMatch = toBrowserMatch(EDGE_RE.exec(userAgent)) ?? toBrowserMatch(OPR_RE.exec(userAgent)) ?? toBrowserMatch(VIVALDI_RE.exec(userAgent)) ?? toBrowserMatch(CHROME_RE.exec(userAgent))

  if (chromiumMatch) return chromiumMatch

  return getSafariMatch(userAgent) ?? toBrowserMatch(FIREFOX_RE.exec(userAgent)) ?? toBrowserMatch(WEBKIT_RE.exec(userAgent)) ?? getOperaMatch(userAgent) ?? { browser: '', version: '0' }
}

function getPlatformMatch(userAgent: string): PlatformToken | '' {
  if (/ipad/.test(userAgent)) return 'ipad'
  if (/iphone/.test(userAgent)) return 'iphone'
  if (/kindle/.test(userAgent)) return 'kindle'
  if (/silk/.test(userAgent)) return 'silk'
  if (/android/.test(userAgent)) return 'android'
  if (/win/.test(userAgent)) return 'win'
  if (/mac/.test(userAgent)) return 'mac'
  if (/linux/.test(userAgent)) return 'linux'
  if (/cros/.test(userAgent)) return 'cros'
  return ''
}

function createEmptyPlatformInfo(): PlatformInfo {
  return {
    android: false,
    bex: false,
    chrome: false,
    cros: false,
    desktop: false,
    edge: false,
    edgeChromium: false,
    electron: false,
    firefox: false,
    ios: false,
    ipad: false,
    iphone: false,
    kindle: false,
    linux: false,
    mac: false,
    mobile: false,
    name: '',
    nativeApp: false,
    opera: false,
    platform: '',
    safari: false,
    silk: false,
    version: '0',
    versionNumber: 0,
    vivaldi: false,
    webkit: false,
    win: false,
  }
}

function applyBrowserMatch(info: PlatformInfo, match: BrowserMatch): void {
  info.name = match.browser
  info.version = match.version
  info.versionNumber = Number.parseInt(match.version, 10) || 0

  switch (match.browser) {
    case 'chrome': {
      info.chrome = true
      break
    }
    case 'crios': {
      info.chrome = true
      info.name = 'chrome'
      break
    }
    case 'edge': {
      info.edge = true
      break
    }
    case 'edg':
    case 'edga':
    case 'edgios': {
      info.edge = true
      info.edgeChromium = true
      info.name = 'edge'
      break
    }
    case 'firefox': {
      info.firefox = true
      break
    }
    case 'fxios': {
      info.firefox = true
      info.name = 'firefox'
      break
    }
    case 'opera':
    case 'opr': {
      info.opera = true
      info.name = 'opera'
      break
    }
    case 'safari': {
      info.safari = true
      break
    }
    case 'vivaldi': {
      info.vivaldi = true
      break
    }
    case 'webkit': {
      info.webkit = true
      break
    }
  }
}

function applyPlatformMatch(info: PlatformInfo, platform: PlatformToken | ''): void {
  info.platform = platform

  switch (platform) {
    case 'android': {
      info.android = true
      break
    }
    case 'cros': {
      info.cros = true
      break
    }
    case 'ipad': {
      info.ipad = true
      break
    }
    case 'iphone': {
      info.iphone = true
      break
    }
    case 'kindle': {
      info.kindle = true
      break
    }
    case 'linux': {
      info.linux = true
      break
    }
    case 'mac': {
      info.mac = true
      break
    }
    case 'silk': {
      info.silk = true
      break
    }
    case 'win': {
      info.win = true
      break
    }
  }
}

function applyClientCorrections(info: PlatformInfo, userAgent: string, environment: PlatformEnvironment): void {
  if (userAgent.includes('electron')) {
    info.electron = true
    return
  }

  if (environment.href?.includes('-extension://')) {
    info.bex = true
    return
  }

  const hasTouch = environment.hasTouch === true || (environment.maxTouchPoints ?? 0) > 0
  const isDesktopModeIos = hasTouch && info.mac && info.desktop && info.safari

  if (isDesktopModeIos) {
    const shortestViewportEdge = Math.min(environment.innerHeight ?? 0, environment.innerWidth ?? 0)
    const platform = shortestViewportEdge > 414 ? 'ipad' : 'iphone'

    info.mac = false
    info.desktop = false
    info.mobile = true
    info.ios = true
    info.platform = platform
    info.ipad = platform === 'ipad'
    info.iphone = platform === 'iphone'
  }

  if (!info.mobile && environment.mobileUserAgentData === true) {
    info.desktop = false
    info.mobile = true
  }
}

/**
 * Parse a user agent without reading browser globals.
 *
 * Pass runtime hints when client-only corrections such as iPad desktop mode
 * or browser-extension detection are required.
 *
 * 在不读取浏览器全局对象的情况下解析用户代理
 *
 * 当需要修正 iPad 桌面模式或浏览器扩展环境时，请传入客户端运行时信息
 */
export function parsePlatform(userAgentInput: unknown, environment: PlatformEnvironment = {}): PlatformInfo {
  const userAgent = normalizeUserAgent(userAgentInput)
  const browserMatch = getBrowserMatch(userAgent)
  const platformMatch = getPlatformMatch(userAgent)
  const info = createEmptyPlatformInfo()

  applyBrowserMatch(info, browserMatch)
  applyPlatformMatch(info, platformMatch)

  const knownMobile = info.android || info.ipad || info.iphone || info.kindle || info.silk
  info.mobile = knownMobile || userAgent.includes('mobile')
  info.desktop = !info.mobile

  // All browsers on an iOS device use WebKit. Chromium-based desktop browsers
  // retain Quasar's historical webkit-family flag for compatibility.
  //
  // iOS 设备上的所有浏览器都使用 WebKit，基于 Chromium 的桌面浏览器则保留
  // Quasar 历史上的 WebKit 浏览器家族兼容标识
  info.ios = info.ipad || info.iphone
  info.webkit = info.webkit || info.ios || info.chrome || info.opera || info.safari || info.vivaldi || (info.mobile && !info.ios && !knownMobile)

  // Android stock browsers can carry a Safari token without being Safari.
  //
  // Android 原生浏览器可能包含 Safari 标识，但并不是真正的 Safari
  if (info.safari && info.android) info.name = 'android'
  else if (info.safari && info.kindle) info.name = 'kindle'
  else if (info.safari && info.silk) info.name = 'silk'

  // Prefer an explicitly injected marker and fall back to the NativeApp UA token.
  //
  // 优先使用明确注入的标识，未注入时回退到 NativeApp 用户代理标识
  const nativeApp = environment.nativeApp ?? getUserAgentNativeApp(userAgent)
  if (nativeApp) {
    info.nativeApp = true
    info.nativeAppName = nativeApp.name
    info.nativeAppVersion = nativeApp.version
    info.nativeAppPlatform = nativeApp.platform
  }

  applyClientCorrections(info, userAgent, environment)

  return info
}

function readRuntimeEnvironment(): { environment: PlatformEnvironment; userAgent: string } {
  const runtime = globalThis as unknown as RuntimeGlobal
  const navigator = runtime.navigator
  const userAgent = navigator?.userAgent || navigator?.vendor || runtime.opera || ''
  let iframe = false

  try {
    iframe = runtime.self !== void 0 && runtime.top !== void 0 && runtime.self !== runtime.top
  } catch {
    // Access to window.top may be restricted by the host environment.
    //
    // 宿主环境可能会限制对 window.top 的访问
  }

  return {
    environment: {
      hasTouch: 'ontouchstart' in runtime,
      href: runtime.document?.location?.href,
      innerHeight: runtime.innerHeight,
      innerWidth: runtime.innerWidth,
      iframe,
      maxTouchPoints: navigator?.maxTouchPoints,
      mobileUserAgentData: navigator?.userAgentData?.mobile,
      nativeApp: getInjectedNativeApp(runtime.__NATIVE_APP_CONTEXT_V1__),
      opera: runtime.opera,
      vendor: navigator?.vendor,
      wechatJsEnvironment: runtime.__wxjs_environment,
    },
    userAgent,
  }
}

/**
 * Create a platform snapshot from explicit input or from the current runtime.
 *
 * 根据显式输入或当前运行环境创建平台快照
 */
export function createPlatform(userAgent?: string, environment?: PlatformEnvironment): PlatformSnapshot {
  const runtime = userAgent === void 0 && environment === void 0 ? readRuntimeEnvironment() : void 0
  const resolvedEnvironment = environment ?? runtime?.environment ?? {}
  const resolvedUserAgent = userAgent ?? runtime?.userAgent ?? resolvedEnvironment.vendor ?? resolvedEnvironment.opera ?? ''
  const normalizedUserAgent = normalizeUserAgent(resolvedUserAgent)
  const wechatMatch = WECHAT_RE.exec(normalizedUserAgent)

  return {
    has: {
      touch: resolvedEnvironment.hasTouch === true || (resolvedEnvironment.maxTouchPoints ?? 0) > 0,
    },
    is: parsePlatform(normalizedUserAgent, resolvedEnvironment),
    userAgent: resolvedUserAgent,
    within: {
      iframe: resolvedEnvironment.iframe === true,
      wechat: wechatMatch !== null,
      wechatMiniProgram: normalizedUserAgent.includes('miniprogram') || resolvedEnvironment.wechatJsEnvironment === 'miniprogram',
      ...(wechatMatch ? { wechatVersion: wechatMatch[1] ?? '0' } : {}),
    },
  }
}

/**
 * Platform snapshot for the current runtime. Safe to import during SSR.
 *
 * 当前运行环境的平台快照，可在 SSR 期间安全导入
 */
export const platform = createPlatform()
