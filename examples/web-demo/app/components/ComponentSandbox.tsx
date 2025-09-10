'use client'

import { 
  SandpackProvider,
  SandpackLayout,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview
} from '@codesandbox/sandpack-react'
import { Box, Button, Group, Loader, Text } from '@mantine/core'
import { IconReload } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

interface BackendConfig {
  type: 'local' | 'remote'
  host?: string
  username?: string
  workspace?: string
}

interface ComponentSandboxProps {
  sessionId: string
  backendConfig: BackendConfig
}

interface WorkspaceFile {
  path: string
  content: string
}

export default function ComponentSandbox({ sessionId, backendConfig }: ComponentSandboxProps) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageJsonDeps, setPackageJsonDeps] = useState<Record<string, string>>({});
  const [sandpackKey, setSandpackKey] = useState(0); // Force Sandpack to re-instantiate
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWorkspaceFiles = async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
      // Clear existing files for a clean slate
      setFiles({});
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Fetch files via API with cache buster
      const params = new URLSearchParams({
        sessionId,
        backendType: backendConfig.type,
        timestamp: Date.now().toString(), // Cache buster
        ...(backendConfig.type === 'remote' && {
          host: backendConfig.host || '',
          username: backendConfig.username || '',
          workspace: backendConfig.workspace || ''
        })
      });
      
      const response = await fetch(`/api/sandbox-files?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }
      
      const data = await response.json();
      const sandpackFiles: Record<string, string> = {};
      let deps: Record<string, string> = {};
      
      console.log('[ComponentSandbox] Loading', data.files?.length || 0, 'files from workspace');
      
      // Process files from API response
      if (data.files && data.files.length > 0) {
        console.log('[ComponentSandbox] Processing', data.files.length, 'files from API');
        for (const file of data.files) {
          let sandpackPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
          
          // Handle src directory files - map them to root for Sandpack
          if (sandpackPath.startsWith('/src/')) {
            // Also include the file at root level for Sandpack compatibility
            const rootPath = sandpackPath.replace('/src/', '/');
            sandpackFiles[rootPath] = file.content;
            console.log('[ComponentSandbox] Mapped src file to root:', rootPath);
          }
          
          sandpackFiles[sandpackPath] = file.content;
          console.log('[ComponentSandbox] Added to sandpack:', sandpackPath);
          
          // Extract dependencies from package.json
          if (file.path === 'package.json' || file.path.endsWith('/package.json')) {
            try {
              const pkg = JSON.parse(file.content);
              deps = { ...pkg.dependencies, ...pkg.devDependencies };
              // Filter out local dependencies and ConstellationFS
              delete deps['constellationfs'];
              Object.keys(deps).forEach(key => {
                if (deps[key].startsWith('file:') || deps[key].startsWith('link:')) {
                  delete deps[key];
                }
              });
            } catch {}
          }
        }
      }
      
      // Log what we're setting
      console.log('[ComponentSandbox] Setting files:', Object.keys(sandpackFiles));
      console.log('[ComponentSandbox] Setting deps:', Object.keys(deps));
      
      setFiles(sandpackFiles);
      setPackageJsonDeps(deps);
      // Force Sandpack to completely re-instantiate with new files
      setSandpackKey(prev => {
        const newKey = prev + 1;
        console.log('[ComponentSandbox] Incrementing sandpackKey from', prev, 'to', newKey);
        return newKey;
      });
    } catch (err) {
      console.error('Failed to load workspace files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspace files');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Load files on mount and when backend config changes
  useEffect(() => {
    loadWorkspaceFiles();
  }, [sessionId, backendConfig]);
  
  // Listen for filesystem updates from chat
  useEffect(() => {
    const handleUpdate = () => {
      console.log('[ComponentSandbox] Received filesystem-update event, reloading files...');
      // Add a small delay to ensure files are written
      setTimeout(() => {
        loadWorkspaceFiles(true);
      }, 500);
    };
    
    window.addEventListener('filesystem-update', handleUpdate);
    return () => {
      window.removeEventListener('filesystem-update', handleUpdate);
    };
  }, [sessionId, backendConfig]);
  
  if (loading) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Group>
          <Loader size="lg" />
          <Text>Loading workspace files...</Text>
        </Group>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box p="xl" style={{ height: '100%' }}>
        <Text c="red" mb="md">Error: {error}</Text>
        <Button onClick={() => loadWorkspaceFiles(true)} leftSection={<IconReload size={16} />}>
          Retry
        </Button>
      </Box>
    );
  }
  
  if (Object.keys(files).length === 0) {
    return (
      <Box p="xl" style={{ height: '100%' }}>
        <Text mb="md">No files found in workspace</Text>
        <Button onClick={() => loadWorkspaceFiles(true)} leftSection={<IconReload size={16} />}>
          Force Restart
        </Button>
      </Box>
    );
  }
  
  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            React TypeScript Sandbox - {Object.keys(files).length} files loaded
          </Text>
          <Button 
            size="xs" 
            variant="filled"
            color="red"
            onClick={async () => {
              // Completely reset the sandbox by unmounting it first
              console.log('[ComponentSandbox] Force restart initiated');
              
              // Clear everything and force complete unmount
              setFiles({});
              setPackageJsonDeps({});
              setError(null);
              
              // Increment key with a larger jump to ensure React sees it as different
              setSandpackKey(prev => {
                const newKey = prev + 100;
                console.log('[ComponentSandbox] Force restart: jumping key from', prev, 'to', newKey);
                return newKey;
              });
              
              // Wait for React to process the unmount
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Now reload the files
              await loadWorkspaceFiles(true);
            }} 
            leftSection={<IconReload size={14} />}
            loading={isRefreshing}
          >
            Force Restart
          </Button>
        </Group>
      </Box>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <SandpackProvider
          key={`sandbox-${sandpackKey}-${Object.keys(files).length}`} // Include file count in key for extra safety
          template="react-ts"
          files={{
            ...files,
            // Ensure we have all required files for Sandpack react-ts template
            ...((!files['/index.tsx'] && !files['/index.jsx']) ? {
              '/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
            } : {}),
            ...((!files['/App.tsx'] && !files['/App.jsx']) ? {
              '/App.tsx': `export default function App() {
  return (
    <div className="App">
      <h1>ConstellationFS Workspace</h1>
      <p>Check the file explorer to see your workspace files.</p>
    </div>
  );
}`
            } : {}),
            ...((!files['/styles.css']) ? {
              '/styles.css': `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 20px;
}

