import axios from 'axios';

/* ---------------------------------------------------
   FALLBACK LISTS (when API is down)
--------------------------------------------------- */
const TRUTHS = [
    "What's the biggest lie you've ever told?",
    "What's your biggest fear?",
    "What's the most embarrassing thing you've done?",
    "Have you ever cheated on a test?",
    "What's your biggest secret?",
    "Who was your first crush?",
    "What's the worst thing you've said about a friend?",
    "Have you ever lied to your parents?",
    "What's something you've never told anyone?",
    "What's your most embarrassing moment?",
    "Have you ever stolen anything?",
    "What's the meanest thing you've done?",
    "Who do you have a crush on right now?",
    "What's your biggest regret?",
    "Have you ever broken someone's heart?",
    "What's the last lie you told?",
    "What's something you're glad your parents don't know?",
    "Have you ever betrayed a friend?",
    "What's your worst habit?",
    "What's the most childish thing you still do?",
    "Have you ever had a crush on a teacher?",
    "What's the most trouble you've ever been in?",
    "Have you ever gossiped about a friend?",
    "What's your biggest insecurity?",
    "Have you ever faked being sick?",
    "What's the most embarrassing thing in your search history?",
    "Have you ever cried because of someone?",
    "What's something you pretend to hate but actually love?",
    "Have you ever snooped through someone's phone?",
    "What's the worst date you've ever been on?",
    "Have you ever ghosted someone?",
    "What's your guilty pleasure?",
    "Have you ever had feelings for your best friend?",
    "What's the craziest dream you've had?",
    "Have you ever lied about your age?",
    "What's something you've done that you hope no one finds out?",
    "Have you ever been jealous of a friend?",
    "What's the most embarrassing photo on your phone?",
    "Have you ever spread a rumor?",
    "What's your biggest pet peeve?",
    "Have you ever pretended to like a gift you hated?",
    "What's the most awkward conversation you've had?",
    "Have you ever stalked someone on social media?",
    "What's something you've lied about on social media?",
    "Have you ever been caught doing something you shouldn't?",
    "What's the worst thing you've done out of spite?",
    "Have you ever read someone's diary or messages?",
    "What's your most irrational fear?",
    "Have you ever had a crush on a friend's partner?",
    "What's the longest you've gone without showering?",
    "Have you ever accidentally sent a message to the wrong person?",
    "What's the worst thing you've said to someone?",
    "Have you ever lied to get out of trouble?",
    "What's something you're bad at but pretend to be good at?",
    "Have you ever been in love?",
    "What's the most embarrassing thing you've done in front of a crush?",
    "Have you ever two-timed someone?",
    "What's the weirdest thing you've done when alone?",
    "Have you ever blamed someone else for something you did?",
    "What's your most embarrassing childhood memory?",
    "Have you ever lied on your resume or school application?",
    "What's something you judge others for but do yourself?",
    "Have you ever had a paranormal experience?",
    "What's the worst lie someone told you?",
    "Have you ever faked an injury or illness for attention?",
    "What's something you've never admitted out loud?",
    "Have you ever had a wardrobe malfunction?",
    "What's the most expensive thing you've broken?",
    "Have you ever eavesdropped on a conversation?",
    "What's your biggest failure?",
    "Have you ever pretended not to see someone to avoid talking?",
    "What's the worst advice you've ever given?",
    "Have you ever drunk texted or called someone?",
    "What's something illegal you've done?",
    "Have you ever had a crush on someone much older or younger?",
    "What's the most cringeworthy thing you've posted online?",
    "Have you ever laughed at someone's misfortune?",
    "What's something you've stolen from a friend or family?",
    "Have you ever lied about where you were?",
    "What's the worst nickname you've had?",
    "Have you ever been rejected?",
    "What's something you do that would surprise people?",
    "Have you ever regifted something?",
    "What's the most desperate thing you've done for attention?",
    "Have you ever pretended to be someone else online?",
    "What's your most unpopular opinion?",
    "Have you ever been in a physical fight?",
    "What's something you've done that you're ashamed of?",
    "Have you ever lied about having plans to avoid someone?",
    "What's the worst thing you've done while drunk?",
    "Have you ever had feelings for two people at once?",
    "What's something you've kept from your best friend?",
    "Have you ever revenge-flirted with someone?",
    "What's the biggest mistake you've made?",
    "Have you ever been catfished?",
    "What's something you wish you could undo?",
    "Have you ever manipulated someone?",
    "What's the worst thing about your personality?",
    "Have you ever made someone cry on purpose?"
];

