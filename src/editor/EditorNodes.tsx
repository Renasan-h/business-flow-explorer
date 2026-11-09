import type { Scenario } from '../scenario';
import { NodeIcon } from '../NodeIcon';

type Actor = Scenario['actors'][number];

/** SVGノードの見た目と操作ハンドル。ノード状態は親が管理する。 */
export default function EditorNodes({ actors, selectedActors, tool, source, selectedActor, nodeNumbers, onClickActor, onDeleteActor }: {
 actors: Actor[];
 selectedActors: string[];
 tool: 'move' | 'connect' | 'multi';
 source: string | null;
 selectedActor: string | null;
 nodeNumbers: Record<string, number>;
 onClickActor: (id: string) => void;
 onDeleteActor: (id: string) => void;
}) {
 const NODE_WIDTH = 150;
 const NODE_HEIGHT = 76;
 return <>

 </>;
}
