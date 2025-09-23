exports.isDev = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

exports.isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

exports.delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
