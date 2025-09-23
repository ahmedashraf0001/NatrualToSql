// import React, { useState, useEffect } from 'react'
// import { motion, AnimatePresence } from 'framer-motion'
// import { AppSettings, PREDEFINED_THEMES } from '@/types/settings'
// import { settingsService } from '@/services/settingsService'
// import { NotificationMessage } from '@/types'
// import { Button } from '@/components/ui/button'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { Input } from '@/components/ui/input'
// import { 
//   Palette,
//   Code,
//   Database,
//   Bell,
//   Shield,
//   Zap,
//   Monitor,
//   Download,
//   Upload,
//   RotateCcw,
//   X,
//   Sun,
//   Moon,
//   Laptop,
//   AlertTriangle
// } from 'lucide-react'

// interface SimpleSettingsProps {
//   onClose: () => void
//   onNotification: (notification: Omit<NotificationMessage, 'id'>) => void
// }

// const SimpleSettings: React.FC<SimpleSettingsProps> = ({ onClose, onNotification }) => {
//   const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings())
//   const [hasChanges, setHasChanges] = useState(false)
//   const [activeTab, setActiveTab] = useState('appearance')

//   // Subscribe to settings changes
//   useEffect(() => {
//     const unsubscribe = settingsService.subscribe((newSettings) => {
//       setSettings(newSettings)
//     })
//     return unsubscribe
//   }, [])

//   // Track changes
//   useEffect(() => {
//     const originalSettings = settingsService.getSettings()
//     const hasModifications = JSON.stringify(settings) !== JSON.stringify(originalSettings)
//     setHasChanges(hasModifications)
//   }, [settings])

//   const updateSetting = <T extends keyof AppSettings, K extends keyof AppSettings[T]>(
//     category: T,
//     key: K,
//     value: AppSettings[T][K]
//   ) => {
//     try {
//       settingsService.update(category, key, value)
//       onNotification({
//         type: 'success',
//         title: 'Setting Updated',
//         message: `${String(category)} setting updated successfully`,
//         duration: 2000
//       })
//     } catch (error) {
//       onNotification({
//         type: 'error',
//         title: 'Setting Update Failed',
//         message: error instanceof Error ? error.message : 'Unknown error occurred',
//         duration: 4000
//       })
//     }
//   }

//   const resetCategory = (category: keyof AppSettings) => {
//     settingsService.resetCategory(category)
//     onNotification({
//       type: 'info',
//       title: 'Settings Reset',
//       message: `${category} settings have been reset to defaults`,
//       duration: 3000
//     })
//   }

//   const resetAll = () => {
//     settingsService.resetToDefaults()
//     onNotification({
//       type: 'info',
//       title: 'All Settings Reset',
//       message: 'All settings have been reset to defaults',
//       duration: 3000
//     })
//   }

//   const exportSettings = () => {
//     try {
//       const exportData = settingsService.exportSettings()
//       const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
//       const url = URL.createObjectURL(blob)
      
//       const a = document.createElement('a')
//       a.href = url
//       a.download = `naturaltosql-settings-${new Date().toISOString().split('T')[0]}.json`
//       document.body.appendChild(a)
//       a.click()
//       document.body.removeChild(a)
//       URL.revokeObjectURL(url)
      
//       onNotification({
//         type: 'success',
//         title: 'Settings Exported',
//         message: 'Settings have been exported successfully',
//         duration: 3000
//       })
//     } catch (error) {
//       onNotification({
//         type: 'error',
//         title: 'Export Failed',
//         message: 'Failed to export settings',
//         duration: 4000
//       })
//     }
//   }

//   const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0]
//     if (!file) return

//     const reader = new FileReader()
//     reader.onload = (e) => {
//       try {
//         const importData = JSON.parse(e.target?.result as string)
//         settingsService.importSettings(importData)
//         onNotification({
//           type: 'success',
//           title: 'Settings Imported',
//           message: 'Settings have been imported successfully',
//           duration: 3000
//         })
//       } catch (error) {
//         onNotification({
//           type: 'error',
//           title: 'Import Failed',
//           message: 'Failed to import settings. Please check the file format.',
//           duration: 4000
//         })
//       }
//     }
//     reader.readAsText(file)
//   }

