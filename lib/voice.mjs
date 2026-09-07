// Character speech is paused by the owner. Existing provider configuration is preserved.
export function voiceStatus() {
  return { chen:false, zhao:false, provider:'MiniMax', samples:false, paused:true };
}
export function createVoiceHandler() {
  const handler=async()=>Response.json({error:'角色语音已暂停，稍后再调整。',paused:true},{status:503});
  handler.preview=handler;
  return handler;
}
