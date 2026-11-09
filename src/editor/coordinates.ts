/** SVGのスクリーン座標を描画領域のローカル座標に変換する。 */
export function screenToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
 const matrix = svg.getScreenCTM();
 if (!matrix) return null;
 const point = svg.createSVGPoint();
 point.x = clientX;
 point.y = clientY;
 const local = point.matrixTransform(matrix.inverse());
 return { x: local.x, y: local.y };
}

/** パンとズームを考慮して、スクリーン座標をワールド座標へ変換する。 */
export function screenToWorldPoint(
 svg: SVGSVGElement, clientX: number, clientY: number,
 offset: { x: number; y: number }, zoom: number,
): { x: number; y: number } | null {
 const local = screenToSvgPoint(svg, clientX, clientY);
 return local ? { x: (local.x - offset.x) / zoom, y: (local.y - offset.y) / zoom } : null;
}

/** ドラッグ開始点から現在点までの移動量をワールド座標で返す。 */
export function screenDragDelta(
 svg: SVGSVGElement, startX: number, startY: number,
 endX: number, endY: number, zoom: number,
): { x: number; y: number } | null {
 const start = screenToSvgPoint(svg, startX, startY);
 const end = screenToSvgPoint(svg, endX, endY);
 if (!start || !end) return null;
 return { x: (end.x - start.x) / zoom, y: (end.y - start.y) / zoom };
}
