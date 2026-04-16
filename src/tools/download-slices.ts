import { z } from 'zod'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { LanhuApiClient } from '../core/api.js'
import { parseSketchJson } from '../core/parser.js'
import { downloadSlices, deduplicateSlices, type SliceInfo } from '../utils/download.js'

const apiClient = new LanhuApiClient()

/** 从清洗后的节点树中提取所有图片引用 */
function collectImageRefs(
  nodes: Array<{ type: string; imageRef?: string; children?: any[]; class: string; name: string }>,
): SliceInfo[] {
  const slices: SliceInfo[] = []

  function walk(node: any) {
    if ((node.type === 'image' || node.type === 'icon') && node.imageRef) {
      let category: 'bg' | 'img' | 'icon' = 'img'
      if (node.type === 'icon') category = 'icon'
      // 通过 class 中的宽度判断是否为背景图
      const wMatch = node.class.match(/w-(\d+)px/)
      if (wMatch && Number(wMatch[1]) >= 600) category = 'bg'

      slices.push({ url: node.imageRef, category })
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }

  nodes.forEach(walk)
  return slices
}

export function registerDownloadSlicesTool(server: McpServer): void {
  server.tool(
    'lanhu_download_slices',
    '下载蓝湖设计稿中已标注的切图资源（图标、图片、背景图）。文件按类型命名：bg-1.webp、img-1.webp、icon-1.webp。返回下载清单，供用户确认后在代码中引用。',
    {
      url: z.string().describe('蓝湖 URL，包含 tid、pid 和 image_id'),
      image_id: z.string().optional().describe('设计图 ID，如果 URL 中没有'),
      output_dir: z.string().optional().describe('切图保存目录。默认为 page/lanhu-mcp-assets/slices/。'),
      format: z.enum(['webp', 'png', 'svg']).optional().describe('图片格式。默认 webp。'),
      scale: z.number().optional().describe('倍率（1、2 或 3）。默认 2。'),
    },
    async ({ url, image_id, output_dir, format, scale }) => {
      try {
        const params = parseLanhuUrl(url)
        const targetImageId = image_id ?? params.imageId

        if (!targetImageId) {
          return {
            content: [{ type: 'text', text: '错误: 需要 image_id。请先使用 lanhu_get_design 获取设计图列表。' }],
            isError: true,
          }
        }

        // 获取并解析设计稿
        const { sketchData, sliceScale, isFigma } = await apiClient.getDesignJson(
          params.projectId, targetImageId, params.teamId,
        )
        const cleanedTree = parseSketchJson(sketchData, { isFigma, sliceScale })

        // 收集并去重切图
        const allSlices = collectImageRefs(cleanedTree)
        const uniqueSlices = deduplicateSlices(allSlices)

        if (uniqueSlices.length === 0) {
          return {
            content: [{ type: 'text', text: '该设计稿中未找到切图。设计稿可能没有标注任何导出资源。' }],
          }
        }

        // 下载
        const targetDir = output_dir ?? path.join(process.cwd(), 'page', 'lanhu-mcp-assets', 'slices')
        const targetFormat = format ?? 'webp'
        const targetScale = scale ?? 2

        const downloaded = await downloadSlices(uniqueSlices, targetDir, targetFormat, targetScale, sliceScale)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              outputDir: targetDir,
              format: targetFormat,
              scale: `${targetScale}x`,
              totalFound: allSlices.length,
              totalUnique: uniqueSlices.length,
              downloaded: downloaded.map((d) => ({
                fileName: d.fileName,
                category: d.category,
                path: d.filePath,
              })),
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `下载切图失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
