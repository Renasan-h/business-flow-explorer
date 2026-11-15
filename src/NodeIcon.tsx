import type { SVGProps } from 'react';
import { iconCommands } from './nodeIconShapes';

/** ノードアイコンを固定24x24の線画で描画する。フォント依存の記号は使用しない。 */
export function NodeIcon({ type, icon, x, y, size = 24, ...props }: { type: string; icon?: string; x: number; y: number; size?: number } & SVGProps<SVGGElement>) {
 const scale = size / 24;
 return <g {...props} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`}
  fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
  {iconCommands(type, icon).map((command, index) => {
   if (command[0] === 'line') return <line key={index} x1={command[1]} y1={command[2]} x2={command[3]} y2={command[4]}/>;
   if (command[0] === 'rect') return <rect key={index} x={command[1]} y={command[2]} width={command[3]} height={command[4]} rx="1.5"/>;
   if (command[0] === 'circle') return <circle key={index} cx={command[1]} cy={command[2]} r={command[3]}/>;
   const coords = command.slice(1);
   return <polyline key={index} points={Array.from({ length: coords.length / 2 }, (_, i) => `${coords[i * 2]},${coords[i * 2 + 1]}`).join(' ')}/>;
  })}
 </g>;
}
