import { useCallback, useEffect, useState } from 'react'
import {
  getDeferredInstallPrompt,
  isIOSDevice,
  isStandaloneDisplayMode,
  onInstallPromptChange,
  promptInstall,
} from '@/lib/installPrompt'

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => getDeferredInstallPrompt() !== null)
  const [standalone] = useState(isStandaloneDisplayMode)

  useEffect(() => onInstallPromptChange(() => setCanInstall(getDeferredInstallPrompt() !== null)), [])

  const install = useCallback(() => promptInstall(), [])

  return {
    canInstall,
    isStandalone: standalone,
    isIOS: isIOSDevice(),
    install,
  }
}