//   const CustomSwitch = ({ checked, onChange, label, description }: {
//     checked: boolean
//     onChange: (checked: boolean) => void
//     label: string
//     description?: string
//   }) => (
//     <div className="flex items-center justify-between">
//       <div className="space-y-0.5">
//         <label className="text-sm font-medium">{label}</label>
//         {description && (
//           <p className="text-xs text-muted-foreground">{description}</p>
//         )}
//       </div>
//       <button
//         role="switch"
//         aria-checked={checked}
//         onClick={() => onChange(!checked)}
//         className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
//           checked ? 'bg-primary' : 'bg-gray-200'
//         }`}
//       >
//         <span
//           className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
//             checked ? 'translate-x-6' : 'translate-x-1'
//           }`}
//         />
//       </button>
//     </div>
//   )

//   const CustomSelect = ({ value, onChange, options, label, description }: {
//     value: string
//     onChange: (value: string) => void
//     options: { value: string; label: string }[]
//     label: string
//     description?: string
//   }) => (
//     <div className="flex items-center justify-between">
//       <div className="space-y-0.5">
//         <label className="text-sm font-medium">{label}</label>
//         {description && (
//           <p className="text-xs text-muted-foreground">{description}</p>
//         )}
//       </div>
//       <select
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
//       >
//         {options.map((option) => (
//           <option key={option.value} value={option.value}>
//             {option.label}
//           </option>
//         ))}
//       </select>
//     </div>
//   )

//   const CustomSlider = ({ value, onChange, min, max, step, label, description, unit = '' }: {
//     value: number
//     onChange: (value: number) => void
//     min: number
//     max: number
//     step: number
//     label: string
//     description?: string
//     unit?: string
//   }) => (
//     <div className="space-y-2">
//       <div className="flex items-center justify-between">
//         <div className="space-y-0.5">
//           <label className="text-sm font-medium">{label}</label>
//           {description && (
//             <p className="text-xs text-muted-foreground">{description}</p>
//           )}
//         </div>
//         <span className="text-sm font-mono">
//           {value}{unit}
//         </span>
//       </div>
//       <input
//         type="range"
//         min={min}
//         max={max}
//         step={step}
//         value={value}
//         onChange={(e) => onChange(Number(e.target.value))}
//         className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
//       />
//     </div>
//   )

//   const containerVariants = {
//     hidden: { opacity: 0, scale: 0.95 },
//     visible: { 
//       opacity: 1, 
//       scale: 1,
//       transition: { 
//         duration: 0.3,
//         staggerChildren: 0.05
//       }
//     },
//     exit: { 
//       opacity: 0, 
//       scale: 0.95,
//       transition: { duration: 0.2 }
//     }
//   }

//   return (
//     <motion.div 
//       className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       exit={{ opacity: 0 }}
//     >
//       <motion.div
//         className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
//         variants={containerVariants}
//         initial="hidden"
//         animate="visible"
//         exit="exit"
//       >
//         {/* Header */}
//         <div className="flex items-center justify-between p-6 border-b bg-gray-50 dark:bg-gray-800">
//           <div className="flex items-center space-x-3">
//             <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
//               <Monitor className="w-5 h-5 text-white" />
//             </div>
//             <div>
//               <h1 className="text-xl font-bold">Settings</h1>
//               <p className="text-sm text-gray-600 dark:text-gray-400">Customize your NaturalToSQL experience</p>
//             </div>
//           </div>
          
//           <div className="flex items-center space-x-2">
//             {hasChanges && (
//               <div className="flex items-center space-x-1 text-amber-600 text-sm">
//                 <AlertTriangle className="w-4 h-4" />
//                 <span>Unsaved changes</span>
//               </div>
//             )}
//             <Button variant="ghost" size="sm" onClick={onClose}>
//               <X className="w-4 h-4" />
//             </Button>
//           </div>
//         </div>

