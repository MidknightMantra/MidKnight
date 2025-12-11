import { create, all } from 'mathjs';

// 1. Initialize MathJS
const math = create(all);

// 2. Security: Limit the configuration, but don't break the bot's ability to parse
math.config({
  number: 'number', // Use 'BigNumber' if you want higher precision
  precision: 14
});

// 3. Session Management (Store Memory/Ans per Chat ID)
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { memory: 0, lastAnswer: undefined });
  }
  return sessions.get(chatId);
}

export default {
  name: 'calc',

  command: {
    pattern: 'calc',
    desc: 'Scientific calculator (matrices, units, algebra)',
    category: 'tools',
    react: '🧮',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const session = getSession(chat);

      try {
        await sock.sendMessage(chat, { react: { text: '🧮', key: msg.key } });
      } catch { }

      if (!args.length) {
        return sock.sendMessage(chat, {
          text:
            `🧮 *Midknight Scientific Calculator*

*Examples:*
• .calc 5+5
• .calc sqrt(64)
• .calc sin(45 deg)
• .calc [[1,2],[3,4]] * [[2],[5]]
• .calc 5 cm to inch
• .calc Ans / 2

*Memory:*
• .calc m+ <expr>  (Add to memory)
• .calc m- <expr>  (Sub from memory)
• .calc mr         (Recall memory)
• .calc mc         (Clear memory)`
        }, { quoted: msg });
      }

      let expr = args.join(' ').trim();

      // Define the scope (variables available in the math string)
      const scope = {
        Ans: session.lastAnswer,
        M: session.memory,
        // You can add constants here like 'pi' (though mathjs has them built-in)
      };

      /* MEMORY COMMANDS */

      // Handle Memory Clear
      if (/^mc$/i.test(expr)) {
        session.memory = 0;
        return sock.sendMessage(chat, { text: '💾 *MC → Memory cleared.*' }, { quoted: msg });
      }

      // Handle Memory Recall
      if (/^mr$/i.test(expr)) {
        return sock.sendMessage(chat, { text: `💾 *MR → Memory =* ${math.format(session.memory)}` }, { quoted: msg });
      }

      // Handle Memory Add/Subtract
      // We allow expressions here too! e.g. "m+ 5*2"
      let isMemOp = false;
      let memMultiplier = 0;

      if (/^m\+/i.test(expr)) {
        isMemOp = true;
        memMultiplier = 1;
        expr = expr.replace(/^m\+/i, '').trim();
      } else if (/^m\-/i.test(expr)) {
        isMemOp = true;
        memMultiplier = -1;
        expr = expr.replace(/^m\-/i, '').trim();
      }

      /* EVALUATION */
      try {
        // Parse and Evaluate
        const node = math.parse(expr);
        const rawResult = node.evaluate(scope);

        // If it was a memory operation, update memory and return
        if (isMemOp) {
          if (typeof rawResult !== 'number') {
            throw new Error('Memory operations strictly require numbers, not matrices/units.');
          }
          session.memory += (rawResult * memMultiplier);
          return sock.sendMessage(chat, {
            text: `💾 *M${memMultiplier > 0 ? '+' : '-'} → Memory is now:* ${math.format(session.memory)}`
          }, { quoted: msg });
        }

        // Standard Calculation
        session.lastAnswer = rawResult;

        // Format the output nicely (handles Matrices, Units, BigInts)
        const formattedResult = math.format(rawResult, { precision: 14 });

        return sock.sendMessage(chat, {
          text: `🧮 *Expression:*\n\`${expr}\`\n\n✨ *Result:*\n\`${formattedResult}\``
        }, { quoted: msg });

      } catch (err) {
        return sock.sendMessage(chat, {
          text: `❌ *Error*\n${err.message}`
        }, { quoted: msg });
      }
    }
  }
};