const DARES = [
    "Send a voice message singing your favorite song",
    "Change your profile picture to a funny selfie",
    "Text your crush 'I like you'",
    "Send an embarrassing photo of yourself",
    "Do 20 push-ups and send proof",
    "Call someone and sing happy birthday",
    "Post an embarrassing status for 1 hour",
    "Send a message to your ex",
    "Change your name to something silly for 24 hours",
    "Send a voice message in a funny accent",
    "Dance for 1 minute and send a video",
    "Let someone else send a message from your phone",
    "Send a screenshot of your search history",
    "Call your parents and tell them a joke",
    "Send a message to your group saying you love them",
    "Do 30 jumping jacks",
    "Send a message in all CAPS for the next hour",
    "Share your most embarrassing photo",
    "Let someone go through your gallery",
    "Say something nice about everyone in the chat",
    "Send a voice message confessing a secret",
    "Text a random contact 'I miss you'",
    "Do your best celebrity impression in a voice note",
    "Send a selfie making the weirdest face possible",
    "Let the group choose your status for 24 hours",
    "Send a photo of your current view",
    "Speak in rhymes for the next 5 messages",
    "Send a video of you doing a cartwheel or handstand",
    "Let someone send a message to your crush",
    "Post a photo with no filter and no edits",
    "Send a voice note saying 'I love you' dramatically",
    "Do 50 squats",
    "Send a message to 3 random contacts asking 'why?'",
    "Change your status to something embarrassing",
    "Send a photo of your messiest room",
    "Tell a joke in a voice message",
    "Send a screenshot of your last 5 conversations",
    "Do the moonwalk and send a video",
    "Send a voice message in a baby voice",
    "Let the group pick your profile picture for a day",
    "Text someone 'we need to talk' then don't reply for 10 minutes",
    "Send an ugly selfie to your story",
    "Do an impression of someone in the group",
    "Send a voice message rapping",
    "Call a friend and speak in a different language",
    "Send a photo with someone famous (or pretend)",
    "Do 10 burpees",
    "Send a message backwards (reverse message)",
    "Let someone write your bio for 24 hours",
    "Send a video of you laughing for 30 seconds straight",
    "Text your mom/dad 'I have something to tell you...'",
    "Send a photo of what you're wearing right now",
    "Do the chicken dance and send a video",
    "Send a voice message screaming",
    "Text 5 people 'I know what you did'",
    "Send a selfie with something weird on your head",
    "Do 20 sit-ups",
    "Send a voice message singing the national anthem",
    "Let the group vote on who you should text",
    "Send a photo of the last thing you ate",
    "Do a plank for 1 minute",
    "Send a message proposing to someone random",
    "Send a voice message beatboxing",
    "Text someone 'sorry about last night'",
    "Send a photo of your shoes",
    "Do 15 lunges on each leg",
    "Send a voice message telling a scary story",
    "Text a friend asking them to borrow money",
    "Send a selfie with your pet (or stuffed animal)",
    "Do a fashion show and send a video",
    "Send a message in a different alphabet",
    "Text someone 'can you keep a secret?'",
    "Send a photo making a fish face",
    "Do the worm and send a video",
    "Send a voice message as a newscaster",
    "Text 'I'm thinking about you' to someone random",
    "Send a photo of your fridge contents",
    "Do 25 jumping jacks",
    "Send a voice message yodeling",
    "Let someone post on your story",
    "Send a selfie with no makeup/bedhead",
    "Do the robot dance and send a video",
    "Send a message declaring your love for pizza",
    "Text someone 'I saw you today'",
    "Send a photo of your workspace/desk",
    "Do a tongue twister voice message",
    "Text your sibling something weird",
    "Send a video of you doing a silly walk",
    "Send a voice message as a pirate",
    "Text someone asking for relationship advice",
    "Send a photo making a peace sign",
    "Do 30 high knees",
    "Send a voice message as a robot",
    "Let someone rename you in a group chat",
    "Send a selfie with the worst filter",
    "Do a split (or attempt) and send a video",
    "Send a message pretending you're from the future",
    "Text someone 'it's time'",
    "Send a photo of your reflection",
    "Do 20 mountain climbers"
];


/* ---------------------------------------------------
   API: GiftedTech Truth/Dare Endpoints
--------------------------------------------------- */
async function getGiftedGame(type) {
    try {
        const r = await axios.get(`https://api.giftedtech.co.ke/api/fun/${type}?apikey=gifted`, { timeout: 8000 });
        return r.data?.result || r.data?.message || r.data?.truth || r.data?.dare || null;
    } catch {
        return null;
    }
}

function getFallback(type) {
    if (type === 'truth') {
        return TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
    } else {
        return DARES[Math.floor(Math.random() * DARES.length)];
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'truth_dare',
    alias: ['truth', 'dare', 'td', 'tod'],

    command: {
        pattern: 'truth_dare',
        desc: 'Play Truth or Dare',
        category: 'fun',
        react: '🎲',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Determine command based on what triggered it or args
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            let cmd = textContent.split(' ')[0].slice(1).toLowerCase();

            // Handle alias .td or .tod
            if (cmd === 'td' || cmd === 'tod') {
                if (!args[0]) {
                    return sock.sendMessage(chat, { text: '🎲 *Usage:* `.truth` or `.dare`' }, { quoted: msg });
                }
                cmd = args[0].toLowerCase();
            }

            let endpoint = '';
            let title = '';
            let footer = '';
            let emoji = '';

            switch (cmd) {
                case 'truth':
                case 't':
                    endpoint = 'truth';
                    title = 'MIDKNIGHT TRUTH';
                    footer = 'The truth shall set you free.';
                    emoji = '🤥';
                    break;
                case 'dare':
                case 'd':
                    endpoint = 'dares'; // API endpoint is plural 'dares' based on user request
                    title = 'MIDKNIGHT DARE';
                    footer = 'Do you have the guts?';
                    emoji = '🔥';
                    break;
                default:
                    return sock.sendMessage(chat, { text: '🎲 *Usage:* `.truth` or `.dare`' }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: emoji, key: msg.key } }); } catch { }

            let result = await getGiftedGame(endpoint);

            // Use fallback if API fails
            if (!result) {
                result = getFallback(cmd === 'truth' || cmd === 't' ? 'truth' : 'dare');
            }

            return sock.sendMessage(
                chat,
                {
                    text: `╭━━━『 ${emoji} ${title} 』━━━╮
┃
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“${footer}”_`
                },
                { quoted: msg }
            );
        },
    },
};