//         <div className="flex h-[calc(90vh-88px)]">
//           {/* Sidebar */}
//           <div className="w-64 border-r bg-gray-50 dark:bg-gray-800 p-4 overflow-y-auto">
//             <nav className="space-y-2">
//               {[
//                 { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and visual preferences' },
//                 { id: 'editor', label: 'Editor', icon: Code, description: 'Code editor settings' },
//                 { id: 'query', label: 'Query Behavior', icon: Database, description: 'SQL generation and execution' },
//                 { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences' },
//                 { id: 'privacy', label: 'Privacy & Security', icon: Shield, description: 'Data protection settings' },
//                 { id: 'performance', label: 'Performance', icon: Zap, description: 'Optimization settings' },
//                 { id: 'advanced', label: 'Advanced', icon: Monitor, description: 'Developer and system settings' }
//               ].map((tab) => (
//                 <motion.button
//                   key={tab.id}
//                   className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
//                     activeTab === tab.id
//                       ? 'bg-primary text-white shadow-md'
//                       : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
//                   }`}
//                   onClick={() => setActiveTab(tab.id)}
//                   whileHover={{ scale: 1.02 }}
//                   whileTap={{ scale: 0.98 }}
//                 >
//                   <div className="flex items-center space-x-3">
//                     <tab.icon className="w-4 h-4" />
//                     <div>
//                       <div className="font-medium text-sm">{tab.label}</div>
//                       <div className="text-xs opacity-70">{tab.description}</div>
//                     </div>
//                   </div>
//                 </motion.button>
//               ))}
//             </nav>

//             {/* Actions */}
//             <div className="mt-6 pt-6 border-t space-y-2">
//               <Button
//                 variant="outline"
//                 size="sm"
//                 className="w-full justify-start"
//                 onClick={exportSettings}
//               >
//                 <Download className="w-4 h-4 mr-2" />
//                 Export Settings
//               </Button>
              
//               <label className="block">
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   className="w-full justify-start cursor-pointer"
//                 >
//                   <Upload className="w-4 h-4 mr-2" />
//                   Import Settings
//                 </Button>
//                 <input
//                   type="file"
//                   accept=".json"
//                   className="hidden"
//                   onChange={importSettings}
//                 />
//               </label>
              
//               <Button
//                 variant="outline"
//                 size="sm"
//                 className="w-full justify-start text-amber-600 border-amber-200 hover:bg-amber-50"
//                 onClick={resetAll}
//               >
//                 <RotateCcw className="w-4 h-4 mr-2" />
//                 Reset All
//               </Button>
//             </div>
//           </div>

//           {/* Content */}
//           <div className="flex-1 overflow-y-auto">
//             <AnimatePresence mode="wait">
//               <motion.div
//                 key={activeTab}
//                 initial={{ opacity: 0, x: 20 }}
//                 animate={{ opacity: 1, x: 0 }}
//                 exit={{ opacity: 0, x: -20 }}
//                 transition={{ duration: 0.2 }}
//                 className="p-6"
//               >
//                 {/* Appearance Settings */}
//                 {activeTab === 'appearance' && (
//                   <div className="space-y-6">
//                     <div className="flex items-center justify-between">
//                       <h2 className="text-2xl font-bold">Appearance</h2>
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => resetCategory('appearance')}
//                       >
//                         <RotateCcw className="w-4 h-4 mr-2" />
//                         Reset
//                       </Button>
//                     </div>

//                     <div className="grid gap-6">
//                       <Card>
//                         <CardHeader>
//                           <CardTitle className="flex items-center space-x-2">
//                             <Sun className="w-5 h-5" />
//                             <span>Theme</span>
//                           </CardTitle>
//                         </CardHeader>
//                         <CardContent className="space-y-4">
//                           <CustomSelect
//                             label="Color Theme"
//                             description="Choose your preferred color scheme"
//                             value={settings.appearance.theme}
//                             onChange={(value) => updateSetting('appearance', 'theme', value as 'light' | 'dark' | 'auto')}
//                             options={[
//                               { value: 'light', label: 'Light' },
//                               { value: 'dark', label: 'Dark' },
//                               { value: 'auto', label: 'Auto' }
//                             ]}
//                           />

