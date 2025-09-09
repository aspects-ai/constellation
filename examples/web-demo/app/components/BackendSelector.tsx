'use client'

import { Alert, Badge, Box, Button, Group, Paper, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconCheck, IconDatabase, IconServer } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

export interface BackendConfig {
  type: 'local' | 'remote'
  // Remote backend specific fields
  host?: string
  username?: string
  workspace?: string
}

interface BackendSelectorProps {
  sessionId: string
  config: BackendConfig
  onChange: (config: BackendConfig) => void
  onTestConnection?: (config: BackendConfig) => Promise<boolean>
}

export default function BackendSelector({ 
  sessionId, 
  config, 
  onChange, 
  onTestConnection 
}: BackendSelectorProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown')
  const [dockerContainerRunning, setDockerContainerRunning] = useState(false)

  // Check if Docker container is running
  useEffect(() => {
    const checkDockerStatus = async () => {
      try {
        // Try to connect to the Docker SSH server
        const response = await fetch('/api/check-docker', { method: 'GET' })
        const data = await response.json()
        setDockerContainerRunning(data.running === true)
      } catch (error) {
        setDockerContainerRunning(false)
      }
    }

    checkDockerStatus()
    
    // Check every 60 seconds
    const interval = setInterval(checkDockerStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleBackendTypeChange = (value: string) => {
    const newType = value as 'local' | 'remote'
    
    if (newType === 'local') {
      onChange({ type: 'local' })
    } else {
      // Set Docker container defaults for remote backend
      onChange({
        type: 'remote',
        host: 'localhost:2222',
        username: 'root',
        workspace: '/workspace'
      })
    }
    
    setConnectionStatus('unknown')
  }

  const handleRemoteConfigChange = (field: string, value: string) => {
    onChange({
      ...config,
      [field]: value
    })
    setConnectionStatus('unknown')
  }

  const testConnection = async () => {
    if (!onTestConnection) return
    
    setIsTestingConnection(true)
    try {
      const success = await onTestConnection(config)
      setConnectionStatus(success ? 'success' : 'error')
    } catch (error) {
      setConnectionStatus('error')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const getDockerSetupInstructions = () => (
    <Alert 
      icon={<IconAlertCircle size="1rem" />} 
      title="Docker Container Setup Required" 
      color="blue"
    >
      <Stack gap="xs">
        <Text size="sm">
          To use the Docker remote backend, you need to start the SSH container:
        </Text>
        <Box component="pre" style={{ 
          backgroundColor: 'var(--mantine-color-dark-6)', 
          padding: '8px', 
          borderRadius: '4px',
          fontSize: '12px',
          overflow: 'auto'
        }}>
          ./setup-docker.sh
        </Box>
        <Text size="sm" c="dimmed">
          This will build and start a Docker container with SSH server on port 2222.
        </Text>
      </Stack>
    </Alert>
  )

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text size="lg" fw={600}>Backend Configuration</Text>
          <Badge 
            color={config.type === 'local' ? 'blue' : 'green'} 
            variant="light"
            leftSection={config.type === 'local' ? <IconDatabase size="0.8rem" /> : <IconServer size="0.8rem" />}
          >
            {config.type === 'local' ? 'Local Filesystem' : 'Remote SSH'}
          </Badge>
        </Group>

        <SegmentedControl
          value={config.type}
          onChange={handleBackendTypeChange}
          data={[
            { 
              label: 'Local', 
              value: 'local',
              disabled: false
            },
            { 
              label: 'Remote (Docker)', 
              value: 'remote',
              disabled: false
            }
          ]}
          fullWidth
        />

        {config.type === 'local' && (
          <Alert color="blue" icon={<IconCheck size="1rem" />}>
            <Text size="sm">
              Using local filesystem backend. Files will be stored in an isolated workspace 
              for session: <Text component="span" ff="monospace">{sessionId}</Text>
            </Text>
          </Alert>
        )}

        {config.type === 'remote' && (
          <Stack gap="sm">
            {!dockerContainerRunning && getDockerSetupInstructions()}
            
            <Stack gap="xs">
              <TextInput
                label="SSH Host"
                placeholder="localhost:2222"
                value={config.host || ''}
                onChange={(e) => handleRemoteConfigChange('host', e.currentTarget.value)}
                description="Format: hostname:port (e.g., localhost:2222 for Docker container)"
              />
              
              <Group grow>
                <TextInput
                  label="Username"
                  placeholder="root"
                  value={config.username || ''}
                  onChange={(e) => handleRemoteConfigChange('username', e.currentTarget.value)}
                  description="SSH username"
                />
                
                <TextInput
                  label="Remote Workspace"
                  placeholder="/workspace"
                  value={config.workspace || ''}
                  onChange={(e) => handleRemoteConfigChange('workspace', e.currentTarget.value)}
                  description="Remote directory path"
                />
              </Group>
            </Stack>

            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Button 
                  size="sm" 
                  variant="light"
                  onClick={testConnection}
                  loading={isTestingConnection}
                  disabled={!config.host || !config.username || !config.workspace}
                >
                  Test Connection
                </Button>
                
                {connectionStatus === 'success' && (
                  <Badge color="green" size="sm">
                    <Group gap={4}>
                      <IconCheck size="0.7rem" />
                      Connected
                    </Group>
                  </Badge>
                )}
                
                {connectionStatus === 'error' && (
                  <Badge color="red" size="sm">
                    <Group gap={4}>
                      <IconAlertCircle size="0.7rem" />
                      Failed
                    </Group>
                  </Badge>
                )}
              </Group>

              <Group gap="xs">
                <Badge 
                  color={dockerContainerRunning ? 'green' : 'gray'} 
                  size="sm"
                  variant={dockerContainerRunning ? 'filled' : 'outline'}
                >
                  Docker: {dockerContainerRunning ? 'Running' : 'Stopped'}
                </Badge>
              </Group>
            </Group>

            {config.type === 'remote' && dockerContainerRunning && (
              <Alert color="green" icon={<IconCheck size="1rem" />}>
                <Text size="sm">
                  Docker SSH container is running. You can connect using password 
                  <Text component="span" ff="monospace"> constellation</Text> or SSH keys.
                </Text>
              </Alert>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}