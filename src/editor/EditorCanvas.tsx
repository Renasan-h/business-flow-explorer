import type { MouseEventHandler, ReactNode, RefObject } from 'react';

/** SVGのスクロール領域。描画とポインター操作は親から渡す。
 * 座標変換・ポインターイベントを移行する際もスクロールコンテナーを維持する。
 */
export default function EditorCanvas({ canvasRef, onContextMenu, children }: {
 canvasRef: RefObject<HTMLDivElement | null>;
 onContextMenu?: MouseEventHandler<HTMLDivElement>;
 children: ReactNode;
}) {
 return <div className="editor-canvas" ref={canvasRef} onContextMenu={onContextMenu}>{children}</div>;
}