//                           <div className="space-y-2">
//                             <div className="flex items-center justify-between">
//                               <div className="space-y-0.5">
//                                 <label className="text-sm font-medium">Accent Color</label>
//                                 <p className="text-xs text-gray-600 dark:text-gray-400">Primary color for buttons and highlights</p>
//                               </div>
//                               <div className="flex items-center space-x-2">
//                                 <Input
//                                   type="color"
//                                   value={settings.appearance.accentColor}
//                                   onChange={(e) => updateSetting('appearance', 'accentColor', e.target.value)}
//                                   className="w-12 h-8 p-1 rounded"
//                                 />
//                                 <Input
//                                   type="text"
//                                   value={settings.appearance.accentColor}
//                                   onChange={(e) => updateSetting('appearance', 'accentColor', e.target.value)}
//                                   className="w-24 font-mono text-xs"
//                                 />
//                               </div>
//                             </div>
//                           </div>

//                           <div className="space-y-2">
//                             <label className="text-sm font-medium">Predefined Themes</label>
//                             <p className="text-xs text-gray-600 dark:text-gray-400">Quick theme presets</p>
//                             <div className="grid grid-cols-5 gap-2">
//                               {PREDEFINED_THEMES.map((theme) => (
//                                 <button
//                                   key={theme.name}
//                                   className="aspect-square rounded-lg border-2 border-transparent hover:border-primary p-1 transition-colors"
//                                   onClick={() => {
//                                     updateSetting('appearance', 'accentColor', theme.colors.primary)
//                                   }}
//                                   title={theme.name}
//                                 >
//                                   <div
//                                     className="w-full h-full rounded-md"
//                                     style={{
//                                       background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`
//                                     }}
//                                   />
//                                 </button>
//                               ))}
//                             </div>
//                           </div>
//                         </CardContent>
//                       </Card>

//                       <Card>
//                         <CardHeader>
//                           <CardTitle>Layout</CardTitle>
//                         </CardHeader>
//                         <CardContent className="space-y-4">
//                           <CustomSwitch
//                             checked={settings.appearance.compactMode}
//                             onChange={(checked) => updateSetting('appearance', 'compactMode', checked)}
//                             label="Compact Mode"
//                             description="Reduce spacing and padding for more content"
//                           />

//                           <CustomSwitch
//                             checked={settings.appearance.showAnimations}
//                             onChange={(checked) => updateSetting('appearance', 'showAnimations', checked)}
//                             label="Show Animations"
//                             description="Enable smooth animations and transitions"
//                           />

//                           <CustomSelect
//                             label="Font Size"
//                             description="Base font size for the interface"
//                             value={settings.appearance.fontSize}
//                             onChange={(value) => updateSetting('appearance', 'fontSize', value as 'small' | 'medium' | 'large')}
//                             options={[
//                               { value: 'small', label: 'Small' },
//                               { value: 'medium', label: 'Medium' },
//                               { value: 'large', label: 'Large' }
//                             ]}
//                           />
//                         </CardContent>
//                       </Card>
//                     </div>
//                   </div>
//                 )}

//                 {/* Placeholder for other tabs */}
//                 {activeTab !== 'appearance' && (
//                   <div className="space-y-6">
//                     <div className="flex items-center justify-between">
//                       <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => resetCategory(activeTab as keyof AppSettings)}
//                       >
//                         <RotateCcw className="w-4 h-4 mr-2" />
//                         Reset
//                       </Button>
//                     </div>

//                     <Card>
//                       <CardContent className="p-8 text-center">
//                         <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-400" />
//                         <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
//                         <p className="text-gray-600 dark:text-gray-400">
//                           {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings will be available in a future update.
//                         </p>
//                       </CardContent>
//                     </Card>
//                   </div>
//                 )}
//               </motion.div>
//             </AnimatePresence>
//           </div>
//         </div>
//       </motion.div>
//     </motion.div>
//   )
// }

// export default SimpleSettings
