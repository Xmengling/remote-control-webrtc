<!-- 远程控制 -->
<template>
  <div class="remote-control-wrap">
    <el-dialog
      :title="'正在控制 ' + name"
      :visible.sync="inVisible"
      width="100%"
    >
      <div
        v-loading="loading"
        element-loading-background="rgba(0, 0, 0, 0.8)"
        element-loading-spinner="el-icon-loading"
        element-loading-text="连接中"
        :style="vidStyle"
        class="vid-wrap"
      >
        <video
          v-show="videoShow"
          id="remote-control"
          style="height: 100%"
          autoplay
        />
        <!-- <div id="statsdiv" style="color: white" /> -->
      </div>
    </el-dialog>
  </div>

</template>

<script>
import { SERVERS, PC_OPTIONS, OFFER_OPTIONS, SOCKET_BASE_URL } from './js/config'
import { formatStat } from './js/utils'
export default {
  name: 'RemoteControl',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    name: {
      type: String,
      default: ''
    },
    serialNumber: {
      type: String,
      default: ''
    },
    socketUrlProp: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      vidStyle: {
        width: '100%', height: (document.body.clientHeight - 53) + 'px'
      },
      inVisible: this.visible,
      socket: '',
      peer: '',
      remoteIce: [],
      videoShow: false,
      loading: true,
      localIce: [],
      channel: null,
      timer: null,
      connectTimer: null,
      remoteMsg: null,
      socketUrl: '',
      packets: 0, // 视频流包总量
      packetsCount: 0,
      isLog: false
    }
  },
  watch: {
    inVisible(val) {
      this.$emit('update:visible', val)
    }
  },
  created() {
    this.connect()
  },
  async beforeDestroy() {
    console.log('beforeDestroy')
    if (this.channel) {
      this.channel.close()
      this.channel = null
      console.log('this.channel.close()')
    }
    if (this.peer) {
      this.peer.close()
      this.peer = null
      console.log('this.peer.close()')
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
      console.log('this.socket.close()')
    }
    this.clearAllTimer()
    this.$emit('refresh')
  },
  methods: {
    // 发起链接
    async connect() {
      if (this.socketUrlProp) {
        this.socketUrl = this.socketUrlProp
      } else {
        this.socketUrl = SOCKET_BASE_URL + this.serialNumber
      }
      console.log('socket 地址', this.socketUrl)
      this.socket = new WebSocket(this.socketUrl)
      this.socket.onopen = () => {
        console.log('Socket onopen 已打开!')
        // 监听连接信息，如果一段时间没连接，创建失败
        this.disconnectTimer('远程桌面连接失败', 5 * 1000)
      }
      this.socket.onerror = (error) => {
        console.log('Socket onerror 发生了错误,请刷新页面', error)
      }
      this.socket.onclose = (error) => {
        console.log('socket onclose', error)
        // 当前设备已被其它用户连接
        this.clearAllTimer()
        if (error.reason && error.code && (error.code === 1100)) {
          this.disconnectTimer(error.reason)
        }
      }
      this.socket.onmessage = (Message) => {
        const obj = JSON.parse(Message.data)
        console.log('receive socket msg', Message)
        const command = obj.command
        let data = null
        switch (command) {
          case 'OnSuccessAnswer':
            if (this.peer) {
              // console.log('OnSuccessAnswer[remote]: ' + obj.sdp)
              this.remoteAnswer = obj.sdp
              console.log('OnSuccessAnswer[remote]: ', this.remoteAnswer)
              this.peer.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: this.remoteAnswer }),
                function() { },
                (errorInformation) => {
                  console.log('setRemoteDescription error: ' + errorInformation)
                  this.socket.close()
                })
            }
            break

          case 'OnIceCandidate':
            if (this.peer) {
              // console.log('OnIceCandidate[remote]: ' + obj.sdp)
              console.log('OnIceCandidate[remote]: ')
              const c = new RTCIceCandidate({
                sdpMLineIndex: obj.sdp_mline_index,
                candidate: obj.sdp,
                sdpMid: obj.sdpMid
              })
              this.remoteIce.push(c)
              this.peer.addIceCandidate(c)
            }
            break

          case 'connected': // 链接成功
            console.log('socket onmessage connected')
            console.log(this.socketUrl + ' 链接成功!')
            this.clearAllTimer()
            this.initPeer()
            data = JSON.stringify({
              'command': 'ready'
            })
            this.send(data)
            break
          case 'ready':
            console.log('socket onmessage ready')
            this.createOffer()
            break
          case 'disconnect': // 链接断开
            console.log('socket onmessage disconnect')
            break
          default: {
            console.log(Message.data)
          }
        }
      }
    },
    // 初始化控制端实例
    initPeer() {
      // 创建输出端 PeerConnection
      console.log('-------into initpeer-------')
      if (!this.peer) {
        console.log('-------createpeer-------')
        const PeerConnection =
          window.RTCPeerConnection ||
          window.mozRTCPeerConnection ||
          window.webkitRTCPeerConnection

        this.peer = new PeerConnection(SERVERS, PC_OPTIONS)

        // 创建数据通道
        this.channel = this.peer.createDataChannel('msgdatachannel')
        console.log('createDataChannel', this.channel)

        this.channel.onopen = (event) => {
          console.log('数据通道 链接成功!')
          this.monitor()
        }
        this.channel.onclose = (event) => {
          console.log('channel onclose', event)
        }
        this.channel.onmessage = (e) => {
          const m = JSON.parse(e.data)
          console.log('channel onmessage', m)
        }
        this.peer.onclose = function(e) {
          console.log('peer onclose', e)
        }

        // 监听候选信息
        this.peer.onicecandidate = (event) => {
          console.log('----------------------', event)
          if (event.candidate) {
            const obj = JSON.stringify({
              'command': 'onicecandidate',
              'candidate': event.candidate
            })
            this.send(obj)
          }
        }

        // 监听视频流
        this.peer.onaddstream = (e) => {
          try {
            console.log('视频流 链接成功!', e)
            this.videoShow = true
            this.loading = false
            const vid2 = document.getElementById('remote-control')
            vid2.srcObject = e.stream
            vid2.onloadedmetadata = function() {
              vid2.play()
            }
            var t = setInterval(() => {
              if (!this.peer) {
                clearInterval(t)
              } else {
                Promise.all([
                  this.peer.getStats(null).then((o) => {
                    var rcv = null
                    var snd = null
                    o.forEach((s) => {
                      // console.log('---------------s------------------', s)
                      const isRemoteVideo = s.type === 'inbound-rtp' && s.mediaType === 'video' && !s.isRemote
                      const isSsrcVideo = s.type === 'ssrc' && s.mediaType === 'video'
                      if (isRemoteVideo || (isSsrcVideo && s.id.indexOf('recv') >= 0)) {
                        // console.log('---------------rcv------------------', s)
                        rcv = s
                      } else if (isRemoteVideo || (isSsrcVideo && s.id.indexOf('send') >= 0)) {
                        snd = s
                      }
                    })
                    if (!this.isLog && rcv.frameWidth) {
                      console.log('视频流分辨率', rcv.frameWidth, rcv.frameHeight)
                      this.isLog = true
                    }
                    return this.dumpStat(rcv, snd)
                  })
                ]).then((s) => {
                  // document.getElementById('statsdiv').innerHTML = '<small>' + s + '</small>'
                })
              }
            }, 100)
          } catch (ex) {
            console.log('Failed to connect to remote media!', ex)
            this.socket.close()
          }
        }
      }
    },

    createOffer() {
      // 创建offer
      if (this.peer) {
        console.log('-------createoffer-------')
        this.peer.createOffer(
          (desc) => {
            console.log('createOffer: ', desc.sdp)
            this.peer.setLocalDescription(desc, () => {
              const obj = JSON.stringify({
                'command': 'offer',
                'desc': desc
              })
              this.send(obj)
            },
            (errorInformation) => {
              console.log('setLocalDescription error: ' + errorInformation)
              this.socket.close()
            })
          },
          function(error) {
            console.log('createOffer error', error)
            this.socket.close()
          },
          OFFER_OPTIONS
        )
      }
    },

    dumpStat(o, b) {
      if (this.packets === o.packetsReceived) { // 接收视频流停止
        this.packetsCount++
      } else {
        this.packetsCount = 0
      }
      this.packets = o.packetsReceived
      if (this.packetsCount > 50) { // 约5秒未收到视频流
        console.log('5秒未收到视频流 断开链接！')
        this.inVisible = false
      }

      var s = ''
      s += formatStat(o)
      if (b !== undefined) {
        s += '<br> <br>'
        s += formatStat(b)
      }
      return s
    },
    disconnectTimer(msg, delayTime = 0) {
      if (this.connectTimer === null) {
        this.connectTimer = setTimeout(() => {
          this.inVisible = false
          this.$message.info(msg)
        }, delayTime)
      }
    },
    clearAllTimer() {
      if (this.timer != null) {
        clearTimeout(this.timer)
        this.timer = null
      }
      if (this.connectTimer != null) {
        clearTimeout(this.connectTimer)
        this.connectTimer = null
      }
    },
    send(data) {
      try {
        console.log('send socket msg', data)
        this.socket.send(data)
      } catch (ex) {
        console.log('Message sending failed!')
      }
    },
    // -------------------------------------------鼠标键盘事件处理--------------------------------------------
    monitor() {
      const div = document.getElementById('remote-control')
      let totalW = div.clientWidth
      const totalH = div.clientHeight // 884
      div.addEventListener('canplay', function() {
        console.log('videoWidth', this.videoWidth)
        console.log('videoHeight', this.videoHeight)
        totalW = totalH * (this.videoWidth / this.videoHeight)
        console.log('totalW, totalH', totalW, totalH)
      })

      document.oncontextmenu = function(ev) {
        return false // 屏蔽右键菜单
      }

      // 键盘按下
      document.addEventListener('keydown', (e) => {
        const msg = {}
        msg.event = 0
        msg.type = 5
        msg.code = e.keyCode
        this.channelSend(msg)
      })

      // 键盘松开
      document.addEventListener('keyup', (e) => {
        const msg = {}
        msg.event = 1
        msg.type = 5
        msg.code = e.keyCode
        this.channelSend(msg)
      })

      // 滚轮
      document.addEventListener('mousewheel', (e) => {
        const msg = {}
        msg.type = 4
        if (e.wheelDelta < 0) {
          msg.event = 3
        } else {
          msg.event = 2
        }
        this.channelSend(msg)
      })

      // 鼠标按下
      div.onmousedown = (e) => {
        const msg = {}
        msg.event = 0
        if (Number(e.button) === 0) { // 左键
          msg.type = 2
        } else if (Number(e.button) === 1) { // 中键
          msg.type = 4
        } else if (Number(e.button) === 2) { // 右键
          msg.type = 3
        }
        msg.x = e.offsetX / totalW
        msg.y = e.offsetY / totalH
        this.channelSend(msg)
        // 鼠标左键按下时移动
        if (Number(e.button) === 0) {
          div.onmousemove = (e) => {
            const msg = {}
            msg.type = 1
            msg.x = e.offsetX / totalW
            msg.y = e.offsetY / totalH
            this.channelSend(msg)
          }
        }
      }
      // 鼠标抬起
      div.onmouseup = (e) => {
        div.onmousemove = null // 清除移动事件
        const msg = {}
        msg.event = 1
        if (Number(e.button) === 0) { // 左键
          msg.type = 2
        } else if (Number(e.button) === 1) { // 中键
          msg.type = 4
        } else if (Number(e.button) === 2) { // 右键
          msg.type = 3
        }
        msg.x = e.offsetX / totalW
        msg.y = e.offsetY / totalH
        this.channelSend(msg)
      }
    },
    channelSend(msg) {
      if (!this.channel || this.channel.readyState !== 'open') return // 通道未建立
      this.channel.send(JSON.stringify(msg))
      console.log('send msg ===>', JSON.stringify(msg))
    }

  }
}
</script>

<style lang="scss">
.remote-control-wrap {
  .el-dialog {
    max-height: 100% !important;
    height: 100%;
    margin-top: 0vh !important;
  }
  .el-dialog__body {
    max-height: calc(100% - 53px) !important;
    padding: 0;
    background-color: #000 !important;
  }
  .el-dialog__header{
    background-color: #474646 !important;
    border-bottom: none;
    .el-dialog__title{
      color: #fff !important;
    }
    .el-dialog__headerbtn .el-dialog__close {
      color: #fff !important;
    }
  }
}
</style>
<style lang="scss" scoped>
.remote-control-wrap {
  .vid-wrap {
    display: flex;
    justify-content: center;
    font-size: 40px
  }
}
</style>
