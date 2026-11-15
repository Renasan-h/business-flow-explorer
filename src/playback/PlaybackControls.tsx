import type { PlaybackSpeed } from './types';

const playbackSpeeds: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

/** ビューポート操作とステップ再生操作の表示を担当する。状態は親から受け取る。 */
export default function PlaybackControls({
 zoom, step, stepCount, playing, finished, speed,
 onZoomOut, onZoomIn, onResetViewport, onRestart, onPrevious, onTogglePlayback, onNext, onSpeedChange,
}: {
 zoom: number;
 step: number;
 stepCount: number;
 playing: boolean;
 finished: boolean;
 speed: PlaybackSpeed;
 onZoomOut: () => void;
 onZoomIn: () => void;
 onResetViewport: () => void;
 onRestart: () => void;
 onPrevious: () => void;
 onTogglePlayback: () => void;
 onNext: () => void;
 onSpeedChange: (speed: PlaybackSpeed) => void;
}) {
 return <div className="scene-action-bar">
  <div className="viewport-controls" role="group" aria-label="表示倍率と移動">
   <button type="button" onClick={onZoomOut} aria-label="縮小">−</button>
   <span>{Math.round(zoom * 100)}%</span>
   <button type="button" onClick={onZoomIn} aria-label="拡大">＋</button>
   <button type="button" onClick={onResetViewport}>等倍</button>
   <span className="viewport-hint">ドラッグで移動 / Ctrl + ホイールで拡大・縮小</span>
  </div>
  <div className="controls">
   <button type="button" onClick={onRestart}>↺</button>
   <button type="button" disabled={step === 0} onClick={onPrevious}>◀ 前へ</button>
   <button type="button" onClick={onTogglePlayback}>{playing ? '⏸ 一時停止' : finished ? '↺ 最初から再生' : '▶ 再生'}</button>
   <button type="button" disabled={step === stepCount - 1} onClick={onNext}>次へ ▶</button>
   <div className="playback-speed" role="group" aria-label="再生速度">
    <span className="playback-speed-label">再生速度</span>
    <div className="speed-options">
     {playbackSpeeds.map(value => <button type="button" key={value} className={speed === value ? 'selected' : ''} aria-pressed={speed === value} onClick={() => onSpeedChange(value)}>{value}x</button>)}
    </div>
   </div>
   <span>STEP {step + 1} / {stepCount}</span>
  </div>
 </div>;
}
