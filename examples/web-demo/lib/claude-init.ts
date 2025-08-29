// Lazy loading module for Claude Code SDK with monkey-patching
import { ClaudeCodeAdapter } from 'constellationfs'

let isInitialized = false
let claudeQuery: any = null

export async function getClaudeQuery() {
  if (!isInitialized) {
    // Enable monkey-patching first
    await ClaudeCodeAdapter.enableMonkeyPatching()
    console.log('[ConstellationFS] Monkey-patching enabled')
    
    // Now safe to dynamically import Claude Code SDK
    const claudeModule = await import('@anthropic-ai/claude-code')
    claudeQuery = claudeModule.query
    isInitialized = true
    console.log('[ConstellationFS] Claude Code SDK loaded with monkey-patching active')
  }
  
  return claudeQuery
}

export { ClaudeCodeAdapter }

// Verification function to test if monkey-patching is active
export async function verifyMonkeyPatching(): Promise<{ isPatched: boolean; stats: any }> {
  // Reset stats
  ClaudeCodeAdapter.resetInterceptStats()
  
  // Try to use child_process directly
  const { exec } = await import('child_process')
  
  return new Promise((resolve) => {
    exec('echo "test"', (error, stdout, stderr) => {
      const stats = ClaudeCodeAdapter.getInterceptStats()
      resolve({
        isPatched: stats.exec > 0, // If exec was intercepted, we'll see a count
        stats
      })
    })
  })
}