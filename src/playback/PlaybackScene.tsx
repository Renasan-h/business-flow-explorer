import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { branchGroups, playbackActors, playbackSteps } from '../branchPlayback';
import { iconCommands, illustrationIconCommands } from '../nodeIconShapes';
import type { Scenario } from '../scenario';
import type { Mode, Theme, PlaybackSpeed } from './types';

const clampZoom = (value: number) => Math.max(0.35, Math.min(2.5, Math.round(value * 100) / 100));
const VIEW_WIDTH = 1100;
const VIEW_HEIGHT = 620;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 90;
// CSSでキャンバスを縮小しても文字テクスチャの輪郭を保つため、高密度でラスタライズする。
const textResolution = () => Math.min(4, Math.max(2, (window.devicePixelRatio || 1) * 2));
const palette = { technical: { bg: 0x0a1427, node: 0x17375a, border: 0x38bdf8, line: 0x2b648a, text: 0xe2f2ff }, illustration: { bg: 0xf0f5fc, node: 0xffffff, border: 0x5b83d7, line: 0x9ab6d7, text: 0x263d62 } };
/** PixiJS描画担当。Reactの状態はstateRef経由でTickerに渡し、再生中の再初期化を防ぐ。 */
export default function Scene({ scenario, step, mode, theme, playing, speed, focus, zoom, pan, onPan, onZoom, onFinished, onSelectActor }: { scenario: Scenario; step: number; mode: Mode; theme: Theme; playing: boolean; speed: PlaybackSpeed; focus: boolean; zoom: number; pan: {x:number;y:number}; onPan: (value: {x:number;y:number}) => void; onZoom: (value: number) => void; onFinished: () => void; onSelectActor: (id: string) => void }) {
 const host = useRef<HTMLDivElement>(null);
 const appRef = useRef<Application | null>(null);
 const resizeObserverRef = useRef<ResizeObserver | null>(null);
 const layerRef = useRef<Container | null>(null);
 const packetRef = useRef<Graphics | null>(null);
 const routeRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number }; duration: number; reverse?: { start: { x: number; y: number }; end: { x: number; y: number } } } | null>(null);
 const elapsedRef = useRef(0);
 const lastStepRef = useRef(step);
 const stateRef = useRef({ playing, speed, onFinished });
 const [ready, setReady] = useState(false);
 const pointerRef = useRef<{ id: number; x: number; y: number; pan: {x:number;y:number} } | null>(null);
 const selectActorRef = useRef(onSelectActor);
 selectActorRef.current = onSelectActor;
 const viewportRef = useRef({zoom, pan, onPan, onZoom});
 viewportRef.current = {zoom, pan, onPan, onZoom};
 // PixiJSキャンバス上のCtrl+ホイールは画面全体でなくフロー図のみ拡縮する。
 useEffect(() => {
  const element = host.current;
  if (!element) return;
  const wheel = (event: WheelEvent) => {
   if (!event.ctrlKey) return;
   event.preventDefault();
   const bounds = element.getBoundingClientRect();
   // レンダラーを表示領域と同じCSSピクセルサイズに保つため、座標変換は不要。
   const cx = event.clientX - bounds.left;
   const cy = event.clientY - bounds.top;
   const { zoom, pan, onZoom, onPan } = viewportRef.current;
   const next = clampZoom(zoom * Math.exp(-event.deltaY * .002));
   if (next === zoom) return;
   onPan({ x: cx - (cx - pan.x) * next / zoom, y: cy - (cy - pan.y) * next / zoom });
   onZoom(next);
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return () => element.removeEventListener('wheel', wheel);
 }, []);

 // Tickerは初回のみ登録するため、再生状態と完了処理をRefで同期する。
 stateRef.current = { playing, speed, onFinished };

 useEffect(() => {
  const hostElement = host.current;
  if (!hostElement) return;
  let cancelled = false;
  const app = new Application();
  void app.init({
   width: VIEW_WIDTH, height: VIEW_HEIGHT, background: palette.technical.bg,
   antialias: true, resolution: Math.min(3, Math.max(1, window.devicePixelRatio || 1)), autoDensity: true,
  }).then(() => {
   if (cancelled) { app.destroy(true); return; }
   hostElement.appendChild(app.canvas);
   // リサイズハンドルや画面幅変更に追従して、描画バッファ自体を拡張する。
   // CSSによる固定1100x620キャンバスの引き伸ばしは文字をぼかし、余白を生む。
   const resizeRenderer = () => {
    const width = Math.max(1, Math.round(hostElement.clientWidth));
    const height = Math.max(1, Math.round(hostElement.clientHeight));
    if (app.renderer.screen.width !== width || app.renderer.screen.height !== height) {
     app.renderer.resize(width, height);
    }
   };
   resizeRenderer();
   const resizeObserver = new ResizeObserver(resizeRenderer);
   resizeObserver.observe(hostElement);
   resizeObserverRef.current = resizeObserver;
   const layer = new Container();
   app.stage.addChild(layer);
   // ステージの座標変換のみを変更し、シナリオ描画や再生状態は維持する。
   layer.scale.set(viewportRef.current.zoom);
   layer.position.set(viewportRef.current.pan.x, viewportRef.current.pan.y);
   appRef.current = app;
   layerRef.current = layer;
   app.ticker.add(ticker => {
    const route = routeRef.current;
    const packet = packetRef.current;
    if (!route || !packet || !stateRef.current.playing) return;
    // 速度変更時も現在位置を維持し、次のフレームから倍率を反映する。
    elapsedRef.current = Math.min(elapsedRef.current + ticker.deltaMS * stateRef.current.speed, route.duration);
    // 往路終了後は明示的な復路送受信先に切り替える。
    const legDuration = route.reverse ? route.duration / 2 : route.duration;
    const returning = Boolean(route.reverse && elapsedRef.current >= legDuration);
    const leg = returning ? route.reverse! : route;
    const elapsed = returning ? elapsedRef.current - legDuration : elapsedRef.current;
    const progress = Math.min(1, elapsed / legDuration);
    const eased = progress * progress * (3 - 2 * progress);
    packet.position.set(
     leg.start.x + (leg.end.x - leg.start.x) * eased,
     leg.start.y + (leg.end.y - leg.start.y) * eased,
    );
    if (elapsedRef.current >= route.duration) {
     // 完了通知が連続して発火しないよう、次の描画更新まで停止する。
     routeRef.current = null;
     stateRef.current.onFinished();
    }
   });
   setReady(true);
  }).catch(error => console.error('PixiJS初期化エラー', error));
  return () => {
   cancelled = true;
   resizeObserverRef.current?.disconnect();
   resizeObserverRef.current = null;
   setReady(false);
   routeRef.current = null;
   packetRef.current = null;
   layerRef.current = null;
   appRef.current = null;
   if (app.renderer) app.destroy(true, { children: true });
  };
 }, []);

 useEffect(() => {
  const app = appRef.current;
  const layer = layerRef.current;
  if (!ready || !app || !layer) return;

  layer.scale.set(zoom);
  layer.position.set(pan.x, pan.y);
  // ステップが変わったときだけ再生位置を初期化し、表示モード変更では維持する。
  if (lastStepRef.current !== step) {
   elapsedRef.current = 0;
   lastStepRef.current = step;
  }
  // 表示モードと配色テーマを独立させ、どちらの組み合わせでも視認性を保つ。
  const colors = theme === 'dark' ? palette.technical : palette.illustration;
  app.renderer.background.color = colors.bg;
  layer.removeChildren().forEach(child => child.destroy({ children: true }));
  // layoutActorsが算出したワールド座標をそのまま使い、拡大縮小はステージ側で処理する。
  const actors = scenario.actors;
  const byId = new Map(actors.map(actor => [actor.id, actor]));
  const action = scenario.steps[step].actions[0];
  const start = byId.get(action.from);
  const end = byId.get(action.to);
  if (!start || !end) return;

  const label = (value: string, x: number, y: number, size = 14) => {
   const text = new Text({ text: value, resolution: textResolution(), style: new TextStyle({
    fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '600', fill: colors.text, align: 'center', wordWrap: true, wordWrapWidth: size === 12 ? NODE_WIDTH - 12 : 220, breakWords: true,
   }) });
   // サブピクセル配置によるテクスチャ補間を避ける。
   text.roundPixels = true;
   text.anchor.set(0.5);
   text.position.set(Math.round(x), Math.round(y));
   layer.addChild(text);
  };

  // 送信と受信の経路を平行に配置し、矢印で通信方向を明示する。
  const drawLane = (from: { x: number; y: number }, to: { x: number; y: number }, offset: number, color: number, alpha: number) => {
   const dx = to.x - from.x;
   const dy = to.y - from.y;
   const length = Math.hypot(dx, dy) || 1;
   const nx = -dy / length;
   const ny = dx / length;
   // ノードの矩形境界からさらに玉の半径分を空け、線上だけを移動させる。
   const radius = 12;
   const halfWidth = NODE_WIDTH / 2 + radius;
   const halfHeight = NODE_HEIGHT / 2 + radius;
   const trim = Math.min(
    length / 2,
    Math.min(
     Math.abs(dx) > 0.0001 ? halfWidth / Math.abs(dx / length) : Infinity,
     Math.abs(dy) > 0.0001 ? halfHeight / Math.abs(dy / length) : Infinity,
    ),
   );
   const sx = from.x + nx * offset + (dx / length) * trim;
   const sy = from.y + ny * offset + (dy / length) * trim;
   const ex = to.x + nx * offset - (dx / length) * trim;
   const ey = to.y + ny * offset - (dy / length) * trim;
   const line = new Graphics()
    .moveTo(sx, sy).lineTo(ex, ey)
    .stroke({ color, width: 3, alpha });
   const ux = dx / length;
   const uy = dy / length;
   const arrowX = sx + (ex - sx) * 0.65;
   const arrowY = sy + (ey - sy) * 0.65;
   line.moveTo(arrowX - ux * 9 - uy * 6, arrowY - uy * 9 + ux * 6)
    .lineTo(arrowX, arrowY)
    .lineTo(arrowX - ux * 9 + uy * 6, arrowY - uy * 9 - ux * 6)
    .stroke({ color, width: 3, alpha });
   layer.addChild(line);
   return { start: { x: sx, y: sy }, end: { x: ex, y: ey } };
  };
  // 汎用領域グループを通信線とノードの背面に描画する。
  for (const group of scenario.groups ?? []) {
   const color = Number.parseInt((group.color ?? '#2563eb').slice(1), 16);
   const background = new Graphics().roundRect(group.x, group.y, group.width, group.height, 14)
    .fill({ color, alpha: 0.09 }).roundRect(group.x, group.y, group.width, group.height, 14)
    .stroke({ color, width: 2, alpha: 0.7 });
   layer.addChild(background);
   const heading = new Text({ text: group.name, resolution: textResolution(), style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: '600', fill: color }) });
   heading.roundPixels = true;
   heading.position.set(Math.round(group.x + 14), Math.round(group.y + 10));
   layer.addChild(heading);
  }
  const sendColor = theme === 'dark' ? 0x22d3ee : 0x2563eb;
  const inactiveColor = theme === 'dark' ? 0x64748b : 0x9ca3af;

  // シナリオ全体から通信経路を収集し、未使用中の経路もグレーで表示する。
  // 有向接続を保持し、逆向きの接続が存在するときだけ2本に分ける。
  const connections = new Set<string>();
  for (const scenarioStep of scenario.steps) {
   for (const transfer of scenarioStep.actions) {
    connections.add(JSON.stringify([transfer.from, transfer.to]));
    // 双方向は通信ステップを増やさず、描画用の逆方向だけを登録する。
    if (scenarioStep.bidirectional && scenarioStep.reverseFrom && scenarioStep.reverseTo)
     connections.add(JSON.stringify([scenarioStep.reverseFrom, scenarioStep.reverseTo]));
   }
  }
  let sendRoute = { start: start.position, end: end.position };
  for (const connection of connections) {
   const [fromId, toId] = JSON.parse(connection) as [string, string];
   const fromActor = byId.get(fromId);
   const toActor = byId.get(toId);
   if (!fromActor || !toActor) continue;
   const bidirectional = connections.has(JSON.stringify([toId, fromId]));
   const active = fromId === action.from && toId === action.to;
   const laneOffset = bidirectional ? -13 : 0;
   if (active) {
    sendRoute = drawLane(fromActor.position, toActor.position, laneOffset, sendColor, 0.95);
    // 注目表示中も双方向接続の復路を残す。復路は再生ステップを増やさない。
    // 復路は後段で明示的な送受信先から描画する。
   } else if (!focus) {
    drawLane(fromActor.position, toActor.position, laneOffset, inactiveColor, 0.24);
   }
  }

  for (const actor of actors) {
   const active = actor.id === action.from || actor.id === action.to;
   const g = new Graphics()
    .roundRect(actor.position.x - NODE_WIDTH / 2, actor.position.y - NODE_HEIGHT / 2, NODE_WIDTH, NODE_HEIGHT, mode === 'illustration' ? 20 : 12)
    .fill(actor.color ? Number.parseInt(actor.color.slice(1), 16) : (active ? (theme === 'dark' ? 0x205a83 : 0xdbeafe) : colors.node))
    .stroke({ color: colors.border, width: active ? 3 : 1.5 });
   if (focus && !active) g.alpha = 0.38;
   // ノードの矩形全体を選択可能にする。表示モードに依存しない。
   g.eventMode = 'static';
   g.cursor = 'pointer';
   g.on('pointertap', () => selectActorRef.current(actor.id));
   layer.addChild(g);
   // 表示アイコンはYAMLのiconを優先し、未指定ならtypeの標準アイコンを使う。
   // SVG画面と同じベクター定義をPixiJS Graphicsで描画する。
   const glyph = new Graphics();
   const illustrated = mode === 'illustration';
   const scale = illustrated ? 1.42 : 1.3;
   // イラストモードは専用ピクトグラムとカテゴリ別のアクセント色を使う。
   const illustrationColors: Record<string, number> = {
    person: 0xf59e0b, server: 0x2563eb, database: 0x0d9488, service: 0x7c3aed,
    browser: 0x0284c7, api: 0x9333ea, cloud: 0x0891b2, network: 0x4f46e5,
    storage: 0x0f766e, queue: 0xea580c, batch: 0x7c3aed, external: 0xdb2777,
    device: 0x2563eb, document: 0x64748b, decision: 0xd97706, other: 0x475569,
   };
   const iconColor = illustrated ? (illustrationColors[actor.type] ?? 0x475569) : colors.text;
   if (illustrated) {
    const backing = new Graphics().roundRect(actor.position.x - 22, actor.position.y - 31, 44, 44, 13)
     .fill({ color: iconColor, alpha: 0.12 })
     .stroke({ color: iconColor, alpha: 0.35, width: 1.5 });
    if (focus && !active) backing.alpha = 0.38;
    layer.addChild(backing);
   }
   for (const command of (illustrated ? illustrationIconCommands(actor.type) : iconCommands(actor.type))) {
    if (command[0] === 'line') glyph.moveTo(command[1], command[2]).lineTo(command[3], command[4]);
    else if (command[0] === 'rect') glyph.roundRect(command[1], command[2], command[3], command[4], 1.5);
    else if (command[0] === 'circle') glyph.circle(command[1], command[2], command[3]);
    else {
     const coords = command.slice(1) as number[];
     glyph.moveTo(coords[0], coords[1]);
     for (let i = 2; i < coords.length; i += 2) glyph.lineTo(coords[i], coords[i + 1]);
    }
    glyph.stroke({ color: iconColor, width: illustrated ? 2.1 : 1.8, cap: 'round', join: 'round' });
   }
   glyph.scale.set(scale);
   glyph.position.set(actor.position.x - 12 * scale, actor.position.y - 9 - 12 * scale);
   if (focus && !active) glyph.alpha = 0.38;
   layer.addChild(glyph);
   label(actor.name, actor.position.x, actor.position.y + 21, 12);
   // 指定されたインスタンス名とIPアドレスをノード上部に表示する。
   const details = [actor.instanceName, actor.ip].filter(Boolean);
   if (details.length > 0) {
    label(details.join('  /  '), actor.position.x, actor.position.y - 58, 11);
   }
  }
  const packet = new Graphics().circle(0, 0, 10).fill(sendColor).stroke({ color: 0xffffff, width: 2 });
  layer.addChild(packet);
  packetRef.current = packet;
  const from = sendRoute.start;
  const to = sendRoute.end;
  const currentStep = scenario.steps[step];
  const reverseFrom = currentStep.reverseFrom ? byId.get(currentStep.reverseFrom) : undefined;
  const reverseTo = currentStep.reverseTo ? byId.get(currentStep.reverseTo) : undefined;
  const reverse = currentStep.bidirectional && reverseFrom && reverseTo
   ? drawLane(reverseFrom.position, reverseTo.position, -13, inactiveColor, focus ? 0.65 : 0.24) : undefined;
  const duration = action.durationMs * (reverse ? 2 : 1);
  routeRef.current = { start: from, end: to, duration, reverse };
  const returning = Boolean(reverse && elapsedRef.current >= action.durationMs);
  const leg = returning ? reverse! : { start: from, end: to };
  const elapsed = returning ? elapsedRef.current - action.durationMs : elapsedRef.current;
  const progress = Math.min(1, elapsed / action.durationMs);
  const eased = progress * progress * (3 - 2 * progress);
  packet.position.set(leg.start.x + (leg.end.x - leg.start.x) * eased, leg.start.y + (leg.end.y - leg.start.y) * eased);
  label(action.payload, (start.position.x + end.position.x) / 2, (start.position.y + end.position.y) / 2 - 32, 13);
 }, [scenario, step, mode, theme, focus, ready]);

 // ビューポート操作では描画オブジェクトを作り直さず、拡大率と移動量のみ更新する。
 useEffect(() => {
  const layer = layerRef.current;
  if (!layer) return;
  layer.scale.set(zoom);
  layer.position.set(pan.x, pan.y);
 }, [zoom, pan]);

 return <div className="scene" ref={host} aria-label="グラフィックシミュレーション"
  onPointerDown={event => {
   if (event.button !== 0) return;
   pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: viewportRef.current.pan };
   event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event => {
   const drag = pointerRef.current;
   if (!drag || drag.id !== event.pointerId) return;
   viewportRef.current.onPan({x: drag.pan.x + event.clientX - drag.x, y: drag.pan.y + event.clientY - drag.y});
  }}
  onPointerUp={event => { if (pointerRef.current?.id === event.pointerId) pointerRef.current = null; }}
  onPointerCancel={() => { pointerRef.current = null; }}
 />;
}
/** シナリオ読込・画面遷移・再生状態を一元管理する親コンポーネント。 */
