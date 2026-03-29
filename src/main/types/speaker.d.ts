declare module 'speaker' {
  interface SpeakerOptions {
    channels?: number
    bitDepth?: number
    sampleRate?: number
    signed?: boolean
  }

  class Speaker extends NodeJS.WritableStream {
    constructor(options?: SpeakerOptions)
    end(): this
    destroy(): this
  }

  export = Speaker
}
