import fs from 'fs'
import path, { isAbsolute } from 'path'

export const FILE_READ_STATUS = {
    DOES_NOT_EXIST: '[FILE_DOES_NOT_EXIST]',
    IGNORED: '[FILE_IGNORED_BY_GITIGNORE_OR_CODEBUFF_IGNORE]',
    OUTSIDE_PROJECT: '[FILE_OUTSIDE_PROJECT]',
    TOO_LARGE: '[FILE_TOO_LARGE]',
    ERROR: '[FILE_READ_ERROR]',
  } as const

export function getFiles(filePaths: string[], cwd: string) {
  const result: Record<string, string | null> = {}
  const MAX_FILE_SIZE = 1024 * 1024 // 1MB in bytes

  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }

    // Convert absolute paths within project to relative paths
    const relativePath = filePath.startsWith(cwd)
      ? path.relative(cwd, filePath)
      : filePath
    const fullPath = path.join(cwd, relativePath)
    if (isAbsolute(relativePath) || !fullPath.startsWith(cwd)) {
      result[relativePath] = FILE_READ_STATUS.OUTSIDE_PROJECT
      continue
    }
    try {
      const stats = fs.statSync(fullPath)
      if (stats.size > MAX_FILE_SIZE) {
        result[relativePath] =
          FILE_READ_STATUS.TOO_LARGE +
          ` [${(stats.size / (1024 * 1024)).toFixed(2)}MB]`
      } else {
        const content = fs.readFileSync(fullPath, 'utf8')
        result[relativePath] = content
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        result[relativePath] = FILE_READ_STATUS.DOES_NOT_EXIST
      } else {
        result[relativePath] = FILE_READ_STATUS.ERROR
      }
    }
  }
  return result
}
