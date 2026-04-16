import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { ensureCookie, clearCookie, loginAndGetCookie } from './auth.js'

const BASE_URL = 'https://lanhuapp.com'

export interface DesignImageInfo {
  id: string
  name: string
  width: number
  height: number
  url: string
  updateTime: string
}

export interface DesignListResult {
  projectName: string
  designs: DesignImageInfo[]
}

export interface DesignJsonResult {
  sketchData: any
  sliceScale: number
  isFigma: boolean
  previewUrl: string
}

export class LanhuApiClient {
  private client: AxiosInstance | null = null
  private cookie: string = ''

  private async getClient(): Promise<AxiosInstance> {
    if (this.client) return this.client

    this.cookie = await ensureCookie()
    this.client = axios.create({
      timeout: 30_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://lanhuapp.com/web/',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': this.cookie,
        'request-from': 'web',
        'real-path': '/item/project/product',
      },
    })
    return this.client
  }

  /** 认证失败时自动重试：清除 cookie，重新登录，再重试请求 */
  private async withAuthRetry<T>(fn: (client: AxiosInstance) => Promise<T>): Promise<T> {
    const client = await this.getClient()
    try {
      return await fn(client)
    } catch (err: any) {
      const status = err?.response?.status
      const code = err?.response?.data?.code
      const isAuthError = status === 401 || status === 403 || code === 4002

      if (!isAuthError) throw err

      // Cookie 过期，重新登录
      clearCookie()
      this.cookie = await loginAndGetCookie()
      this.client = null
      const newClient = await this.getClient()
      return fn(newClient)
    }
  }

  /** 获取项目中的设计图列表 */
  async getDesigns(projectId: string, teamId: string): Promise<DesignListResult> {
    return this.withAuthRetry(async (client) => {
      const res = await client.get(`${BASE_URL}/api/project/images`, {
        params: {
          project_id: projectId,
          team_id: teamId,
          dds_status: 1,
          position: 1,
          show_cb_src: 1,
          comment: 1,
        },
      })

      const data = res.data
      if (data.code !== '00000') {
        throw new Error(`蓝湖 API 错误: ${data.msg} (code=${data.code})`)
      }

      const projectData = data.data ?? {}
      const images = projectData.images ?? []

      return {
        projectName: projectData.name ?? '',
        designs: images.map((img: any) => ({
          id: img.id,
          name: img.name,
          width: img.width,
          height: img.height,
          url: img.url,
          updateTime: img.update_time,
        })),
      }
    })
  }

  /** 获取设计稿元信息并下载完整的 Sketch JSON */
  async getDesignJson(projectId: string, imageId: string, teamId: string): Promise<DesignJsonResult> {
    return this.withAuthRetry(async (client) => {
      // 第一步：获取设计稿元信息（包含 json_url）
      const metaRes = await client.get(`${BASE_URL}/api/project/image`, {
        params: {
          image_id: imageId,
          project_id: projectId,
          team_id: teamId,
          dds_status: 1,
        },
      })

      const metaData = metaRes.data
      const result = metaData.result ?? metaData.data
      if (!result?.versions?.[0]?.json_url) {
        throw new Error('从蓝湖 API 获取设计稿 JSON URL 失败')
      }

      const version = result.versions[0]
      const jsonUrl = version.json_url

      // 设计稿预览图 URL
      const previewUrl: string = result.url ?? version.url ?? ''

      // 第二步：下载完整的 Sketch JSON
      const jsonRes = await client.get(jsonUrl)
      const sketchData = jsonRes.data

      // 提取元信息
      const meta = sketchData.meta ?? {}
      const sliceScale = Number(
        sketchData.sliceScale ?? sketchData.exportScale ?? meta.sliceScale ?? 2
      )
      const isFigma = meta?.host?.name === 'figma'

      return { sketchData, sliceScale, isFigma, previewUrl }
    })
  }

  /** 获取 cookie 字符串（供 Playwright 页面访问使用） */
  async getCookie(): Promise<string> {
    await this.getClient()
    return this.cookie
  }
}
