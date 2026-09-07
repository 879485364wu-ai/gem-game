let context: AudioContext | null = null;
export function audioContext() {
  if (!context) {
    const Audio = window.AudioContext || (window as any).webkitAudioContext;
    if (!Audio) throw new Error('这个浏览器暂不支持音频播放。');
    context = new Audio();
  }
  return context!;
}
export function unlockAudio() {
  try { void audioContext().resume().catch(() => {}); } catch {}
}
