class Speech {
  constructor(sentences, opts = {}) {
    if (!sentences || Object.keys(sentences).length === 0) {
      throw new Error('Need some sentences to say');
    }
    this.volume = opts.volume || 0.9;
    this.rate = opts.rate || 0.9;
    this.lang = opts.lang || 'en';
    this.cached = {};
    this.sentences = sentences;
    this.initialized = false;
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  init() {
    return new Promise((resolve) => {
      // Setup all sentences we need
      if (window.speechSynthesis) {
        let voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          this.setupVoice(voices);
          resolve(this);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            voices = window.speechSynthesis.getVoices();
            this.setupVoice(voices);
            resolve(this);
          };
        }
      } else {
        resolve(this);
      }
    });
  }

  setupVoice(voices) {
    const voice = voices
      .filter((v) => v.voiceURI.match(/Google/ig))
      .filter((v) => v.lang.match(this.lang))
      .sort((v) => (v.voiceURI.match(/female/i) ? -1 : 1));
    if (voice[0]) {
      this.setupSentences(voice[0]);
    }
  }

  setupSentences(voice) {
    const keys = Object.keys(this.sentences);
    for (let i = 0; i < keys.length; i++) {
      if (Array.isArray(this.sentences[keys[i]])) {
        this.cached[keys[i]] = [];
        for (let j = 0; j < this.sentences[keys[i]].length; j++) {
          const msg = new SpeechSynthesisUtterance(this.sentences[keys[i]][j]);
          msg.voice = voice; // Note: some voices don't support altering params
          msg.volume = this.volume; // 0 to 1
          msg.rate = this.rate; // 0.1 to 10
          msg.lang = this.lang;
          this.cached[keys[i]].push(msg);
        }
      } else {
        const msg = new SpeechSynthesisUtterance(this.sentences[keys[i]]);
        msg.voice = voice; // Note: some voices don't support altering params
        msg.volume = this.volume; // 0 to 1
        msg.rate = this.rate; // 0.1 to 10
        msg.lang = this.lang;
        this.cached[keys[i]] = msg;
      }
    }
    this.initialized = true;
  }

  say(code) {
    if (this.initialized && this.cached[code]) {
      if (Array.isArray(this.cached[code])) {
        window.speechSynthesis.speak(
          this.cached[code][this.getRandomInt(0, this.cached[code].length - 1)]
        );
        return;
      }
      window.speechSynthesis.speak(this.cached[code]);
    }
  }
}

module.exports = Speech;
