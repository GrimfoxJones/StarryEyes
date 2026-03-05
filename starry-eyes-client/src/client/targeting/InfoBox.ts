import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { InfoContent } from './infoContent.ts';
import { useGameStore } from '../hud/store.ts';
import type { ObjectType } from '../hud/store.ts';

const ACCENT = 0x00d4ff;
const BG_COLOR = 0x0a1628;
const BG_ALPHA = 0.85;
const BORDER_ALPHA = 0.6;
const BOX_WIDTH = 200;
const PADDING = 10;
const ROW_HEIGHT = 16;

const TITLE_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 12,
  fontWeight: 'bold',
  fill: '#00d4ff',
  letterSpacing: 1,
});

const TYPE_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 9,
  fill: '#4488aa',
  letterSpacing: 2,
});

const LABEL_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 10,
  fill: '#6688aa',
  letterSpacing: 1,
});

const VALUE_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 10,
  fill: '#aaccdd',
});

const MORE_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 10,
  fill: '#00d4ff',
  letterSpacing: 1,
});

export class InfoBox {
  readonly container = new Container();
  private bg = new Graphics();
  private border = new Graphics();
  private contentContainer = new Container();
  private moreText: Text;
  private flyToText: Text;

  private currentObjectId: string | null = null;
  private currentObjectType: ObjectType | null = null;
  private currentObjectName: string | null = null;

  constructor() {
    this.container.addChild(this.bg);
    this.container.addChild(this.border);
    this.container.addChild(this.contentContainer);

    // [Fly To] button
    this.flyToText = new Text({ text: '[Fly To]', style: MORE_STYLE });
    this.flyToText.eventMode = 'static';
    this.flyToText.cursor = 'pointer';
    this.flyToText.on('pointerdown', () => {
      if (this.currentObjectId && this.currentObjectType) {
        useGameStore.getState().showTravelDialog({
          destination: { type: 'body', bodyId: this.currentObjectId },
          targetName: this.currentObjectName ?? this.currentObjectId,
          accelerationG: 1.0,
        });
      }
    });
    this.container.addChild(this.flyToText);

    // [More →] button
    this.moreText = new Text({ text: '[More →]', style: MORE_STYLE });
    this.moreText.eventMode = 'static';
    this.moreText.cursor = 'pointer';
    this.moreText.on('pointerdown', () => {
      if (this.currentObjectId && this.currentObjectType) {
        useGameStore.getState().showModal({
          objectId: this.currentObjectId,
          objectType: this.currentObjectType,
        });
      }
    });
    this.container.addChild(this.moreText);

    this.container.visible = false;
  }

  /**
   * Update the info box content and draw at the given anchor.
   * @param anchorX/Y - where the connector line ends (top or bottom of box depending on dirY)
   * @param dirY - 1 = box below anchor, -1 = box above anchor
   * @param content - the info rows to display
   * @param objectId/objectType - for the [More →] bridge
   * @param alpha - overall alpha for fade animation
   * @param scale - scale for pop-in animation
   */
  draw(
    anchorX: number,
    anchorY: number,
    dirX: number,
    dirY: number,
    content: InfoContent,
    objectId: string,
    objectType: ObjectType,
    alpha: number,
    scale: number,
  ): void {
    this.container.visible = true;
    this.currentObjectId = objectId;
    this.currentObjectType = objectType;
    this.currentObjectName = content.title;

    // Clear previous content
    this.contentContainer.removeChildren();
    this.bg.clear();
    this.border.clear();

    // Build text rows
    let y = PADDING;

    const titleText = new Text({ text: content.title, style: TITLE_STYLE });
    titleText.x = PADDING;
    titleText.y = y;
    this.contentContainer.addChild(titleText);

    const typeText = new Text({ text: content.typeLabel, style: TYPE_STYLE });
    typeText.x = BOX_WIDTH - PADDING - typeText.width;
    typeText.y = y + 2;
    this.contentContainer.addChild(typeText);

    y += ROW_HEIGHT + 4;

    // Separator line
    const sep = new Graphics();
    sep.moveTo(PADDING, y);
    sep.lineTo(BOX_WIDTH - PADDING, y);
    sep.stroke({ width: 0.5, color: ACCENT, alpha: 0.3 });
    this.contentContainer.addChild(sep);

    y += 6;

    for (const row of content.rows) {
      const labelTxt = new Text({ text: row.label, style: LABEL_STYLE });
      labelTxt.x = PADDING;
      labelTxt.y = y;
      this.contentContainer.addChild(labelTxt);

      const valTxt = new Text({ text: row.value, style: VALUE_STYLE });
      valTxt.x = BOX_WIDTH - PADDING - valTxt.width;
      valTxt.y = y;
      this.contentContainer.addChild(valTxt);

      y += ROW_HEIGHT;
    }

    y += 4;

    // [Fly To] on the left (hidden for stars and ships)
    const canFlyTo = objectType !== 'star' && objectType !== 'ship';
    this.flyToText.visible = canFlyTo;
    if (canFlyTo) {
      this.flyToText.x = PADDING;
      this.flyToText.y = y;
    }

    // [More →] on the right
    this.moreText.x = BOX_WIDTH - PADDING - this.moreText.width;
    this.moreText.y = y;
    y += ROW_HEIGHT + 2;

    const boxHeight = y + PADDING;

    // Background
    this.bg.roundRect(0, 0, BOX_WIDTH, boxHeight, 3);
    this.bg.fill({ color: BG_COLOR, alpha: BG_ALPHA });

    // Border
    this.border.roundRect(0, 0, BOX_WIDTH, boxHeight, 3);
    this.border.stroke({ width: 1, color: ACCENT, alpha: BORDER_ALPHA });

    // Position: anchor at top-center or bottom-center of box
    const boxX = dirX > 0 ? anchorX : anchorX - BOX_WIDTH;
    const boxY = dirY > 0 ? anchorY : anchorY - boxHeight;

    this.container.x = boxX;
    this.container.y = boxY;
    this.container.alpha = alpha;
    this.container.scale.set(scale);
  }

  hide(): void {
    this.container.visible = false;
    this.contentContainer.removeChildren();
    this.bg.clear();
    this.border.clear();
  }
}
