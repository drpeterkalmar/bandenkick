// Ton: aus (Nacht 2e, Peter 03.10.: „Lösch mal alle Sounds, es brutzelt noch immer ab Spielstart“).
// Stummer Stub mit derselben Schnittstelle wie bis Nacht 2d, damit alle Aufrufer weiterlaufen: kein AudioContext,
// keine vorgerenderten Puffer, keine Umgebungsschleife, keine Effekte, kein navigator.audioSession.
// Wiedereinbau nur auf ausdrücklichen Wunsch (Synthese-Code in der Git-Geschichte, Stand d20ab10).
export class Sound {
  constructor() { this.on = false; this.ctx = null; this.rendered = false; this.silent = true; }
  async init() {}
  unlock() {}
  toggle() {}
  startAmbience() {}
  play() {}
  event() {}
  shout() {}
  tick() {}
}
