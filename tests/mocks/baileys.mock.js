/**
 * Mock Baileys WhatsApp socket for testing
 * Provides test implementations of commonly used Baileys methods
 */

import { vi } from 'vitest';

/**
 * Create a mock Baileys socket
 * @returns {object} Mock socket with common methods
 */
export function createMockSocket() {
  const socket = {
    // Core messaging
    sendMessage: vi.fn(async (jid, content, options = {}) => ({
      key: {
        remoteJid: jid,
        id: `TEST_${Date.now()}`,
        fromMe: true
      },
      message: content,
      messageTimestamp: Date.now()
    })),

    // Presence updates (typing, recording, etc.)
    sendPresenceUpdate: vi.fn(async (type, jid) => ({
      type,
      jid
    })),

    // Group metadata
    groupMetadata: vi.fn(async (jid) => ({
      id: jid,
      subject: 'Test Group',
      creation: Date.now(),
      owner: '1234567890@s.whatsapp.net',
      desc: 'Test group description',
      participants: [
        {
          id: '1234567890@s.whatsapp.net',
          admin: 'superadmin',
          isAdmin: true,
          isSuperAdmin: true
        },
        {
          id: '9876543210@s.whatsapp.net',
          admin: null,
          isAdmin: false,
          isSuperAdmin: false
        }
      ]
    })),

    // Group participant updates (add, remove, promote, demote)
    groupParticipantsUpdate: vi.fn(async (jid, participants, action) => ({
      jid,
      participants,
      action,
      status: '200'
    })),

    // Group settings update (announcement, locked, etc.)
    groupSettingUpdate: vi.fn(async (jid, setting) => ({
      jid,
      setting
    })),

    // Group subject update
    groupUpdateSubject: vi.fn(async (jid, subject) => ({
      jid,
      subject
    })),

    // Group description update
    groupUpdateDescription: vi.fn(async (jid, description) => ({
      jid,
      description
    })),

    // Profile picture
    profilePictureUrl: vi.fn(async (jid, type = 'image') => {
      return 'https://example.com/profile.jpg';
    }),

    // User presence (online, offline)
    presenceSubscribe: vi.fn(async (jid) => ({
      jid
    })),

    // User info
    onWhatsApp: vi.fn(async (jid) => [{
      exists: true,
      jid: jid
    }]),

    // Download media
    downloadMediaMessage: vi.fn(async (message) => {
      return Buffer.from('mock media content');
    }),

    // Connection state
    user: {
      id: '1111111111@s.whatsapp.net',
      name: 'MidknightTest'
    },

    // Event emitter (for listening to events)
    ev: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn()
    },

    // Logout
    logout: vi.fn(async () => {}),

    // End connection
    end: vi.fn(async () => {}),

    // Read messages
    readMessages: vi.fn(async (keys) => ({
      keys
    }))
  };

  return socket;
}

/**
 * Create a mock message object
 * @param {object} options - Message options
 * @returns {object} Mock message
 */
export function createMockMessage(options = {}) {
  const {
    text = '',
    from = '1234567890@s.whatsapp.net',
    chat = '1234567890@s.whatsapp.net',
    isGroup = false,
    quoted = null,
    sender = from,
    messageId = `TEST_MSG_${Date.now()}`,
    fromMe = false
  } = options;

  const message = {
    key: {
      remoteJid: chat,
      fromMe,
      id: messageId,
      participant: isGroup ? sender : undefined
    },
    message: {},
    messageTimestamp: Math.floor(Date.now() / 1000)
  };

  // Add message content based on type
  if (text) {
    message.message.conversation = text;
  }

  if (quoted) {
    message.message.extendedTextMessage = {
      text,
      contextInfo: {
        quotedMessage: quoted.message,
        participant: quoted.key.participant || quoted.key.remoteJid,
        stanzaId: quoted.key.id
      }
    };
  }

  return message;
}

/**
 * Create a mock image message
 * @param {object} options - Message options
 * @returns {object} Mock image message
 */
export function createMockImageMessage(options = {}) {
  const {
    caption = '',
    from = '1234567890@s.whatsapp.net',
    chat = '1234567890@s.whatsapp.net',
    isGroup = false
  } = options;

  const message = createMockMessage({ from, chat, isGroup });
  message.message = {
    imageMessage: {
      caption,
      url: 'https://example.com/image.jpg',
      mimetype: 'image/jpeg',
      fileSha256: Buffer.from('mock'),
      fileLength: 12345
    }
  };

  return message;
}

/**
 * Create a mock group update event
 * @param {object} options - Update options
 * @returns {object} Mock group update
 */
export function createMockGroupUpdate(options = {}) {
  const {
    jid = '1234567890@g.us',
    participants = ['9876543210@s.whatsapp.net'],
    action = 'add'
  } = options;

  return {
    id: jid,
    participants,
    action,
    author: '1234567890@s.whatsapp.net'
  };
}

/**
 * Create a mock command message (with prefix)
 * @param {string} command - Command without prefix
 * @param {string} args - Command arguments
 * @param {object} options - Additional message options
 * @returns {object} Mock message
 */
export function createMockCommandMessage(command, args = '', options = {}) {
  const prefix = options.prefix || '.';
  const text = args ? `${prefix}${command} ${args}` : `${prefix}${command}`;
  return createMockMessage({ ...options, text });
}

export default {
  createMockSocket,
  createMockMessage,
  createMockImageMessage,
  createMockGroupUpdate,
  createMockCommandMessage
};
