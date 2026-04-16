/**
 * 诊断脚本：分析蓝湖 detailDetach 页面的实际 DOM 结构和加载行为
 * 用法: npx tsx scripts/debug-screenshot.ts <lanhu-url>
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'

const url = process.argv[2]
if (!url) {
  console.error('用法: npx tsx scripts/debug-screenshot.ts <lanhu-url>')
  process.exit(1)
}

// 读取已保存的 cookie
const cookieFile = path.join(os.homedir(), '.lanhu-mcp', 'cookie.json')
const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'))
const cookieStr: string = cookieData.cookie

const cookies = cookieStr.split('; ').map((c) => {
  const [name, ...rest] = c.split('=')
  return { name, value: rest.join('='), domain: '.lanhuapp.com', path: '/' }
})

async function main() {
  const browser = await chromium.launch({ headless: false }) // 有头模式方便观察
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  await context.addCookies(cookies)

  const page = await context.newPage()

  // 监听关键网络请求
  const importantRequests: string[] = []
  page.on('response', (resp) => {
    const reqUrl = resp.url()
    if (reqUrl.includes('image') || reqUrl.includes('design') || reqUrl.includes('json') || reqUrl.includes('sketch')) {
      importantRequests.push(`[${resp.status()}] ${reqUrl.substring(0, 150)}`)
    }
  })

  console.log('正在打开页面...')
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  console.log('networkidle 完成，等待 5 秒...')
  await page.waitForTimeout(5000)

  // 抓取页面中所有可见的主要元素
  const domInfo = await page.evaluate(() => {
    const results: string[] = []

    // 检查 canvas
    const canvases = document.querySelectorAll('canvas')
    results.push(`canvas 数量: ${canvases.length}`)
    canvases.forEach((c, i) => {
      results.push(`  canvas[${i}]: ${c.width}x${c.height}, visible=${c.offsetParent !== null}`)
    })

    // 检查 img 标签
    const imgs = document.querySelectorAll('img')
    results.push(`img 数量: ${imgs.length}`)
    imgs.forEach((img, i) => {
      if (i < 10) {
        results.push(`  img[${i}]: ${img.naturalWidth}x${img.naturalHeight}, src=${img.src.substring(0, 100)}`)
      }
    })

    // 检查 iframe
    const iframes = document.querySelectorAll('iframe')
    results.push(`iframe 数量: ${iframes.length}`)
    iframes.forEach((f, i) => {
      results.push(`  iframe[${i}]: src=${f.src?.substring(0, 150)}`)
    })

    // 检查主要容器的 class（可能包含设计区域的标识）
    const mainContainers = document.querySelectorAll('[class*="design"], [class*="image"], [class*="canvas"], [class*="board"], [class*="detail"], [class*="preview"], [class*="viewer"]')
    results.push(`设计相关容器数量: ${mainContainers.length}`)
    mainContainers.forEach((el, i) => {
      if (i < 15) {
        const rect = el.getBoundingClientRect()
        results.push(`  [${i}] <${el.tagName.toLowerCase()} class="${el.className.toString().substring(0, 80)}"> ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.x)},${Math.round(rect.y)})`)
      }
    })

    // body 直接子元素
    results.push(`body 子元素:`)
    Array.from(document.body.children).forEach((el, i) => {
      if (i < 10) {
        const rect = el.getBoundingClientRect()
        results.push(`  [${i}] <${el.tagName.toLowerCase()} id="${el.id}" class="${el.className.toString().substring(0, 60)}"> ${Math.round(rect.width)}x${Math.round(rect.height)}`)
      }
    })

    return results.join('\n')
  })

  console.log('\n=== DOM 分析 ===')
  console.log(domInfo)

  console.log('\n=== 关键网络请求 ===')
  importantRequests.forEach(r => console.log(r))

  // 再等 10 秒后截一张图
  console.log('\n再等 10 秒后截图...')
  await page.waitForTimeout(10000)

  const outputPath = path.join(process.cwd(), 'page', 'lanhu-mcp-assets', 'screenshots', 'debug-screenshot.png')
  await page.screenshot({ path: outputPath, fullPage: true })
  console.log(`截图已保存: ${outputPath}`)

  // 再次检查 DOM 变化
  const domInfo2 = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas')
    const imgs = document.querySelectorAll('img')
    return `等待后: canvas=${canvases.length}, img=${imgs.length}`
  })
  console.log(domInfo2)

  await browser.close()
}

main().catch(console.error)
