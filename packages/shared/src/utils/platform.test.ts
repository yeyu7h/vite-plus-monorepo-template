import { describe, expect, it } from 'vite-plus/test'

import { createPlatform, parsePlatform } from './platform.ts'

const SAFARI_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

const WECHAT_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47'

const NATIVE_APP_UA = `${SAFARI_MAC_UA} NativeApp/ExampleApp/2.3.0`

describe('parsePlatform', () => {
  it('detects Safari and uses the browser version', () => {
    const platform = parsePlatform(SAFARI_MAC_UA)

    expect(platform).toMatchObject({
      desktop: true,
      mac: true,
      name: 'safari',
      safari: true,
      version: '17.4',
      versionNumber: 17,
      webkit: true,
    })
  })

  it.each([
    ['Chrome', 'CriOS/120.0.0.0'],
    ['Firefox', 'FxiOS/121.0'],
    ['Edge', 'EdgiOS/120.0'],
  ])('sets ios for %s on iPhone', (_browser, browserToken) => {
    const platform = parsePlatform(`Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${browserToken} Mobile/15E148 Safari/604.1`)

    expect(platform.ios).toBe(true)
    expect(platform.iphone).toBe(true)
    expect(platform.mobile).toBe(true)
    expect(platform.webkit).toBe(true)
  })

  it('corrects the desktop Safari user agent used by an iPad', () => {
    const platform = parsePlatform(SAFARI_MAC_UA, {
      hasTouch: true,
      innerHeight: 1024,
      innerWidth: 768,
    })

    expect(platform).toMatchObject({
      desktop: false,
      ios: true,
      ipad: true,
      mac: false,
      mobile: true,
      platform: 'ipad',
    })
  })

  it('returns a stable empty result for a missing user agent', () => {
    expect(parsePlatform(void 0)).toMatchObject({
      desktop: true,
      mobile: false,
      name: '',
      platform: '',
      version: '0',
      versionNumber: 0,
    })
  })

  it('detects the reserved NativeApp user-agent marker', () => {
    const platform = parsePlatform(NATIVE_APP_UA)

    expect(platform).toMatchObject({
      nativeApp: true,
      nativeAppName: 'exampleapp',
      nativeAppVersion: '2.3.0',
    })
  })
})

describe('createPlatform', () => {
  it('detects WeChat independently from its Chromium browser engine', () => {
    const platform = createPlatform(WECHAT_ANDROID_UA)

    expect(platform.is).toMatchObject({
      android: true,
      chrome: true,
      mobile: true,
      name: 'chrome',
      version: '110.0.0.0',
    })
    expect(platform.within).toMatchObject({
      wechat: true,
      wechatVersion: '8.0.47',
    })
  })

  it('detects WeChat Mini Program from the user agent', () => {
    const platform = createPlatform(`${WECHAT_ANDROID_UA} miniProgram`)

    expect(platform.within.wechatMiniProgram).toBe(true)
  })

  it('detects WeChat Mini Program from its injected environment marker', () => {
    const platform = createPlatform(WECHAT_ANDROID_UA, { wechatJsEnvironment: 'miniprogram' })

    expect(platform.within.wechatMiniProgram).toBe(true)
  })

  it('supports explicit runtime hints without accessing DOM globals', () => {
    const platform = createPlatform('', {
      hasTouch: true,
      iframe: true,
      mobileUserAgentData: true,
    })

    expect(platform.has.touch).toBe(true)
    expect(platform.is.mobile).toBe(true)
    expect(platform.within.iframe).toBe(true)
  })

  it('detects a native app marker injected by the WebView host', () => {
    const platform = createPlatform(SAFARI_MAC_UA, {
      nativeApp: {
        name: 'Example App',
        version: '2.3.0',
      },
    })

    expect(platform.is).toMatchObject({
      nativeApp: true,
      nativeAppName: 'Example App',
      nativeAppVersion: '2.3.0',
    })

    expect(platform.is.nativeAppPlatform).toBe(void 0)
  })
})
