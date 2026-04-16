import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'

export type SliceCategory = 'bg' | 'img' | 'icon'

export interface SliceInfo {
  url: string
  category: SliceCategory
  logicalWidth?: number
  logicalHeight?: number
}

export interface DownloadedSlice {
  fileName: string
  filePath: string
  category: SliceCategory
  url: string
}

/**
 * 构建切图文件名，格式为 `{category}-{index}.{format}`
 * 例如：icon-1.webp、bg-3.png、img-2.webp
 */
export function buildSliceFileName(category: SliceCategory, index: number, format: string): string {
  return `${category}-${index}.${format}`
}

/**
 * 对切图列表去重，以 URL 为唯一标识，保留首次出现的切图
 */
export function deduplicateSlices(slices: SliceInfo[]): SliceInfo[] {
  const seen = new Set<string>()
  return slices.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })
}

/**
 * 构建指定倍率的下载 URL（利用蓝湖 OSS 图片缩放参数）。
 *
 * @param imageUrl - 原始 OSS 图片 URL（存储在 sliceScale 倍率下）
 * @param logicalW - 1x 逻辑宽度
 * @param logicalH - 1x 逻辑高度
 * @param sliceScale - 图片存储倍率（通常为 2）
 * @param targetScale - 目标输出倍率（1, 2, 或 3）
 */
export function buildScaleUrl(
  imageUrl: string,
  logicalW: number,
  logicalH: number,
  sliceScale: number,
  targetScale: number,
): string {
  const targetW = Math.max(1, Math.round(logicalW * targetScale))
  const targetH = Math.max(1, Math.round(logicalH * targetScale))
  const storedW = Math.round(logicalW * sliceScale)
  const storedH = Math.round(logicalH * sliceScale)

  // 目标尺寸与存储尺寸一致时，直接返回原始 URL
  if (targetW === storedW && targetH === storedH) {
    return imageUrl
  }

  return `${imageUrl}?x-oss-process=image/resize,w_${targetW},h_${targetH}/format,png`
}

/**
 * 下载切图到本地目录。
 *
 * @param slices - 去重后的切图列表
 * @param outputDir - 保存目录
 * @param format - 图片格式 (webp, png, svg)
 * @param scale - 目标倍率 (1, 2, 3)
 * @param sliceScale - 蓝湖存储倍率
 * @returns 已下载文件信息列表
 */
export async function downloadSlices(
  slices: SliceInfo[],
  outputDir: string,
  format: string = 'webp',
  scale: number = 2,
  sliceScale: number = 2,
): Promise<DownloadedSlice[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 每个分类的计数器
  const counters: Record<SliceCategory, number> = { bg: 0, img: 0, icon: 0 }
  const results: DownloadedSlice[] = []

  for (const slice of slices) {
    counters[slice.category]++
    const fileName = buildSliceFileName(slice.category, counters[slice.category], format)
    const filePath = path.join(outputDir, fileName)

    // 已下载则跳过
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      results.push({ fileName, filePath, category: slice.category, url: slice.url })
      continue
    }

    // 构建带倍率的下载 URL
    const downloadUrl = (slice.logicalWidth && slice.logicalHeight)
      ? buildScaleUrl(slice.url, slice.logicalWidth, slice.logicalHeight, sliceScale, scale)
      : slice.url

    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: { Accept: 'image/*' },
      })
      fs.writeFileSync(filePath, Buffer.from(response.data))
      results.push({ fileName, filePath, category: slice.category, url: slice.url })
    } catch (err) {
      console.error(`下载切图失败: ${downloadUrl}`, err)
    }
  }

  return results
}
