import React from 'react';

interface OllamaInstallModalProps {
  isOpen: boolean;
  progress: number;
  step: string;
  message: string;
  error?: string;
  subProgress?: number;
  totalSize?: string;
  cancellable?: boolean;
  timeEstimate?: string;
  downloadSpeed?: string;
  onClose: () => void;
  onCancel?: () => void; // New prop to handle cancellation
}

const stepsMap: Record<string, { label: string; emoji: string; description: string }> = {
  checking: { 
    label: 'System Check', 
    emoji: '🔍', 
    description: 'Verifying system requirements and dependencies' 
  },
  winget: { 
    label: 'Package Manager', 
    emoji: '📦', 
    description: 'Installing Windows Package Manager for app installation' 
  },
  ollama: { 
    label: 'Ollama App', 
    emoji: '🤖', 
    description: 'Installing Ollama application (~150MB)' 
  },
  waiting: { 
    label: 'Service Start', 
    emoji: '⚡', 
    description: 'Starting Ollama background service' 
  },
  model: { 
    label: 'AI Model', 
    emoji: '🧠', 
    description: 'Downloading qwen3:8b language model (~4.5GB)' 
  },
  starting: { 
    label: 'Model Start', 
    emoji: '🚀', 
    description: 'Initializing the language model' 
  },
  complete: { 
    label: 'Complete', 
    emoji: '🎉', 
    description: 'Local LLM setup completed successfully!' 
  },
  error: { 
    label: 'Error', 
    emoji: '❌', 
    description: 'Installation encountered an error' 
  },
};

export const OllamaInstallModal: React.FC<OllamaInstallModalProps> = ({
  isOpen,
  progress,
  step,
  message,
  error,
  subProgress,
  totalSize,
  cancellable = false,
  timeEstimate,
  downloadSpeed,
  onClose,
  onCancel,
}) => {
  if (!isOpen) return null;
  
  const handleCancel = async () => {
    try {
      console.log('🚫 Cancelling Ollama installation...')
      
      // Notify parent component about cancellation first
      if (onCancel) {
        onCancel();
      }
      
      await window.electronAPI?.cancelOllamaInstallation();
      console.log('🚫 Installation cancelled successfully')
      
      // Close the modal after cancelling
      onClose();
    } catch (error) {
      console.error('Failed to cancel installation:', error);
      // Still close the modal even if cancellation failed
      onClose();
    }
  };

  const handleClose = async () => {
    // If the installation is still running and cancellable, cancel it first
    if (cancellable && step !== 'complete' && !error) {
      console.log('🚫 Closing modal - cancelling ongoing installation...')
      
      // Notify parent component about cancellation first
      if (onCancel) {
        onCancel();
      }
      
      try {
        await window.electronAPI?.cancelOllamaInstallation();
        console.log('🚫 Installation cancelled due to modal close')
      } catch (error) {
        console.error('Failed to cancel installation when closing modal:', error);
      }
    }
    
    // Close the modal
    onClose();
  };
  
  const currentStep = stepsMap[step] || { 
    label: 'Processing', 
    emoji: '⚙️', 
    description: message 
  };
  
  // Extract percentage from message if it's a download step
  const isDownloading = step === 'model' && (message.includes('%') || subProgress !== undefined)
  const downloadPercentage = subProgress || 0
  
  // Use totalSize if provided, otherwise extract from message
  const sizeInfo = totalSize || (() => {
    const sizeMatch = message.match(/\(([^)]+)\)/)
    return sizeMatch ? sizeMatch[1] : ''
  })()
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{currentStep.emoji}</div>
          <h2 className="text-xl font-bold mb-1">Setting up Local LLM</h2>
          <div className="text-sm text-muted-foreground">
            {currentStep.label}
          </div>
        </div>
        
        {/* Current step description */}
        <div className="mb-4 text-sm text-center">
          {currentStep.description}
        </div>
        
        {/* Overall progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Overall Progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Individual step progress for downloads */}
        {(subProgress !== undefined && subProgress > 0) && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{currentStep.label} Progress</span>
              <span>{subProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${subProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Size information */}
        {sizeInfo && (
          <div className="text-xs text-center text-muted-foreground mb-2 bg-muted/30 p-2 rounded">
            📦 {sizeInfo}
          </div>
        )}
        
        {/* Download speed and time estimate */}
        {(downloadSpeed || timeEstimate) && (
          <div className="flex justify-between text-xs text-muted-foreground mb-4 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            {downloadSpeed && (
              <div className="flex items-center gap-1">
                <span>🚀</span>
                <span>{downloadSpeed}</span>
              </div>
            )}
            {timeEstimate && (
              <div className="flex items-center gap-1">
                <span>⏱️</span>
                <span>ETA: {timeEstimate}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Detailed message */}
        <div className="text-xs text-muted-foreground mb-4 p-3 bg-muted/20 rounded border-l-4 border-blue-500">
          {message}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
            <div className="flex items-center">
              <span className="text-lg mr-2">❌</span>
              {error}
            </div>
          </div>
        )}
        
        {/* Estimated time for downloads */}
        {isDownloading && downloadPercentage > 0 && downloadPercentage < 100 && (
          <div className="text-xs text-center text-muted-foreground mb-4 bg-blue-50 dark:bg-blue-950 p-2 rounded">
            📡 Large model download in progress - this may take 10-30 minutes depending on your internet speed
          </div>
        )}
        
        {/* Action buttons */}
        <div className="mt-2 flex gap-2">
          {/* Cancel button - only show when cancellable */}
          {cancellable && (
            <button
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              onClick={handleCancel}
            >
              Cancel Download
            </button>
          )}
          
          {/* Main action button */}
          <button
            className={`px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50 transition-colors ${
              cancellable ? 'flex-1' : 'w-full'
            }`}
            onClick={handleClose}
            disabled={step !== 'complete' && !error}
          >
            {error ? 'Close' : step === 'complete' ? 'Done' : 'Please wait...'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default OllamaInstallModal;
