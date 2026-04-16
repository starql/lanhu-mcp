import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'

// cookie 持久化存储目录和文件路径
const COOKIE_DIR = path.join(os.homedir(), '.lanhu-mcp')
const COOKIE_FILE = path.join(COOKIE_DIR, 'cookie.json')

// 存储 cookie 的数据结构
interface StoredCookie {
  cookie: string
  updatedAt: string
}

/**
 * 从本地文件加载缓存的 cookie。
 * 文件不存在或解析失败时返回 null。
 */
export function loadCookie(): string | null {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return null
    const data: StoredCookie = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
    return data.cookie || null
  } catch {
    return null
  }
}

/**
 * 将 cookie 字符串持久化到本地文件。
 */
function saveCookie(cookie: string): void {
  if (!fs.existsSync(COOKIE_DIR)) {
    fs.mkdirSync(COOKIE_DIR, { recursive: true })
  }
  const data: StoredCookie = { cookie, updatedAt: new Date().toISOString() }
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 启动 Playwright 浏览器，引导用户手动登录蓝湖，
 * 登录成功后提取 cookie 并保存到本地文件。
 */
export async function loginAndGetCookie(): Promise<string> {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('https://lanhuapp.com/web/')

  // 等待用户手动登录 — 检测跳转到项目列表页面
  await page.waitForURL(/lanhuapp\.com\/web\/#\/item/, { timeout: 300_000 })

  // 等待 cookie 稳定
  await page.waitForTimeout(2000)

  // 提取 cookie 并格式化为 Cookie header 字符串
  const cookies = await context.cookies('https://lanhuapp.com')
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  await browser.close()

  if (!cookieStr) {
    throw new Error('登录失败: 未获取到 cookie')
  }

  saveCookie(cookieStr)
  return cookieStr
}

/**
 * 获取有效的 cookie。优先返回缓存的 cookie，
 * 如果没有则启动浏览器登录流程。
 */
export async function ensureCookie(): Promise<string> {
  const cached = loadCookie()
  if (cached) return cached
  return loginAndGetCookie()
}

/**
 * 清除已存储的 cookie，下次请求时会触发重新登录。
 */
export function clearCookie(): void {
  if (fs.existsSync(COOKIE_FILE)) {
    fs.unlinkSync(COOKIE_FILE)
  }
}
