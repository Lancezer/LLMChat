import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

apiClient.interceptors.request.use(config => {
  config.headers = config.headers || {}
  config.headers['X-App-Client'] = 'LLMChat'
  return config
})

export { apiClient }
