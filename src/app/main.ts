import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.add
      .text(960, 540, 'Medievers', { fontFamily: 'serif', fontSize: '96px', color: '#e8d9b0' })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 1920,
  height: 1080,
  backgroundColor: '#2b2118',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene],
});