.App {
  text-align: center;
}`
            } : {}),
            ...((!files['/public/index.html']) ? {
              '/public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
            } : {})
          }}
          customSetup={{
            dependencies: {
              ...packageJsonDeps,
              // Ensure React dependencies are included
              ...((!packageJsonDeps['react']) ? { 'react': '^18.0.0' } : {}),
              ...((!packageJsonDeps['react-dom']) ? { 'react-dom': '^18.0.0' } : {}),
              ...((!packageJsonDeps['@types/react']) ? { '@types/react': '^18.0.0' } : {}),
              ...((!packageJsonDeps['@types/react-dom']) ? { '@types/react-dom': '^18.0.0' } : {})
            }
          }}
          options={{
            autorun: true,
            recompileMode: "delayed",
            recompileDelay: 300,
            initMode: "lazy",
            activeFile: files['/App.tsx'] ? '/App.tsx' : files['/App.jsx'] ? '/App.jsx' : '/index.tsx'
          }}
          theme="dark"
        >
          <SandpackLayout style={{ height: '100%' }}>
            <SandpackFileExplorer style={{ width: '10%', minWidth: 150 }} />
            <SandpackCodeEditor showTabs closableTabs style={{ width: '20%', minWidth: 250 }} />
            <SandpackPreview showNavigator style={{ width: '70%', minWidth: 500 }} />
          </SandpackLayout>
        </SandpackProvider>
      </Box>
    </Box>
  );
}