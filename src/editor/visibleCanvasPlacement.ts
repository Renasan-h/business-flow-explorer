import { screenToWorldPoint } from './coordinates';

/** 現在表示しているキャンバスの中心をワールド座標へ変換する。 */
export function visibleCanvasCenter(
 svg: SVGSVGElement | null,
 canvas: HTMLElement | null,
 offset: { x: number; y: number },
 zoom: number,
 fallback: { x: number; y: number },
): { x: number; y: number } {
 if (!svg || !canvas) return fallback;
 const rect = canvas.getBoundingClientRect();
 return screenToWorldPoint(svg, rect.left + rect.width / 2, rect.top + rect.height / 2, offset, zoom) ?? fallback;
}

/** 領域の全体が描画可能な範囲に収まるよう配置位置を調整する。 */
export function boundedGroupOrigin(
 center: { x: number; y: number },
 size: { width: number; height: number },
 bounds: { width: number; height: number },
): { x: number; y: number } {
 return {
  x: Math.max(0, Math.min(bounds.width - size.width, center.x - size.width / 2)),
  y: Math.max(0, Math.min(bounds.height - size.height, center.y - size.height / 2)),
 };
}
