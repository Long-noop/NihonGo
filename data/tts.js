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
 * Extract only Japanese text from example (remove Vietnamese translation)
 * @param {string} text - Full example text with Japanese and Vietnamese
 * @returns {string} Only Japanese part
 */
function extractJapaneseOnly(text) {
  if (!text) return "";

  // Remove HTML tags first
  let cleanText = text.replace(/<br\s*\/?>/gi, "\n");
  cleanText = cleanText.replace(/<[^>]*>/g, "");

  // Split by newline and take only first part (Japanese)
  const lines = cleanText.split("\n");
  if (lines.length > 0) {
    let japanesePart = lines[0].trim();

    // Remove Vietnamese in parentheses at the end: "text (Vietnamese)" → "text"
    japanesePart = japanesePart.replace(/\s*[（(].*?[）)]\s*$/g, "");

    // Clean furigana within the Japanese text
    japanesePart = cleanJapaneseText(japanesePart);

    return japanesePart;
  }

  return cleanJapaneseText(text);
}

/**
 * Speaks Japanese text using Web Speech API
 * @param {string} text - Japanese text to speak
 * @param {number} rate - Speech rate (0.5 - 2.0), default 0.85
 */
function speakJapanese(text, rate = 0.85) {
  // Clean and validate text
  const cleanText = cleanJapaneseText(text);

  if (!cleanText || cleanText.trim() === "") {
    console.warn("TTS: Empty text provided");
    return;
  }

  // Stop any ongoing speech IMMEDIATELY
  stopSpeech();

  // Wait a tiny bit for cleanup
  setTimeout(() => {
    try {
      // Create new utterance
      currentUtterance = new SpeechSynthesisUtterance(cleanText);

      // Set properties
      currentUtterance.lang = "ja-JP";
      currentUtterance.rate = rate;
      currentUtterance.pitch = 1.0;
      currentUtterance.volume = 1.0;

      // Get voices
      const voices = synth.getVoices();

      // Try to find best Japanese voice
      const googleVoice = voices.find(
        (v) => v.lang === "ja-JP" && v.name.includes("Google"),
      );
      const japaneseVoice = voices.find((v) => v.lang === "ja-JP");

      if (googleVoice) {
        currentUtterance.voice = googleVoice;
      } else if (japaneseVoice) {
        currentUtterance.voice = japaneseVoice;
      }

      // Event handlers
      currentUtterance.onstart = () => {
        isSpeaking = true;
        console.log("🔊 Speaking:", cleanText.substring(0, 50));
      };

      currentUtterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        console.log("✓ Speech ended");
      };

      currentUtterance.onerror = (event) => {
        // Only log real errors, not "interrupted"
        if (event.error !== "interrupted" && event.error !== "cancelled") {
          console.error("❌ Speech error:", event.error);
        }
        isSpeaking = false;
        currentUtterance = null;
      };

      // Speak
      isSpeaking = true;
      synth.speak(currentUtterance);
    } catch (error) {
      console.error("TTS Error:", error);
      isSpeaking = false;
    }
  }, 50); // Very short delay for stability
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
