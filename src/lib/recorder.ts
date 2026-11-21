/** Records the composited overlay canvas (+ warning audio) to an MP4/WebM file. */
export class ClipRecorder {
  private rec?: MediaRecorder
  private chunks: Blob[] = []
  mime = ''

  static pickMime(): string {
    const options = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  }

  get recording() { return this.rec?.state === 'recording' }

  start(canvas: HTMLCanvasElement, audio?: MediaStream) {
    const stream = canvas.captureStream(30)
    audio?.getAudioTracks().forEach((t) => stream.addTrack(t))
    this.mime = ClipRecorder.pickMime()
    this.chunks = []
    this.rec = new MediaRecorder(stream, { mimeType: this.mime || undefined, videoBitsPerSecond: 8_000_000 })
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.rec.start(500)
  }

  stop(filename: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rec) return resolve('')
      this.rec.onstop = () => {
        const ext = this.mime.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(this.chunks, { type: this.mime || 'video/webm' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${filename}.${ext}`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10000)
        resolve(a.download)
      }
      this.rec.stop()
      this.rec.stream.getVideoTracks().forEach((t) => t.stop())
    })
  }
}
