import axios from 'axios'
import { Message } from 'element-ui'

const successCode = [200, 70002, 20003]

const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API,
  withCredentials: true,
  timeout: 1000000
})

service.interceptors.request.use(
  async config => {
    if (!config.headers['Content-Type']) { config.headers['Content-Type'] = 'application/json;charset=UTF-8;' }
    config.headers['Authorization'] = 'you token'
    return config
  },
  error => {
    return Promise.reject(error)
  }
)
service.interceptors.response.use(
  response => {
    const res = response.data
    if (!successCode.includes(Number(res.resultCode))) {
      Message.closeAll()
      Message({
        message: res.msg,
        type: 'error',
        duration: 3000
      })
      return Promise.reject(res.resultCode + ': ' + res.msg || 'Error')
    } else {
      return res
    }
  },
  error => {
    Message({
      message: '网络异常',
      type: 'error',
      duration: 5 * 1000
    })
    return Promise.reject(error)
  }
)

export default service
