/**
 * Text-to-Speech Function for Japanese Learning
 * Uses Web Speech API with ja-JP language
 * Fixed version - no timeout issues
 */

const synth = window.speechSynthesis;
let currentUtterance = null;
let isSpeaking = false;

/**
 * Clean Japanese text - remove furigana in parentheses
 * @param {string} text - Japanese text with optional furigana
 * @returns {string} Clean text without parentheses
 */
function cleanJapaneseText(text) {
  if (!text) return "";
  // Remove everything in parentheses: 渇く（かわく） → 渇く
  return text.replace(/[（(].*?[）)]/g, "").trim();
}

/**
 * Speaks Japanese text using Web Speech API
 * @param {string} text - Japanese text to speak
 * @param {number} rate - Speech rate (0.5 - 2.0), default 0.85
 */
function speakJapanese(text, rate = 0.85) {
  const cleanText = cleanJapaneseText(text);

  if (!cleanText) return;

  try {
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }
    setTimeout(() => {
      currentUtterance = new SpeechSynthesisUtterance(cleanText);

      currentUtterance.lang = "ja-JP";
      currentUtterance.rate = rate;
      currentUtterance.pitch = 1;
      currentUtterance.volume = 1;

      const voices = synth.getVoices();

      const googleVoice = voices.find(
        (v) => v.lang === "ja-JP" && v.name.includes("Google"),
      );

      const jpVoice = voices.find((v) => v.lang === "ja-JP");

      if (googleVoice) {
        currentUtterance.voice = googleVoice;
      } else if (jpVoice) {
        currentUtterance.voice = jpVoice;
      }

      currentUtterance.onstart = () => {
        isSpeaking = true;
        console.log("🔊 Speaking:", cleanText);
      };

      currentUtterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
      };

      currentUtterance.onerror = (e) => {
        if (e.error !== "interrupted") {
          console.error("TTS error:", e.error);
        }
        isSpeaking = false;
        currentUtterance = null;
      };

      synth.speak(currentUtterance);
    }, 500);
  } catch (err) {
    console.error("TTS Error:", err);
  }
}

/**
 * Stop current speech immediately
 */
function stopSpeech() {
  if (synth.speaking) {
    synth.cancel();
  }
  isSpeaking = false;
  currentUtterance = null;
}

/**
 * Check if currently speaking
 */
function isTTSSpeaking() {
  return isSpeaking;
}

/**
 * Initialize voices (call this on page load)
 */
function initTTS() {
  // Load voices
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = () => {
      const voices = synth.getVoices();
      const japaneseVoices = voices.filter((v) => v.lang === "ja-JP");
      console.log(
        `✓ TTS Ready: ${japaneseVoices.length} Japanese voices available`,
      );
    };
  }

  // Trigger voice loading
  synth.getVoices();
}

// Auto-initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTTS);
} else {
  initTTS();
}
