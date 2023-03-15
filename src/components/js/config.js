export const SERVERS = {
  iceServers: [
    { url: 'stun:203.135.97.160:3478' },
    { url: 'turn:203.135.97.160:3478', username: 'crh', credential: '123456' }
  ]
  // iceServers: [
  //   { urls: 'stun:dss-coturn.cvte.com:3478' },
  //   { urls: 'turn:dss-coturn.cvte.com:3478', username: 'test', credential: '123456' }
  // ]
}

export const PC_OPTIONS = {
  optional: [
    { DtlsSrtpKeyAgreement: true }
  ]
}

export const OFFER_OPTIONS = {
  offerToReceiveAudio: 0,
  offerToReceiveVideo: 1,
  voiceActivityDetection: false,
  iceRestart: true
}

export const SOCKET_BASE_URL = 'ws://websocket-dev.intcloud.h3c.com/websocket/starter/'
