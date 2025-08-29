/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@anthropic-ai/sdk',
      '@anthropic-ai/claude-code'
    ]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore tree-sitter WASM files on server
      config.resolve.alias = {
        ...config.resolve.alias,
        'tree-sitter.wasm': false,
      }
    }
    
    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })
    
    return config
  }
}

module.exports = nextConfig