export interface LanhuParams {
  teamId: string
  projectId: string
  imageId?: string
  versionId?: string
}

export function parseLanhuUrl(url: string): LanhuParams {
  let paramStr = url

  // 完整 URL: 提取 fragment 部分
  if (url.startsWith('http')) {
    const hashIndex = url.indexOf('#')
    if (hashIndex === -1) {
      throw new Error('无效的蓝湖 URL: 缺少 fragment (#) 部分')
    }
    const fragment = url.slice(hashIndex + 1)
    const qIndex = fragment.indexOf('?')
    paramStr = qIndex !== -1 ? fragment.slice(qIndex + 1) : fragment
  }

  // 去除前导 ?
  if (paramStr.startsWith('?')) {
    paramStr = paramStr.slice(1)
  }

  // 解析 key=value 对
  const params = new Map<string, string>()
  for (const part of paramStr.split('&')) {
    const eqIndex = part.indexOf('=')
    if (eqIndex !== -1) {
      params.set(part.slice(0, eqIndex), part.slice(eqIndex + 1))
    }
  }

  const teamId = params.get('tid')
  const projectId = params.get('pid')
  const imageId = params.get('image_id') ?? params.get('docId')
  const versionId = params.get('versionId')

  if (!projectId) {
    throw new Error('URL 解析失败: 缺少必需参数 pid (project_id)')
  }
  if (!teamId) {
    throw new Error('URL 解析失败: 缺少必需参数 tid (team_id)')
  }

  return {
    teamId,
    projectId,
    imageId: imageId || undefined,
    versionId: versionId || undefined,
  }
}
