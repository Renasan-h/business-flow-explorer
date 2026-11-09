import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

type Offset = { x: number; y: number };

/**
 * 編集SVG上のCtrl+ホイール拡縮を管理する。
 * SVGの再マウント（プレビューからの復帰）時にもリスナーを登録し直す。
 */
export function useEditorWheelZoom({
 svgRef, zoom, setZoom, setOffset, preview,
}: {
 svgRef: RefObject<SVGSVGElement | null>;
 zoom: number;
 setZoom: Dispatch<SetStateAction<number>>;
 setOffset: Dispatch<SetStateAction<Offset>>;
 preview: boolean;
}): void {
 useEffect(() => {
  const element = svgRef.current;
  if (!element || preview) return;

  const handleWheel = (event: WheelEvent) => {
   if (!event.ctrlKey) return;
   event.preventDefault();

   const matrix = element.getScreenCTM();
   if (!matrix) return;
   const point = element.createSVGPoint();
   point.x = event.clientX;
   point.y = event.clientY;
   const local = point.matrixTransform(matrix.inverse());
   const next = Math.max(.3, Math.min(2.5, +(zoom * Math.exp(-event.deltaY * .002)).toFixed(3)));
   if (next === zoom) return;

   // ポインター直下の座標を保つため、倍率変更と同時にパンを補正する。
   setOffset(current => ({
    x: local.x - (local.x - current.x) * next / zoom,
    y: local.y - (local.y - current.y) * next / zoom,
   }));
   setZoom(next);
  };

  element.addEventListener('wheel', handleWheel, { passive: false });
  return () => element.removeEventListener('wheel', handleWheel);
 }, [svgRef, zoom, setZoom, setOffset, preview]);
}
