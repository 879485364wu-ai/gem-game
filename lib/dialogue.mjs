export function spokenDialogue(message) {
  if (!message || !['chen','zhao'].includes(message.speaker)) return '';
  if (message.source === 'model' && message.reply?.dialogue) return message.reply.dialogue.trim();
  if (['model','opening'].includes(message.source)) {
    const last = (message.text || '').trim().split('\n').at(-1).trim();
    return /^[“「"]/.test(last) ? last.replace(/^[“「"]|[”」"]$/g, '').trim() : '';
  }
  if (message.source === 'player') {
    const text = (message.text || '').trim();
    const quotes = [...text.matchAll(/“([^”]+)”|「([^」]+)」|"([^"\n]+)"/g)];
    if (quotes.length) return quotes.map(m => m[1] || m[2] || m[3]).join(' ');
    return text.replace(/（[^）]*）|\([^)]*\)|\*[^*]*\*/g, '').trim();
  }
  if (message.source === 'action' && ['promise','withdraw'].includes(message.action)) return (message.text || '').match(/“([^”]+)”/)?.[1] || '';
  return '';
}
