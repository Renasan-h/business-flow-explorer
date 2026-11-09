import type { ReactNode, RefObject } from 'react';

/** SVGのスクロール領域。描画とポインター操作は親から渡す。
 * 座標変換・ポインターイベントを移行する際もスクロールコンテナーを維持する。
 */
export default function EditorCanvas({ canvasRef, children }: {
 canvasRef: RefObject<HTMLDivElement | null>;
 children: ReactNode;
}) {
 return <div className="editor-canvas" ref={canvasRef}>{children}</div>;
}
