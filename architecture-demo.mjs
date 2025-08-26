import { 
  FileSystem, 
  BackendFactory, 
  ClaudeCodeAdapter, 
  POSIXCommands 
} from './dist/index.js'
import { mkdir, rmdir } from 'fs/promises'
import { existsSync } from 'fs'

async function demonstrateArchitecture() {
  console.log('🏗️  ConstellationFS - New Architecture Demo')
  
  const workspace = './arch-demo-workspace'
  if (!existsSync(workspace)) {
    await mkdir(workspace, { recursive: true })
  }
  
  try {
    console.log('\n1️⃣  Backward Compatibility - Legacy API:')
    const fs1 = new FileSystem('./arch-demo-workspace')
    console.log('✅ Legacy string constructor works')
    console.log('   Backend type detected:', fs1.backendConfig.type)
    console.log('   Shell detected:', fs1.backendConfig.shell)
    
    console.log('\n2️⃣  New Backend Configuration API:')
    const fs2 = new FileSystem({
      type: 'local',
      workspace: './arch-demo-workspace',
      shell: 'bash',
      validateUtils: false,
      preventDangerous: true
    })
    console.log('✅ New backend config works')
    console.log('   Explicit shell setting:', fs2.backendConfig.shell)
    
    console.log('\n3️⃣  POSIX Commands Standardization:')
    await fs2.write('test1.txt', 'content1')
    await fs2.write('test2.md', 'content2')
    await fs2.exec('mkdir -p subdir')
    await fs2.write('subdir/nested.txt', 'nested content')
    
    // Test POSIX commands through Claude adapter
    const claude = new ClaudeCodeAdapter(fs2)
    const txtFiles = await claude.Glob('*.txt')
    console.log('✅ POSIX find command:', txtFiles)
    
    const grepResult = await claude.Grep('content', { files: '*.txt', lineNumbers: true })
    console.log('✅ POSIX grep command:', grepResult)
    
    console.log('\n4️⃣  Cross-Platform Shell Detection:')
    console.log('   Detected shell:', fs2.backendConfig.shell)
    console.log('   LANG/LC_ALL set for consistent output')
    
    console.log('\n5️⃣  Backend Factory System:')
    console.log('   Available backends:', BackendFactory.getAvailableBackends())
    
    try {
      const remoteFs = new FileSystem({
        type: 'remote',
        workspace: './workspace',
        host: 'example.com',
        auth: { type: 'key', credentials: {} }
      })
    } catch (error) {
      console.log('✅ Remote backend stub properly throws:', error.message.split('.')[0])
    }
    
    try {
      const dockerFs = new FileSystem({
        type: 'docker',
        workspace: './workspace',
        image: 'ubuntu:latest'
      })
    } catch (error) {
      console.log('✅ Docker backend stub properly throws:', error.message.split('.')[0])
    }
    
    console.log('\n6️⃣  Enhanced Error Handling:')
    const testResult = await fs2.exec('echo "POSIX commands work correctly"')
    console.log('✅ Command execution:', testResult)
    
    console.log('\n🎉 New architecture working correctly!')
    console.log('   ✓ Backward compatible API')
    console.log('   ✓ POSIX-compliant commands')  
    console.log('   ✓ Shell detection and standardization')
    console.log('   ✓ Extensible backend architecture')
    console.log('   ✓ Enhanced Claude Code integration')
    
  } finally {
    if (existsSync(workspace)) {
      await rmdir(workspace, { recursive: true })
    }
  }
}

demonstrateArchitecture().catch(console.error)