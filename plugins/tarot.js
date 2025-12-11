const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* -------------------------------------------------------
   🎴 MAJOR ARCANA DATA
--------------------------------------------------------*/
const TAROT = [
  { name: 'The Fool', emoji: '🤡', upright: 'New beginnings, innocence, a leap of faith.', reversed: 'Recklessness, risk-taking, naivety.' },
  { name: 'The Magician', emoji: '🪄', upright: 'Manifestation, resourcefulness, power.', reversed: 'Manipulation, poor planning, untapped talents.' },
  { name: 'The High Priestess', emoji: '🌙', upright: 'Intuition, sacred knowledge, divine feminine.', reversed: 'Secrets, disconnected from intuition, withdrawal.' },
  { name: 'The Empress', emoji: '🤰', upright: 'Femininity, beauty, nature, nurturing.', reversed: 'Creative block, dependence to others.' },
  { name: 'The Emperor', emoji: '👑', upright: 'Authority, establishment, structure.', reversed: 'Domination, excessive control, lack of discipline.' },
  { name: 'The Hierophant', emoji: '⛪', upright: 'Spiritual wisdom, religious beliefs, conformity.', reversed: 'Personal beliefs, freedom, challenging status quo.' },
  { name: 'The Lovers', emoji: '💞', upright: 'Love, harmony, relationships, values alignment.', reversed: 'Self-love, disharmony, imbalance, misalignment.' },
  { name: 'The Chariot', emoji: '🛒', upright: 'Control, willpower, success, action.', reversed: 'Self-discipline, opposition, lack of direction.' },
  { name: 'Strength', emoji: '🦁', upright: 'Strength, courage, persuasion, influence.', reversed: 'Inner strength, self-doubt, low energy, raw emotion.' },
  { name: 'The Hermit', emoji: '🕯️', upright: 'Soul-searching, introspection, being alone.', reversed: 'Isolation, loneliness, withdrawal.' },
  { name: 'Wheel of Fortune', emoji: '🎡', upright: 'Good luck, karma, life cycles, destiny.', reversed: 'Bad luck, resistance to change, breaking cycles.' },
  { name: 'Justice', emoji: '⚖️', upright: 'Justice, fairness, truth, cause and effect.', reversed: 'Unfairness, lack of accountability, dishonesty.' },
  { name: 'The Hanged Man', emoji: '🙃', upright: 'Pause, surrender, letting go, new perspectives.', reversed: 'Delays, resistance, stalling, indecision.' },
  { name: 'Death', emoji: '💀', upright: 'Endings, change, transformation, transition.', reversed: 'Resistance to change, personal transformation, purging.' },
  { name: 'Temperance', emoji: '🧪', upright: 'Balance, moderation, patience, purpose.', reversed: 'Imbalance, excess, self-healing, re-alignment.' },
  { name: 'The Devil', emoji: '😈', upright: 'Shadow self, attachment, addiction, restriction.', reversed: 'Releasing limiting beliefs, exploring dark thoughts.' },
  { name: 'The Tower', emoji: '⚡', upright: 'Sudden change, upheaval, chaos, revelation.', reversed: 'Avoidance of disaster, fear of change.' },
  { name: 'The Star', emoji: '🌟', upright: 'Hope, faith, purpose, renewal, spirituality.', reversed: 'Lack of faith, despair, self-trust, disconnection.' },
  { name: 'The Moon', emoji: '🌑', upright: 'Illusion, fear, anxiety, subconscious, intuition.', reversed: 'Release of fear, repressed emotion, inner confusion.' },
  { name: 'The Sun', emoji: '☀️', upright: 'Positivity, fun, warmth, success, vitality.', reversed: 'Inner child, feeling down, overly optimistic.' },
  { name: 'Judgement', emoji: '📯', upright: 'Judgement, rebirth, inner calling, absolution.', reversed: 'Self-doubt, inner critic, ignoring the call.' },
  { name: 'The World', emoji: '🌍', upright: 'Completion, integration, accomplishment, travel.', reversed: 'Seeking personal closure, short-cuts, delays.' }
];

/* -------------------------------------------------------
   🎲 DRAW LOGIC
--------------------------------------------------------*/
function drawTarot() {
  const card = TAROT[Math.floor(Math.random() * TAROT.length)];
  const isReversed = Math.random() < 0.4; // 40% chance reversed

  return {
    ...card,
    isReversed,
    meaning: isReversed ? card.reversed : card.upright,
    orientation: isReversed ? 'Reversed ↩️' : 'Upright ⬆️'
  };
}

export default {
  name: 'tarot',

  command: {
    pattern: 'tarot',
    desc: 'Draw a card from the Major Arcana',
    category: 'fun',
    react: '🎴',

    run: async ({ sock, msg }) => {
      const chat = msg.key.remoteJid;

      // 1. React & Delay
      try { await sock.sendMessage(chat, { react: { text: '🎴', key: msg.key } }); } catch { }
      await delay(200, 500);

      // 2. Determine Target (Mention -> Reply -> Sender)
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = contextInfo?.mentionedJid?.[0];
      const quoted = contextInfo?.participant;
      const sender = msg.key.participant || msg.key.remoteJid;

      const targetJid = mentioned || quoted || sender;
      const isSelf = targetJid === sender;

      // 3. Draw Card
      const card = drawTarot();

      // 4. Format Text
      // We format the target name nicely
      const targetDisplay = isSelf ? 'For you' : `For @${targetJid.split('@')[0]}`;

      const caption =
        `🔮 *The Arcane Weave shifts…*

${targetDisplay}, the cards reveal:

╭───────────────╮
│  ${card.emoji} *${card.name}*
│  ${card.orientation}
╰───────────────╯

💬 *Interpretation:*
_${card.meaning}_

✨ _"Fate whispers to those who listen."_`;

      // 5. Send
      return sock.sendMessage(
        chat,
        {
          text: caption,
          mentions: [targetJid]
        },
        { quoted: msg }
      );
    }
  }
};