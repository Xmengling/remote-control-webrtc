<template>
  <div id="app">
    <el-button @click="remoteShow">远程控制</el-button>
    <!-- 远程控制 -->
    <remoteControl
      v-if="remoteControlShow"
      :visible.sync="remoteControlShow"
      name="XXX"
      :serial-number="wisdomId"
    />
  </div>
</template>

<script>
import RemoteControl from './components/RemoteControl.vue'

export default {
  name: 'App',
  components: {
    RemoteControl
  },
  data() {
    return {
      remoteControlShow: false,
      wisdomId: '219801A3NB5224M00007' // 控制的设备ID
    }
  },
  methods: {
    remoteShow() {
      this.remoteControlShow = true
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
