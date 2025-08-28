'use client'

import { useState } from 'react'
import { 
  Modal, 
  TextInput, 
  Button, 
  Text, 
  Stack, 
  Alert,
  Anchor 
} from '@mantine/core'
import { IconKey, IconExternalLink, IconAlertCircle } from '@tabler/icons-react'

interface ApiKeyModalProps {
  opened: boolean
  onSubmit: (apiKey: string) => void
}

export default function ApiKeyModal({ opened, onSubmit }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const handleSubmit = async () => {
    if (!apiKey.trim()) return
    
    setIsValidating(true)
    
    // Simple validation - just check if it looks like an Anthropic API key
    if (!apiKey.startsWith('sk-ant-')) {
      setIsValidating(false)
      return
    }
    
    // Store in localStorage and close modal
    localStorage.setItem('anthropic_api_key', apiKey.trim())
    onSubmit(apiKey.trim())
    setIsValidating(false)
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {}} // Prevent closing without API key
      title="Enter Your Anthropic API Key"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      size="md"
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Your API key is stored locally in your browser and sent directly to Anthropic's servers. 
            It is never stored on our servers.
          </Text>
        </Alert>

        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Get your API key from the{' '}
            <Anchor 
              href="https://console.anthropic.com/settings/keys" 
              target="_blank"
              size="sm"
            >
              Anthropic Console
              <IconExternalLink size={12} style={{ marginLeft: 4 }} />
            </Anchor>
          </Text>

          <TextInput
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            leftSection={<IconKey size={16} />}
            type="password"
            size="md"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit()
              }
            }}
          />
        </Stack>

        <Button
          onClick={handleSubmit}
          disabled={!apiKey.trim() || !apiKey.startsWith('sk-ant-')}
          loading={isValidating}
          size="md"
          fullWidth
        >
          Start Demo
        </Button>

        <Text size="xs" c="dimmed" ta="center">
          Your API key will be stored locally in your browser and used for AI requests.
          You can clear it anytime from your browser's developer tools.
        </Text>
      </Stack>
    </Modal>
  )
}