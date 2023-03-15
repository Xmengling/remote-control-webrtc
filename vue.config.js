const path = require('path');
module.exports = {
  productionSourceMap: false,
  publicPath: './',
  outputDir: 'dist',
  assetsDir: 'assets',
  devServer: {
    port: 9000,
    open: true,
    proxy: {
      [process.env.VUE_APP_BASE_API]: {
        target: `http://meeting.intcloud.h3c.com/api`, // 测试服
        changeOrigin: true,
        pathRewrite: {
          ['^' + process.env.VUE_APP_BASE_API]: ''
        }
      }
    }
  }
}
