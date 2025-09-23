// import React, { useState } from 'react'
// import { AnimatePresence } from 'framer-motion'
// import SimpleSettings from '@/components/SimpleSettings'
// import NotificationContainer from '@/components/NotificationContainer'
// import { Button } from '@/components/ui/button'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { NotificationMessage } from '@/types'
// import { Settings, Monitor } from 'lucide-react'

// const SettingsDemo: React.FC = () => {
//   const [showSettings, setShowSettings] = useState(false)
//   const [notifications, setNotifications] = useState<NotificationMessage[]>([])

//   const addNotification = (notification: Omit<NotificationMessage, 'id'>) => {
//     const id = Math.random().toString(36).substr(2, 9)
//     const newNotification = { ...notification, id }
//     setNotifications(prev => [...prev, newNotification])
//   }

//   const removeNotification = (id: string) => {
//     setNotifications(prev => prev.filter(n => n.id !== id))
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
//       <div className="container mx-auto px-4 py-8">
//         {/* Header */}
//         <div className="text-center mb-8">
//           <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
//             <Monitor className="w-8 h-8 text-white" />
//           </div>
//           <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
//             NaturalToSQL Settings
//           </h1>
//           <p className="text-gray-600 dark:text-gray-400 text-lg">
//             Comprehensive settings system demo
//           </p>
//         </div>

//         {/* Demo Cards */}
//         <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center space-x-2">
//                 <Settings className="w-5 h-5" />
//                 <span>Settings Panel</span>
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <p className="text-gray-600 dark:text-gray-400">
//                 Complete settings system with categories for appearance, editor, query behavior, 
//                 notifications, privacy, performance, and advanced options.
//               </p>
              
//               <div className="space-y-2">
//                 <h4 className="font-semibold">Features:</h4>
//                 <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
//                   <li>• Theme customization (light/dark/auto)</li>
//                   <li>• Accent color picker with presets</li>
//                   <li>• Export/import settings</li>
//                   <li>• Reset to defaults</li>
//                   <li>• Real-time validation</li>
//                   <li>• Persistence to localStorage</li>
//                 </ul>
//               </div>

//               <Button
//                 onClick={() => setShowSettings(true)}
//                 className="w-full"
//               >
//                 <Settings className="w-4 h-4 mr-2" />
//                 Open Settings
//               </Button>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle>Current Settings Preview</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-3 text-sm">
//                 <div className="flex justify-between">
//                   <span className="text-gray-600 dark:text-gray-400">Theme:</span>
//                   <span className="font-mono">Auto</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600 dark:text-gray-400">Accent Color:</span>
//                   <div className="flex items-center space-x-2">
//                     <div className="w-4 h-4 rounded bg-blue-500"></div>
//                     <span className="font-mono">#3b82f6</span>
//                   </div>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600 dark:text-gray-400">Compact Mode:</span>
//                   <span className="font-mono">false</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600 dark:text-gray-400">Animations:</span>
//                   <span className="font-mono">true</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600 dark:text-gray-400">Font Size:</span>
//                   <span className="font-mono">medium</span>
//                 </div>
//               </div>
              
//               <Button
//                 variant="outline"
//                 onClick={() => addNotification({
//                   type: 'info',
//                   title: 'Settings Updated',
//                   message: 'Your preferences have been saved automatically',
//                   duration: 3000
//                 })}
//                 className="w-full mt-4"
//               >
//                 Test Notification
//               </Button>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Features Overview */}
//         <div className="mt-12 max-w-4xl mx-auto">
//           <h2 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
//             Settings Categories
//           </h2>
          
//           <div className="grid md:grid-cols-3 gap-6">
//             {[
//               {
//                 title: 'Appearance',
//                 description: 'Theme, colors, fonts, layout preferences',
//                 icon: '🎨',
//                 items: ['Light/Dark/Auto theme', 'Custom accent colors', 'Font size & family', 'Compact mode']
//               },
//               {
//                 title: 'Editor',
//                 description: 'Code editor behavior and styling',
//                 icon: '📝',
//                 items: ['Syntax highlighting', 'Auto-completion', 'Line numbers', 'Font settings']
//               },
//               {
//                 title: 'Query Behavior',
//                 description: 'SQL generation and execution settings',
//                 icon: '🔍',
//                 items: ['Auto-generate SQL', 'Execution mode', 'Timeout settings', 'Result limits']
//               },
//               {
//                 title: 'Notifications',
//                 description: 'Toast and alert preferences',
//                 icon: '🔔',
//                 items: ['Enable/disable types', 'Position & duration', 'Sound settings', 'Desktop notifications']
//               },
//               {
//                 title: 'Privacy & Security',
//                 description: 'Data protection and security',
//                 icon: '🔒',
//                 items: ['Usage data collection', 'Error reporting', 'Auto-logout', 'Data encryption']
//               },
//               {
//                 title: 'Performance',
//                 description: 'Optimization and caching',
//                 icon: '⚡',
//                 items: ['Enable caching', 'Virtual scrolling', 'Connection pooling', 'Batch processing']
//               }
//             ].map((category, index) => (
//               <Card key={index} className="h-full">
//                 <CardHeader>
//                   <CardTitle className="flex items-center space-x-2">
//                     <span className="text-2xl">{category.icon}</span>
//                     <span>{category.title}</span>
//                   </CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <p className="text-gray-600 dark:text-gray-400 mb-4">
//                     {category.description}
//                   </p>
//                   <ul className="text-sm space-y-1">
//                     {category.items.map((item, itemIndex) => (
//                       <li key={itemIndex} className="text-gray-600 dark:text-gray-400">
//                         • {item}
//                       </li>
//                     ))}
//                   </ul>
//                 </CardContent>
//               </Card>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Settings Modal */}
//       <AnimatePresence>
//         {showSettings && (
//           <SimpleSettings
//             onClose={() => setShowSettings(false)}
//             onNotification={addNotification}
//           />
//         )}
//       </AnimatePresence>

//       {/* Notifications */}
//       <NotificationContainer
//         notifications={notifications}
//         onRemoveNotification={removeNotification}
//       />
//     </div>
//   )
// }

// export default SettingsDemo
