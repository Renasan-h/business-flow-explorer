import { useEffect, useRef, useState } from 'react';
import { parse, stringify } from 'yaml';
import { loadTemplateFragment, parseTemplateYaml, type Scenario } from './scenario';
import FlowPreview from './FlowPreview';
import EditorPanel from './editor/EditorPanel';
import PlaybackOrderPanel from './editor/PlaybackOrderPanel';
import TemplateImportDialog from './editor/TemplateImportDialog';
import InterfaceDefinitionDialog from './editor/InterfaceDefinitionDialog';
import ScenarioSettings from './editor/ScenarioSettings';
import EditorToolbar from './editor/EditorToolbar';
import GroupSettings from './editor/GroupSettings';
import { resolveEditorSelection } from './editor/selection';
import { NODE_TYPES } from './nodeCatalog';
import { NodeIcon } from './NodeIcon';
import { routeConnection, routeViaWaypoints, routePath, pointOnRoute, offsetRoute } from './connectionRouting';

type Actor = Scenario['actors'][number];
type Step = Scenario['steps'][number];
type Tool = 'move' | 'connect' | 'multi';
type FilePicker = { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (content: string) => Promise<void>; close: () => Promise<void> }> }> };

// ワールドを広げ、キャンバスのスクロールで横10ノード以上を配置可能にする。
const WIDTH = 3600;
const HEIGHT = 1800;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;

/** 編集画面は初期データをコピーして保持する。通常再生データは直接変更しない。 */
/** 編集結果を単一ファイルのシナリオとして出力し、ファイル参照の解決を不要にする。 */
export default function FlowEditor({ initial, onClose, scenarioPath }: { initial: Scenario; onClose: () => void; scenarioPath?: string }) {
 // actors:ノード、steps:通信と再生順。steps配列の並び替えが再生順の変更となる。
 const [actors, setActors] = useState<Actor[]>(() => initial.actors.map(actor => ({ ...actor, position: { ...actor.position } })));
 const [steps, setSteps] = useState<Step[]>(() => initial.steps.map(step => ({ ...step, actions: step.actions.map(action => ({ ...action })) })));
 const [metadata, setMetadata] = useState({ ...initial.metadata });
 const [groups, setGroups] = useState<NonNullable<Scenario['groups']>>(() => initial.groups ?? []);
 const [interfaces, setInterfaces] = useState<NonNullable<Scenario['interfaces']>>(() => initial.interfaces ?? []);
 const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
 const [interfacePanel, setInterfacePanel] = useState<string | null>(null);
 const [templatePath, setTemplatePath] = useState('');
 const [templateFile, setTemplateFile] = useState<File | null>(null);
 const [templateImportOpen, setTemplateImportOpen] = useState(false);
 const [templateError, setTemplateError] = useState<string | null>(null);
 const [templateReferences, setTemplateReferences] = useState<{ file: string; actorIds: string[]; stepIds: string[]; original: string }[]>([]);
 const [tool, setTool] = useState<Tool>('move');
 const [selectedActor, setSelectedActor] = useState<string | null>(null);
 const [selectedStep, setSelectedStep] = useState<string | null>(null);
 const [selectedActors, setSelectedActors] = useState<string[]>([]);
 const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
 const [orderCollapsed, setOrderCollapsed] = useState(false);
 const canvasRef = useRef<HTMLDivElement>(null);
 const marquee = useRef<{ pointerId: number; start: { x: number; y: number }; additive: boolean } | null>(null);
 const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
 const multiDrag = useRef<{ pointerId: number; x: number; y: number; initial: { id: string; x: number; y: number }[] } | null>(null);
 const [source, setSource] = useState<string | null>(null);
 // ハンドルをドラッグ中だけ仮接続線を表示し、ドロップ時に正式なステップを作成する。
 const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
 const wirePointer = useRef<number | null>(null);
 // 経由点ドラッグはノード・キャンバスのドラッグとは排他的に処理する。
 const waypointDrag = useRef<{ pointerId: number; stepId: string; index: number } | null>(null);
 const [zoom, setZoom] = useState(1);
 const [offset, setOffset] = useState({ x: 0, y: 0 });
 const [message, setMessage] = useState('');
 const [preview, setPreview] = useState(false);
 // データ変更だけを追跡し、ズームや選択操作は未保存扱いしない。
 const snapshot = () => JSON.stringify({ actors, steps, metadata, groups, interfaces, templateReferences });
 const savedSnapshot = useRef(JSON.stringify({ actors: initial.actors, steps: initial.steps, metadata: initial.metadata, groups: initial.groups ?? [], interfaces: initial.interfaces ?? [], templateReferences: [] }));
 // 保存・破棄・キャンセルを順に確認する。保存が失敗・中断された場合は編集画面に留まる。
 const requestExit = async () => {
  if (snapshot() === savedSnapshot.current) { onClose(); return; }
  if (window.confirm('未保存の変更があります。保存してから再生画面へ戻りますか？')) {
   if (await save()) onClose();
   return;
  }
  if (window.confirm('変更を保存せずに破棄して戻りますか？\nキャンセルすると編集を続けられます。')) onClose();
 };
 // 右クリックした場所に応じてメニューを切り替える。座標はエディター内のCSSピクセル。
 const [contextMenu, setContextMenu] = useState<{ x: number; y: number; actorId: string | null; stepId: string | null; groupId: string | null } | null>(null);
 const svgRef = useRef<SVGSVGElement>(null);
 // Ctrl+ホイールはブラウザ全体ではなくキャンバスだけを拡縮する。
 // passive:falseのネイティブイベントで既定のページズームを抑止する。
 useEffect(() => {
  const element = svgRef.current;
  if (!element) return;
  const wheel = (event: WheelEvent) => {
   if (!event.ctrlKey) return;
   event.preventDefault();
   // SVGの余白を含む表示変換を逆変換し、リサイズ後もポインター位置を維持する。
   const matrix = element.getScreenCTM();
   if (!matrix) return;
   const point = element.createSVGPoint();
   point.x = event.clientX; point.y = event.clientY;
   const local = point.matrixTransform(matrix.inverse());
   const cx = local.x;
   const cy = local.y;
   const next = Math.max(.3, Math.min(2.5, +(zoom * Math.exp(-event.deltaY * .002)).toFixed(3)));
   if (next === zoom) return;
   // ポインター下のワールド座標が拡縮前後で動かないようにパンを補正する。
   setOffset(current => ({ x: cx - (cx - current.x) * next / zoom, y: cy - (cy - current.y) * next / zoom }));
   setZoom(next);
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return () => element.removeEventListener('wheel', wheel);
 }, [zoom]);
 // 削除後も番号を再利用せず、編集中の識別番号を維持する。
 const nextNodeNumber = useRef(initial.actors.length + 1);
 const [nodeNumbers, setNodeNumbers] = useState<Record<string, number>>(() =>
  Object.fromEntries(initial.actors.map((actor, index) => [actor.id, index + 1])));

 const drag = useRef<{ id: number; actorId: string | null; groupId?: string; resizeGroup?: boolean; initialMembers?: { id: string; x: number; y: number }[]; initialSize?: { width: number; height: number }; x: number; y: number; initial: { x: number; y: number }; offset: { x: number; y: number } } | null>(null);
 const activeActor = actors.find(actor => actor.id === selectedActor);
 // 初期表示をワールド中央に合わせる。既存ノード座標や保存データは変更しない。
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2);
  canvas.scrollTop = Math.max(0, (canvas.scrollHeight - canvas.clientHeight) / 2);
 }, []);
 const activeStep = steps.find(step => step.id === selectedStep);

 // ポインター座標を拡大率と移動量を考慮したワールド座標へ変換する。
 const toWorld = (x: number, y: number) => {
  const svg = svgRef.current!;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = x; point.y = y;
  const local = point.matrixTransform(matrix.inverse());
  return { x: (local.x - offset.x) / zoom, y: (local.y - offset.y) / zoom };
 };
 // React stateは直接変更せず、IDが一致した要素だけを新しいオブジェクトへ置き換える。
 const changeActor = (id: string, patch: Partial<Actor>) => setActors(current => current.map(actor => actor.id === id ? { ...actor, ...patch } : actor));
 const changeStep = (id: string, patch: Partial<Step>) => setSteps(current => current.map(step => step.id === id ? { ...step, ...patch } : step));
 // 双方向に切り替えた時点で復路の既定値を確定し、片方向に戻したら復路設定を消す。
 const changeDirection = (id: string, both: boolean) => setSteps(current => current.map(step => {
  if (step.id !== id) return step;
  if (!both) { const { reverseFrom: _from, reverseTo: _to, reverseIf: _if, reversePayload: _payload, bidirectional: _both, ...oneWay } = step; return oneWay; }
  const action = step.actions[0];
  return { ...step, bidirectional: true, reverseFrom: step.reverseFrom || action?.to || '', reverseTo: step.reverseTo || action?.from || '' };
 }));
 /** 一意なIDを生成してノードを追加し、追加直後に設定欄へフォーカスする。 */
 const addActor = () => {
  const id = 'actor-' + crypto.randomUUID().slice(0, 8);
  const number = nextNodeNumber.current++;
  setNodeNumbers(current => ({ ...current, [id]: number }));
  const canvas = canvasRef.current;
  const rect = canvas?.getBoundingClientRect();
  const center = rect ? toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: WIDTH / 2, y: HEIGHT / 2 };
  const position = { x: Math.max(NODE_WIDTH / 2, Math.min(WIDTH - NODE_WIDTH / 2, center.x)), y: Math.max(NODE_HEIGHT / 2, Math.min(HEIGHT - NODE_HEIGHT / 2, center.y)) };
  setActors(current => [...current, { id, name: '新しいノード ' + number, type: 'service', position }]);
  setSelectedActor(id);
  setSelectedStep(null);
  setSelectedGroup(null);
  setTool('move');
 };
 /**
  * 選択ノードの設定値を複製する。通信ステップは複製せず、新規ノードIDを発行する。
  * 元ノードから少しずらして配置し、キャンバスの端では反対側へ配置する。
  */
 const duplicateActor = (id: string) => {
  const original = actors.find(actor => actor.id === id);
  if (!original) return;
  const existingIds = new Set(actors.map(actor => actor.id));
  let newId: string;
  do { newId = 'actor-' + crypto.randomUUID().slice(0, 8); } while (existingIds.has(newId));
  const number = nextNodeNumber.current++;
  const offsetPosition = (value: number, limit: number) =>
   value + 40 <= limit ? value + 40 : Math.max(0, value - 40);
  const copied: Actor = {
   ...original,
   id: newId,
   name: original.name + ' (コピー)',
   position: {
    x: offsetPosition(original.position.x, WIDTH - NODE_WIDTH / 2),
    y: offsetPosition(original.position.y, HEIGHT - NODE_HEIGHT / 2),
   },
   // tagsは配列なので、元ノードと参照を共有しない。
   ...(original.tags ? { tags: [...original.tags] } : {}),
  };
  setActors(current => [...current, copied]);
  setNodeNumbers(current => ({ ...current, [newId]: number }));
  setSelectedActor(newId);
  setSelectedStep(null);
  setSelectedGroup(null);
  setSource(null);
  setTool('move');
  setMessage('ノードを複製しました。通信線は引き継がれません。');
 };
 /** ノード削除は画面上の×・右クリック・設定欄で共通化する。関連通信も同時に削除する。 */
 const deleteActor = (id: string) => {
  const target = actors.find(actor => actor.id === id);
  if (!target || !window.confirm(`ノード「${target.name}」を削除しますか？\n関連する通信ステップも削除されます。`)) return;
  setActors(current => current.filter(actor => actor.id !== id));
  setSteps(current => current.filter(step => step.actions.every(action => action.from !== id && action.to !== id) && step.reverseFrom !== id && step.reverseTo !== id));
  setSelectedActor(current => current === id ? null : current);
  setSelectedStep(null);
  setSource(current => current === id ? null : current);
  setWire(null);
  setContextMenu(null);
  setMessage('ノードと関連する通信を削除しました。');
 };
 /** 再生順一覧・通信設定の双方で同じ削除処理を使用する。 */
 const deleteStep = (id: string) => {
  const target = steps.find(step => step.id === id);
  if (!target || !window.confirm(`再生ステップ「${target.title}」を削除しますか？\nこの操作は保存前の編集内容に反映されます。`)) return;
  setSteps(current => current.filter(step => step.id !== id));
  setSelectedStep(current => current === id ? null : current);
  setSelectedGroup(null);
  setDraggedStep(current => current === id ? null : current);
  setDropTarget(current => current === id ? null : current);
  setMessage('再生ステップを削除しました。');
 };
 /** 逆方向の接続が既にあれば既存通信を双方向へ切り替え、重複登録しない。 */
 const addConnection = (from: string, to: string) => {
  if (from === to) { setMessage('同じノード同士は接続できません。'); return; }
  const reverse = steps.find(step => step.actions.length === 1 &&
   step.actions[0].from === to && step.actions[0].to === from);
  if (reverse) {
   changeStep(reverse.id, { bidirectional: true, reverseFrom: from, reverseTo: to });
   setSelectedStep(reverse.id);
   setSelectedActor(null);
   setSelectedGroup(null);
   setSource(null);
   setTool('move');
   setMessage('既存の接続を双方向に変更しました。');
   return;
  }
  const existing = steps.find(step => step.actions.length === 1 &&
   step.actions[0].from === from && step.actions[0].to === to);
  if (existing) {
   setSelectedStep(existing.id);
   setSelectedActor(null);
   setSelectedGroup(null);
   setSource(null);
   setTool('move');
   setMessage('この接続は登録済みです。通信設定から双方向に変更できます。');
   return;
  }
  const id = 'connection-' + crypto.randomUUID().slice(0, 8);
  const fromActor = actors.find(actor => actor.id === from);
  const branchLabel = fromActor?.type === 'decision' ? '条件を入力' : undefined;
  setSteps(current => [...current, { id, title: '新しい通信', description: '', ...(branchLabel ? { branchLabel } : {}), actions: [{ type: 'transfer', from, to, payload: '通信内容', durationMs: 1200 }] }]);
  setSelectedStep(id);
  setSelectedActor(null);
  setSelectedGroup(null);
  setSource(null);
  setTool('move');
  setMessage('通信線を追加しました。');
 };
 const clickActor = (id: string) => {
  setContextMenu(null);
  if (tool === 'connect') {
   if (!source) setSource(id);
   else addConnection(source, id);
  } else {
   setSelectedActor(id);
   setSelectedStep(null);
   setSelectedGroup(null);
  }
 };
 /** 入力検証後にYAMLを書き出す。GitHubやシナリオ一覧の自動更新は行わない。 */
 const save = async (): Promise<boolean> => {
  setMessage('');
  if (actors.length < 2 || steps.length === 0) { setMessage('保存にはノード2件以上と通信1件以上が必要です。'); return false; }
  const ids = new Set(actors.map(actor => actor.id));
  if (ids.size !== actors.length || actors.some(actor => !actor.id.trim() || !actor.name.trim())) { setMessage('ノードIDの重複または未入力があります。'); return false; }
  if (new Set(steps.map(step => step.id)).size !== steps.length || steps.some(step => !step.id.trim() || step.actions.some(action => !ids.has(action.from) || !ids.has(action.to) || action.durationMs <= 0) || (step.bidirectional && (!step.reverseFrom || !step.reverseTo || !ids.has(step.reverseFrom) || !ids.has(step.reverseTo))))) { setMessage('通信のID・参照先・所要時間を確認してください。'); return false; }
  // グループに削除済みノードが残ると、再読込時に存在しない参照が残る。
  const validActorIds = new Set(actors.map(actor => actor.id));
  if (groups.some(group => (group.memberIds ?? []).some(id => !validActorIds.has(id)))) { setMessage('領域コンテナに存在しないノードが含まれています。所属ノードを見直してください。'); return false; }
  // file参照は編集結果を参照先へ書き戻さない。変更を黙って破棄しないよう保存を止める。
  for (const reference of templateReferences) {
   const current = JSON.stringify({ actors: actors.filter(item => reference.actorIds.includes(item.id)), steps: steps.filter(item => reference.stepIds.includes(item.id)) });
   if (current !== reference.original) { setMessage('参照テンプレートの内容が変更されています。変更を保持するには直接展開モードで再読込してください: ' + reference.file); return false; }
  }
  // アイコンはtypeから一意に決定するため、保存するYAMLには重複したiconを出力しない。
  const normalizedActors = actors.map(({ icon: _icon, ...actor }) => actor);
  // 片方向通信では復路フィールドをYAMLに一切出力しない。
 const normalizedSteps = steps.map(step => {
  if (step.bidirectional) return step;
  const { reverseFrom: _from, reverseTo: _to, reverseIf: _if, reversePayload: _payload, bidirectional: _both, ...oneWay } = step;
  return oneWay;
 });
 // 参照モードで取り込んだ要素は重複定義せずfile参照で保存する。
 const referencedActorIds = new Set(templateReferences.flatMap(item => item.actorIds));
 const referencedStepIds = new Set(templateReferences.flatMap(item => item.stepIds));
 const yamlActors = normalizedActors.filter(item => !referencedActorIds.has(item.id));
 const yamlSteps: Array<Step | { file: string }> = [];
 const inserted = new Set<string>();
 for (const item of normalizedSteps) {
  const reference = templateReferences.find(entry => entry.stepIds.includes(item.id));
  if (!reference) { yamlSteps.push(item); continue; }
  if (!inserted.has(reference.file)) { yamlSteps.push({ file: reference.file }); inserted.add(reference.file); }
 }
 for (const reference of templateReferences) if (!inserted.has(reference.file)) { yamlSteps.push({ file: reference.file }); inserted.add(reference.file); }
 const yaml = stringify({ schemaVersion: '1.0', metadata, groups, interfaces, actors: yamlActors, steps: yamlSteps }, { lineWidth: 0 });
  // 既存編集では開いているシナリオのファイル名を優先する。新規作成だけmetadata.idを使用。
  const filename = scenarioPath
   ? (decodeURIComponent(scenarioPath.split('/').pop() ?? '') || 'scenario.yaml')
   : (metadata.id.replace(/[^a-zA-Z0-9_-]/g, '-') || 'scenario') + '.yaml';
  try {
   const picker = (window as Window & FilePicker).showSaveFilePicker;
   if (picker) {
    const handle = await picker({ suggestedName: filename, types: [{ description: 'YAML scenario', accept: { 'application/x-yaml': ['.yaml', '.yml'] } }] });
    const writable = await handle.createWritable();
    await writable.write(yaml);
    await writable.close();
    setMessage('YAMLを保存しました。Web上の元シナリオは自動更新されません。');
   } else {
    // 保存ダイアログ非対応ブラウザでは通常のダウンロードを利用する。
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/x-yaml' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('YAMLをダウンロードしました。元シナリオの更新にはファイルの差し替えが必要です。');
   }
   savedSnapshot.current = snapshot();
   return true;
  } catch (error) {
   if (error instanceof Error && error.name === 'AbortError') return false;
   setMessage('保存できませんでした: ' + String(error));
   return false;
  }
 };
 const [showLines, setShowLines] = useState(true);
 const importTemplate = async (mode: 'inline' | 'reference') => {
  setTemplateError(null);
  try {
   // ファイルダイアログはブラウザの安全制約により絶対パスを公開しない。
   // 直接読込は選択ファイルの内容を利用し、参照読込は公開ディレクトリ内のパスが必須。
   const path = templatePath.trim();
   if (!templateFile && !path) throw new Error('YAMLファイルを選択するか、ファイルパスを指定してください');
   if (mode === 'reference' && !path) throw new Error('サブシナリオ参照には /scenarios/ 内の相対パスが必要です。ファイルダイアログからはパスを取得できません');
   let content: string;
   let sourceUrl: string | null = null;
   if (mode === 'inline' && templateFile) {
    if (!/\.ya?ml$/i.test(templateFile.name) || templateFile.size > 2_000_000) throw new Error('2MB以下のYAMLファイルを選択してください');
    content = await templateFile.text();
   } else {
    if (!/^[a-zA-Z0-9_./-]+\.ya?ml$/.test(path) || path.split('/').includes('..')) throw new Error('scenarios内の相対YAMLパスを指定してください');
    const base = scenarioPath ? new URL(scenarioPath, window.location.origin) : new URL('/scenarios/new-flow.yaml', window.location.origin);
    const url = new URL(path, base);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/scenarios/')) throw new Error('scenarios外のファイルは読み込めません');
    const response = await fetch(url.pathname);
    if (!response.ok) throw new Error('テンプレートを取得できません: ' + response.status);
    content = await response.text();
    sourceUrl = url.href;
   }
   const parsedFragment = parseTemplateYaml(content);
   // 相対参照は読み込み元URLを基準に再帰解決する。ローカルファイルは
   // ディレクトリ情報をブラウザから取得できないため、参照付きなら公開パスを指定する。
   if (parsedFragment.hasReferences && !sourceUrl) throw new Error('参照付きYAMLは公開ディレクトリの相対パスから読み込んでください');
   const fragment = parsedFragment.hasReferences ? await loadTemplateFragment(sourceUrl!) : parsedFragment;
   if (mode === 'reference' && templateReferences.some(item => item.file === templatePath)) throw new Error('同じ参照テンプレートは複数回読み込めません');
   const actorIds = new Set(actors.map(item => item.id));
   const stepIds = new Set(steps.map(item => item.id));
   // 参照モードは元ファイルのIDを変えられないため衝突時に停止する。
   // 直接読込は衝突IDを採番し、通信の参照先も同時に書き換える。
   const uniqueId = (id: string, used: Set<string>) => {
    let result = id;
    let suffix = 2;
    while (used.has(result)) result = id + '-' + suffix++;
    used.add(result);
    return result;
   };
   const actorIdMap = new Map<string, string>();
   const stepIdMap = new Map<string, string>();
   for (const actor of fragment.actors) {
    if (actorIdMap.has(actor.id)) throw new Error('テンプレート内でノードIDが重複しています: ' + actor.id);
    actorIdMap.set(actor.id, mode === 'reference' ? actor.id : uniqueId(actor.id, actorIds));
   }
   for (const step of fragment.steps) {
    if (stepIdMap.has(step.id)) throw new Error('テンプレート内で通信IDが重複しています: ' + step.id);
    stepIdMap.set(step.id, mode === 'reference' ? step.id : uniqueId(step.id, stepIds));
   }
   if (mode === 'reference' && (fragment.actors.some(item => actorIds.has(item.id)) || fragment.steps.some(item => stepIds.has(item.id)))) throw new Error('参照テンプレートのIDが既存フローと重複しています');
   const newActors = fragment.actors.map((item, index) => ({ ...item, id: actorIdMap.get(item.id)!, position: item.position ?? { x: 250 + (index % 10) * 240, y: 200 + Math.floor(index / 10) * 160 } }));
   const newSteps = fragment.steps.map(item => ({
    ...item,
    id: stepIdMap.get(item.id)!,
    actions: item.actions.map(action => ({ ...action, from: actorIdMap.get(action.from) ?? action.from, to: actorIdMap.get(action.to) ?? action.to })),
    ...(item.reverseFrom ? { reverseFrom: actorIdMap.get(item.reverseFrom) ?? item.reverseFrom } : {}),
    ...(item.reverseTo ? { reverseTo: actorIdMap.get(item.reverseTo) ?? item.reverseTo } : {}),
   }));
   const available = new Set([...actors.map(item => item.id), ...newActors.map(item => item.id)]);
   if (newSteps.some(item => item.actions.some(action => !available.has(action.from) || !available.has(action.to)))) throw new Error('テンプレートの通信に存在しないノード参照があります');
   setActors(current => [...current, ...newActors]);
   setSteps(current => [...current, ...newSteps]);
   setNodeNumbers(current => ({ ...current, ...Object.fromEntries(newActors.map(item => [item.id, nextNodeNumber.current++])) }));
   if (mode === 'reference') setTemplateReferences(current => [...current, { file: path, actorIds: newActors.map(item => item.id), stepIds: newSteps.map(item => item.id), original: JSON.stringify({ actors: newActors, steps: newSteps }) }]);
   const renamed = [...actorIdMap, ...stepIdMap].filter(([before, after]) => before !== after).length;
   setMessage(mode === 'reference' ? 'サブシナリオ参照を追加しました。' : '直接読み込みが完了しました。' + (renamed ? ' 重複IDを' + renamed + '件変更しました。' : ''));
   setTemplateImportOpen(false);
  } catch (error) { setTemplateError(error instanceof Error ? error.message : String(error)); }
 };
 // IF項目定義をYAML/JSONから読み込み、画面上の定義に追加する。
 const importInterfaceFields = async (interfaceId: string, file: File) => {
  try {
   if (!/\.(yaml|yml|json)$/i.test(file.name) || file.size > 2_000_000) throw new Error('2MB以下のYAMLまたはJSONを選択してください');
   const data: unknown = parse(await file.text());
   const candidate = Array.isArray(data) ? data : data && typeof data === 'object' && 'fields' in data ? data.fields : null;
   if (!Array.isArray(candidate)) throw new Error('項目配列、またはfields配列を持つオブジェクトが必要です');
   const fields = candidate.map((item, index) => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.type !== 'string') throw new Error('項目' + (index + 1) + 'にnameとtypeが必要です');
    if (item.required !== undefined && typeof item.required !== 'boolean') throw new Error('requiredはbooleanで指定してください');
    if (item.description !== undefined && typeof item.description !== 'string') throw new Error('descriptionは文字列で指定してください');
    return { name: item.name as string, type: item.type as string, required: (item.required ?? false) as boolean, description: (item.description ?? '') as string };
   });
   setInterfaces(items => items.map(item => item.id === interfaceId ? { ...item, fields: [...(item.fields ?? []), ...fields] } : item));
   setMessage('IF項目を' + fields.length + '件読み込みました');
  } catch (error) { setMessage('IF項目の読込に失敗: ' + String(error)); }
 };
 const addGroup = () => { const id = 'group-' + crypto.randomUUID().slice(0, 8); setGroups(items => [...items, { id, name: '新しい領域', color: '#2563eb', x: 100, y: 100, width: 600, height: 350 }]); setSelectedGroup(id); setSelectedActor(null); setSelectedStep(null); };
 const addInterface = () => { const id = 'if-' + crypto.randomUUID().slice(0, 8); setInterfaces(items => [...items, { id, name: '新しいIF定義', description: '', fields: [] }]); setInterfacePanel(id); };
 // 順序編集モード中だけ再生順序線と番号を表示する。
 const [orderMode, setOrderMode] = useState(false);
 const [orderSource, setOrderSource] = useState<string | null>(null);
 const orderDrag = useRef<{ pointerId: number; source: string; x: number; y: number; moved: boolean } | null>(null);
 const [orderCursor, setOrderCursor] = useState<{ x: number; y: number } | null>(null);
 const orderPoint = (step: Step) => {
  const action = step.actions[0];
  const from = actors.find(actor => actor.id === action?.from);
  const to = actors.find(actor => actor.id === action?.to);
  return from && to ? { x: (from.position.x + to.position.x) / 2, y: (from.position.y + to.position.y) / 2 - 55 } : null;
 };
 const moveOrder = (fromId: string, toId: string) => {
  if (fromId === toId) return;
  setSteps(current => {
   const next = [...current];
   const from = next.findIndex(step => step.id === fromId);
   const to = next.findIndex(step => step.id === toId);
   if (from < 0 || to < 0) return current;
   const [step] = next.splice(from, 1);
   next.splice(to, 0, step);
   return next.map((step, index) => ({ ...step, order: index + 1 }));
  });
 };
 const chooseOrder = (id: string) => {
  if (!orderSource) { setOrderSource(id); return; }
  if (orderSource !== id) moveOrder(orderSource, id);
  setOrderSource(null);
 };
 const isNew = initial.actors.length === 0 && initial.steps.length === 0;
 useEffect(() => { setMessage(''); }, [tool]);
 // プレビューに編集中の状態を渡す。戻っても編集中の変更は保持される。
 if (preview) return <FlowPreview actors={actors} steps={steps} title={metadata.title} onDeleteStep={deleteStep} onExit={requestExit} onClose={() => setPreview(false)}/>;
 return <div className="flow-editor" onPointerDown={event => {
  if (!(event.target as Element).closest('.editor-context-menu')) setContextMenu(null);
 }}>
  <div className="editor-header"><div><h2>{isNew ? '新規フロー作成' : 'フローエディター'}</h2><p>{isNew ? 'ノードを2件以上追加し、通信線を1件以上作成してからYAMLを保存してください。' : 'ノードをドラッグして配置し、右端の＋から別のノードへドラッグして通信線を作成できます。'}</p></div><div className="editor-header-actions"><button onClick={requestExit}>再生画面へ戻る</button><button onClick={() => setPreview(true)}>▶ プレビュー</button><button className="selected" onClick={() => void save()}>YAMLを保存…</button></div></div>
  <EditorToolbar tool={tool} setTool={setTool} source={source} setSource={setSource} actors={actors} selectedActors={selectedActors} setSelectedActors={setSelectedActors} clearSelection={() => { setSelectedActor(null); setSelectedStep(null); setSelectedGroup(null); }} addActor={addActor} addGroup={addGroup} addInterface={addInterface} openTemplate={() => { setTemplateImportOpen(true); setTemplateError(null); }} zoom={zoom} setZoom={setZoom} resetView={() => { setOffset({ x: 0, y: 0 }); const canvas = canvasRef.current; if (canvas) { canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2; canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2; } }} scenarioPath={scenarioPath} showLines={showLines} setShowLines={setShowLines} orderMode={orderMode} setOrderMode={setOrderMode} setOrderSource={setOrderSource}/>
  {templateImportOpen && <TemplateImportDialog path={templatePath} file={templateFile} error={templateError} onPathChange={setTemplatePath} onFileChange={setTemplateFile} onClose={() => setTemplateImportOpen(false)} onImport={mode => void importTemplate(mode)}/>}
  {interfacePanel && <InterfaceDefinitionDialog interfaceId={interfacePanel} interfaces={interfaces} setInterfaces={setInterfaces} onClose={() => setInterfacePanel(null)} onImportFields={importInterfaceFields}/>}
  <div className={`editor-layout${inspectorCollapsed ? " inspector-collapsed" : ""}${orderCollapsed ? " order-collapsed" : ""}`}>
   <div className="editor-canvas" ref={canvasRef}>
    <svg ref={svgRef} onContextMenu={event => {
     event.preventDefault();
     const target = event.target as Element;
     const { actorId, groupId, stepId } = resolveEditorSelection(target);
     const canvas = event.currentTarget.parentElement!.getBoundingClientRect();
     const menuWidth = 190;
     const menuHeight = actorId ? 150 : stepId ? 100 : 100;
     setContextMenu({
      x: Math.max(0, Math.min(event.clientX - canvas.left, canvas.width - menuWidth)),
      y: Math.max(0, Math.min(event.clientY - canvas.top, canvas.height - menuHeight)),
      actorId, stepId, groupId,
     });
     if (actorId) { setSelectedActor(actorId); setSelectedStep(null); setSelectedGroup(null); }
     else if (stepId) { setSelectedStep(stepId); setSelectedActor(null); setSelectedGroup(null); }
     else if (groupId) { setSelectedGroup(groupId); setSelectedActor(null); setSelectedStep(null); }
    }} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="編集可能なノード接続図"
     onPointerDown={event => {
      if (event.button !== 0) return;
      const target = event.target as Element;
      const waypointHandle = target.closest('[data-waypoint-index]');
      if (waypointHandle) {
       const stepId = waypointHandle.getAttribute('data-waypoint-step');
       const index = Number(waypointHandle.getAttribute('data-waypoint-index'));
       if (stepId && Number.isInteger(index)) {
        waypointDrag.current = { pointerId: event.pointerId, stepId, index };
        setSelectedStep(stepId); setSelectedActor(null); setSelectedGroup(null);
        event.currentTarget.setPointerCapture(event.pointerId);
       }
       return;
      }
      const handle = target.closest('[data-connection-handle]');
      if (handle && tool !== 'multi') {
       const from = handle.getAttribute('data-connection-handle');
       if (!from) return;
       wirePointer.current = event.pointerId;
       setWire({ from, ...toWorld(event.clientX, event.clientY) });
       setSource(null);
       event.currentTarget.setPointerCapture(event.pointerId);
       event.preventDefault();
       return;
      }
      if (tool === 'multi') {
       const actorId = target.closest('[data-actor-id]')?.getAttribute('data-actor-id');
       if (actorId) {
        if (event.shiftKey) {
         setSelectedActors(current => current.includes(actorId) ? current.filter(id => id !== actorId) : [...current, actorId]);
         return;
        }
        const ids = selectedActors.includes(actorId) ? selectedActors : [actorId];
        setSelectedActors(ids);
        multiDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
         initial: actors.filter(actor => ids.includes(actor.id)).map(actor => ({ id: actor.id, ...actor.position })) };
       } else {
        marquee.current = { pointerId: event.pointerId, start: toWorld(event.clientX, event.clientY), additive: event.shiftKey };
        setMarqueeEnd(toWorld(event.clientX, event.clientY));
        if (!event.shiftKey) setSelectedActors([]);
       }
       event.currentTarget.setPointerCapture(event.pointerId);
       event.preventDefault();
       return;
      }
      if (tool !== 'move') return;
      const resizeHandle = target.closest('[data-group-resize]');
      const groupId = (resizeHandle ?? target.closest('[data-group-id]'))?.getAttribute(resizeHandle ? 'data-group-resize' : 'data-group-id') ?? null;
      const group = groups.find(item => item.id === groupId);
      if (group) {
       setSelectedGroup(group.id);
       setSelectedActor(null);
       setSelectedStep(null);
       drag.current = { id: event.pointerId, actorId: null, groupId: group.id, resizeGroup: Boolean(resizeHandle), initialMembers: actors.filter(actor => group.memberIds?.includes(actor.id)).map(actor => ({ id: actor.id, ...actor.position })), initialSize: { width: group.width, height: group.height }, x: event.clientX, y: event.clientY, initial: { x: group.x, y: group.y }, offset };
       event.currentTarget.setPointerCapture(event.pointerId);
       return;
      }
      const { actorId, stepId } = resolveEditorSelection(target);
      // SVGのポインターキャプチャ後はclickがSVGへ再ターゲットされるため、選択を先に確定する。
      if (actorId) {
       setSelectedActor(actorId);
       setSelectedStep(null);
       setSelectedGroup(null);
      } else {
       if (stepId) {
        setSelectedStep(stepId);
        setSelectedActor(null);
        setSelectedGroup(null);
        return;
       }
       // 空白のクリックはすべての選択状態を解除する。
       setSelectedActor(null);
       setSelectedStep(null);
       setSelectedGroup(null);
       setSelectedActors([]);
      }
      const actor = actors.find(item => item.id === actorId);
      drag.current = { id: event.pointerId, actorId, x: event.clientX, y: event.clientY, initial: actor?.position ?? { x: 0, y: 0 }, offset };
      event.currentTarget.setPointerCapture(event.pointerId);
     }}
     onPointerMove={event => {
      if (marquee.current?.pointerId === event.pointerId) {
       setMarqueeEnd(toWorld(event.clientX, event.clientY));
       return;
      }
      if (multiDrag.current?.pointerId === event.pointerId) {
       const active = multiDrag.current;
       const start = toWorld(active.x, active.y);
       const end = toWorld(event.clientX, event.clientY);
       const dx = end.x - start.x;
       const dy = end.y - start.y;
       // 全選択ノードの相対位置を維持したままキャンバス境界内に収める。
       const minDx = Math.max(...active.initial.map(item => NODE_WIDTH / 2 - item.x));
       const maxDx = Math.min(...active.initial.map(item => WIDTH - NODE_WIDTH / 2 - item.x));
       const minDy = Math.max(...active.initial.map(item => NODE_HEIGHT / 2 - item.y));
       const maxDy = Math.min(...active.initial.map(item => HEIGHT - NODE_HEIGHT / 2 - item.y));
       const moveX = Math.max(minDx, Math.min(maxDx, dx));
       const moveY = Math.max(minDy, Math.min(maxDy, dy));
       const originals = new Map(active.initial.map(item => [item.id, item]));
       setActors(current => current.map(actor => {
        const original = originals.get(actor.id);
        return original ? { ...actor, position: { x: original.x + moveX, y: original.y + moveY } } : actor;
       }));
       return;
      }
      if (waypointDrag.current?.pointerId === event.pointerId) {
       const { stepId, index } = waypointDrag.current;
       const point = toWorld(event.clientX, event.clientY);
       setSteps(current => current.map(step => step.id !== stepId ? step : {
        ...step, waypoints: (step.waypoints ?? []).map((waypoint, i) => i === index
         ? { x: Math.max(0, Math.min(WIDTH, point.x)), y: Math.max(0, Math.min(HEIGHT, point.y)) } : waypoint),
       }));
       return;
      }
      if (orderDrag.current?.pointerId === event.pointerId) {
       const active = orderDrag.current;
       if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 5) active.moved = true;
       if (active.moved) setOrderCursor(toWorld(event.clientX, event.clientY));
       return;
      }
      if (wirePointer.current === event.pointerId) {
       setWire(current => current ? { ...current, ...toWorld(event.clientX, event.clientY) } : null);
       return;
      }
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      const matrix = event.currentTarget.getScreenCTM();
      if (!matrix) return;
      const inverse = matrix.inverse();
      const origin = event.currentTarget.createSVGPoint();
      origin.x = current.x; origin.y = current.y;
      const pointer = event.currentTarget.createSVGPoint();
      pointer.x = event.clientX; pointer.y = event.clientY;
      const start = origin.matrixTransform(inverse);
      const end = pointer.matrixTransform(inverse);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (current.groupId) {
       const nextX = Math.max(0, current.initial.x + dx / zoom);
       const nextY = Math.max(0, current.initial.y + dy / zoom);
       setGroups(items => items.map(item => item.id === current.groupId ? current.resizeGroup ? { ...item, width: Math.max(200, (current.initialSize?.width ?? item.width) + dx / zoom), height: Math.max(120, (current.initialSize?.height ?? item.height) + dy / zoom) } : { ...item, x: nextX, y: nextY } : item));
       // 領域移動時は所属ノードだけをドラッグ開始時の座標から同量移動する。
       if (!current.resizeGroup && current.initialMembers?.length) {
        const memberPositions = new Map(current.initialMembers.map(item => [item.id, item]));
        setActors(items => items.map(actor => {
         const initial = memberPositions.get(actor.id);
         return initial ? { ...actor, position: { x: Math.max(NODE_WIDTH / 2, Math.min(WIDTH - NODE_WIDTH / 2, initial.x + nextX - current.initial.x)), y: Math.max(NODE_HEIGHT / 2, Math.min(HEIGHT - NODE_HEIGHT / 2, initial.y + nextY - current.initial.y)) } } : actor;
        }));
       }
      } else if (current.actorId) {
       const x = Math.max(NODE_WIDTH / 2, Math.min(WIDTH - NODE_WIDTH / 2, current.initial.x + dx / zoom));
       const y = Math.max(NODE_HEIGHT / 2, Math.min(HEIGHT - NODE_HEIGHT / 2, current.initial.y + dy / zoom));
       changeActor(current.actorId, { position: { x, y } });
      } else {
       setOffset({ x: current.offset.x + dx, y: current.offset.y + dy });
      }
     }}
     onPointerUp={event => {
      if (marquee.current?.pointerId === event.pointerId) {
       const selection = marquee.current;
       const end = toWorld(event.clientX, event.clientY);
       const left = Math.min(selection.start.x, end.x);
       const right = Math.max(selection.start.x, end.x);
       const top = Math.min(selection.start.y, end.y);
       const bottom = Math.max(selection.start.y, end.y);
       const matches = actors.filter(actor => actor.position.x + NODE_WIDTH / 2 >= left &&
        actor.position.x - NODE_WIDTH / 2 <= right &&
        actor.position.y + NODE_HEIGHT / 2 >= top &&
        actor.position.y - NODE_HEIGHT / 2 <= bottom).map(actor => actor.id);
       setSelectedActors(current => selection.additive ? [...new Set([...current, ...matches])] : matches);
       marquee.current = null;
       setMarqueeEnd(null);
      }
      if (multiDrag.current?.pointerId === event.pointerId) multiDrag.current = null;
      if (waypointDrag.current?.pointerId === event.pointerId) waypointDrag.current = null;
      if (orderDrag.current?.pointerId === event.pointerId) {
       const dragOrder = orderDrag.current;
       const point = toWorld(event.clientX, event.clientY);
       const destination = steps.map(step => ({ id: step.id, point: orderPoint(step) })).find(item => item.point && Math.hypot(item.point.x - point.x, item.point.y - point.y) < 32);
       if (dragOrder.moved && destination) { moveOrder(dragOrder.source, destination.id); setOrderSource(null); }
       else if (!dragOrder.moved) chooseOrder(dragOrder.source);
       orderDrag.current = null;
       setOrderCursor(null);
      }
      if (wirePointer.current === event.pointerId) {
       const point = toWorld(event.clientX, event.clientY);
       // キャプチャ後のevent.targetはSVGのため、接続先はワールド座標で判定する。
       const target = [...actors].reverse().find(actor =>
        Math.abs(point.x - actor.position.x) <= NODE_WIDTH / 2 &&
        Math.abs(point.y - actor.position.y) <= NODE_HEIGHT / 2);
       if (wire && target) addConnection(wire.from, target.id);
       else if (wire) setMessage('接続先ノードの上でドロップしてください。');
       setWire(null);
       wirePointer.current = null;
      }
      if (drag.current?.id === event.pointerId) drag.current = null;
     }}
     onPointerCancel={() => { marquee.current = null; setMarqueeEnd(null); multiDrag.current = null; waypointDrag.current = null; drag.current = null; wirePointer.current = null; setWire(null); orderDrag.current = null; setOrderCursor(null); }}> 
     <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
      {groups.map(group => <g key={group.id} data-group-id={group.id} className="editor-group" onClick={event => { event.stopPropagation(); if (tool === 'multi') return; setSelectedGroup(group.id); setSelectedActor(null); setSelectedStep(null); }}><rect x={group.x} y={group.y} width={group.width} height={group.height} rx="8" fill={group.color ?? '#2563eb'} fillOpacity=".045" stroke={group.color ?? '#2563eb'} strokeWidth={selectedGroup === group.id ? 2 : 1}/><rect x={group.x + 10} y={group.y - 30} width={Math.min(group.width - 20, Math.max(120, group.name.length * 13 + 36))} height="31" rx="8" fill={group.color ?? '#2563eb'} stroke={group.color ?? '#2563eb'} strokeWidth="1"/><rect x={group.x + 10} y={group.y - 9} width={Math.min(group.width - 20, Math.max(120, group.name.length * 13 + 36))} height="10" fill={group.color ?? '#2563eb'}/><text x={group.x + 24} y={group.y - 9} fill="#ffffff" fontWeight="600" fontSize="15">{group.name}</text><rect data-group-resize={group.id} x={group.x + group.width - 22} y={group.y + group.height - 22} width="22" height="22" rx="4" fill={group.color ?? '#2563eb'} className="editor-group-resize"/></g>)}
      {orderMode && <g className="editor-playback-order" aria-label="再生順序線">
       {steps.slice(0, -1).map((step, index) => {
        const from = orderPoint(step);
        const to = orderPoint(steps[index + 1]);
        return from && to ? <line key={step.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#fbbf24" strokeWidth="3" strokeDasharray="9 5" pointerEvents="none"/> : null;
       })}
       {orderCursor && orderDrag.current && (() => { const sourcePoint = orderPoint(steps.find(step => step.id === orderDrag.current?.source)!); return sourcePoint ? <line x1={sourcePoint.x} y1={sourcePoint.y} x2={orderCursor.x} y2={orderCursor.y} stroke="#f97316" strokeWidth="4" strokeDasharray="8 4" pointerEvents="none"/> : null; })()}
       {steps.map((step, index) => {
        const point = orderPoint(step);
        return point && <g key={step.id} className="editor-order-marker" role="button" tabIndex={0} aria-label={`再生順序 ${index + 1}: ${step.title}`} onPointerDown={event => { event.stopPropagation(); orderDrag.current = { pointerId: event.pointerId, source: step.id, x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.closest('svg')?.setPointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseOrder(step.id); } }}>
         <circle cx={point.x} cy={point.y} r="19" fill={orderSource === step.id ? '#ea580c' : '#92400e'} stroke="#fde68a" strokeWidth="2"/>
         <text x={point.x} y={point.y + 5} fontSize="14" fill="white" textAnchor="middle" pointerEvents="none">{index + 1}</text>
        </g>;
       })}
      </g>}
      {showLines && steps.flatMap(step => step.actions.map((action, index) => {
       const from = actors.find(actor => actor.id === action.from);
       const to = actors.find(actor => actor.id === action.to);
       if (!from || !to) return null;
       const active = selectedStep === step.id;
       const points = step.routing === 'orthogonal' && step.waypoints?.length
        ? routeViaWaypoints(actors, action.from, action.to, step.waypoints)
        : routeConnection(actors, action.from, action.to, step.routing ?? 'straight');
       // 逆方向も接続されている場合だけ線をずらす。片方向は中央の1本。
       const bidirectional = Boolean(step.bidirectional) || steps.some(other => other.actions.some(otherAction =>
        otherAction.from === action.to && otherAction.to === action.from));
       const forward = bidirectional ? offsetRoute(points, -12) : points;
       const path = routePath(forward);
       // 復路は送信先→送信元で経路を再計算する。逆方向の法線で別レーンに配置する。
       const reversePoints = step.bidirectional && step.reverseFrom && step.reverseTo
        ? routeConnection(actors, step.reverseFrom, step.reverseTo, step.routing ?? 'straight') : [];
       const reversePath = routePath(offsetRoute(reversePoints, -12));
       const middle = pointOnRoute(forward, .5);
       return <g key={step.id + '-' + index} data-step-id={step.id} className="editor-edge" onClick={event => { event.stopPropagation(); if (tool === 'multi') return; setSelectedStep(step.id); setSelectedActor(null); setSelectedGroup(null); }}>
        <path d={path} fill="none" stroke="transparent" strokeWidth="18"/>
        {step.bidirectional && <path d={reversePath} fill="none" stroke="transparent" strokeWidth="18"/>}
        <path d={path} fill="none" stroke={active ? '#22d3ee' : '#7b94b3'} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .55}/>
        {step.bidirectional && <path d={reversePath} fill="none" stroke={active ? '#a78bfa' : '#7b94b3'} strokeWidth={active ? 4 : 2} opacity={active ? 1 : .55}/>}
        {active && step.routing === 'orthogonal' && step.waypoints?.map((point, waypointIndex) =>
         <circle key={waypointIndex} data-waypoint-step={step.id} data-waypoint-index={waypointIndex}
          cx={point.x} cy={point.y} r="10" fill="#f97316" stroke="#fff" strokeWidth="2"
          className="editor-waypoint" aria-label={`経由点 ${waypointIndex + 1}`}/>)}
        <circle cx={middle.x} cy={middle.y} r={active ? 8 : 5} fill={active ? '#22d3ee' : '#7b94b3'}/>
        {step.branchLabel && <g pointerEvents="none">
         <rect x={middle.x - Math.max(32, step.branchLabel.length * 7 / 2 + 8)} y={middle.y - 32} width={Math.max(64, step.branchLabel.length * 7 + 16)} height="22" rx="5" fill="#102c48" stroke="#38bdf8"/>
         <text x={middle.x} y={middle.y - 17} textAnchor="middle" fill="#f0f9ff" fontSize="12">{step.branchLabel}</text>
        </g>}
       </g>;
      }))}
      {wire && (() => {
       const from = actors.find(actor => actor.id === wire.from);
       return from ? <line x1={from.position.x} y1={from.position.y} x2={wire.x} y2={wire.y}
        stroke="#22d3ee" strokeWidth="3" strokeDasharray="9 6" pointerEvents="none"/> : null;
      })()}
      {tool === 'multi' && marquee.current && marqueeEnd && <rect className="editor-selection-marquee" x={Math.min(marquee.current.start.x, marqueeEnd.x)} y={Math.min(marquee.current.start.y, marqueeEnd.y)} width={Math.abs(marqueeEnd.x - marquee.current.start.x)} height={Math.abs(marqueeEnd.y - marquee.current.start.y)} pointerEvents="none"/>}
      {actors.map(actor => <g key={actor.id} data-actor-id={actor.id} className={`editor-node${selectedActors.includes(actor.id) && tool === "multi" ? " editor-node-multiselected" : ""}`} onClick={() => { if (tool !== "multi") clickActor(actor.id); }}>
       <rect x={actor.position.x - NODE_WIDTH / 2} y={actor.position.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" fill={actor.color ?? (source === actor.id ? '#165c73' : selectedActor === actor.id ? '#1e5a88' : '#20314a')} stroke={source === actor.id || selectedActor === actor.id ? '#22d3ee' : '#7398c9'} strokeWidth="2"/>
       <circle cx={actor.position.x - NODE_WIDTH / 2 + 13} cy={actor.position.y - NODE_HEIGHT / 2 + 13} r="15" fill="#22d3ee" />
       <text x={actor.position.x - NODE_WIDTH / 2 + 13} y={actor.position.y - NODE_HEIGHT / 2 + 18} textAnchor="middle" fill="#082238" fontSize="13" fontWeight="bold">{nodeNumbers[actor.id]}</text>
       <NodeIcon type={actor.type} x={actor.position.x} y={actor.position.y - 10} size={29} color="#f0f6ff"/>
       <text x={actor.position.x} y={actor.position.y + 15} textAnchor="middle" fill="#f0f6ff" fontSize="12">{actor.name.length > 12 ? actor.name.slice(0, 11) + '…' : actor.name}</text>
       {/* ノード右上の削除ボタン。pointerdownを止め、ノード移動が始まらないようにする。 */}
       <g className="editor-node-delete" role="button" aria-label={actor.name + 'を削除'} tabIndex={0}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); deleteActor(actor.id); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); deleteActor(actor.id); } }}>
        <circle cx={actor.position.x + NODE_WIDTH / 2 - 9} cy={actor.position.y - NODE_HEIGHT / 2 + 9} r="8" fill="#9f2538" stroke="#fecdd3" strokeWidth="1.5"/>
        <path d={`M ${actor.position.x + NODE_WIDTH / 2 - 12} ${actor.position.y - NODE_HEIGHT / 2 + 6} l 6 6 m 0 -6 l -6 6`} stroke="#fff" strokeWidth="2" strokeLinecap="round" pointerEvents="none"/>
       </g>
       {/* ノード端からドラッグする接続ハンドル。 */}
       <circle data-connection-handle={actor.id} cx={actor.position.x + NODE_WIDTH / 2} cy={actor.position.y}
        r="13" fill="#22d3ee" stroke="#082238" strokeWidth="2" className="editor-connection-handle"/>
       <text data-connection-handle={actor.id} x={actor.position.x + NODE_WIDTH / 2} y={actor.position.y + 5}
        textAnchor="middle" fill="#082238" fontSize="16" fontWeight="bold" className="editor-connection-handle">＋</text>
      </g>)}
     </g>
    </svg>
    {contextMenu && <div className="editor-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}
      onPointerDown={event => event.stopPropagation()}>
      {contextMenu.actorId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedActor(contextMenu.actorId); setSelectedStep(null); setSelectedGroup(null); setContextMenu(null); }}>ノードを編集</button>
       <button type="button" role="menuitem" onClick={() => { duplicateActor(contextMenu.actorId!); setContextMenu(null); }}>ノードを複製</button>
       <button type="button" role="menuitem" className="danger" onClick={() => deleteActor(contextMenu.actorId!)}>ノードを削除</button>
      </> : contextMenu.groupId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedGroup(contextMenu.groupId); setContextMenu(null); }}>領域を編集</button>
       <button type="button" role="menuitem" className="danger" onClick={() => { setGroups(items => items.filter(item => item.id !== contextMenu.groupId)); setSelectedGroup(null); setContextMenu(null); }}>領域を削除</button>
      </> : contextMenu.stepId ? <>
       <button type="button" role="menuitem" onClick={() => { setSelectedStep(contextMenu.stepId); setSelectedActor(null); setSelectedGroup(null); setContextMenu(null); }}>通信を編集</button>
       <button type="button" role="menuitem" className="danger" onClick={() => { deleteStep(contextMenu.stepId!); setContextMenu(null); }}>通信を削除</button>
      </> : <>
       <button type="button" role="menuitem" onClick={() => { addActor(); setContextMenu(null); }}>ノードを追加</button>
       <button type="button" role="menuitem" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setContextMenu(null); }}>表示をリセット</button>
      </>}
     </div>}
   </div>
   <EditorPanel title="設定" className="editor-inspector" collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)}>
    <>
    {!activeActor && !activeStep && !selectedGroup && <p className="editor-inspector-hint">ノード・通信・領域を選択すると、対応する設定が表示されます。</p>}
    {!activeActor && !activeStep && selectedGroup && groups.filter(group => group.id === selectedGroup).map(group => <GroupSettings key={group.id} group={group} actors={actors} setGroups={setGroups} onDelete={id => { setGroups(items => items.filter(item => item.id !== id)); setSelectedGroup(null); }}/>)}
    {!activeActor && !activeStep && !selectedGroup && <>
    <details className="editor-section"><summary>IF定義一覧（{interfaces.length}件）</summary>{interfaces.map(item => <button key={item.id} onClick={() => setInterfacePanel(item.id)}>{item.name}</button>)}<button onClick={addInterface}>＋ IF定義を追加</button></details>
    <ScenarioSettings metadata={metadata} onChange={setMetadata}/>
    </>}
    {activeActor && <details className="editor-section" key={`actor-${activeActor.id}`} open><summary>ノード設定（No. {nodeNumbers[activeActor.id]}）</summary>
     <label>Actor ID<input value={activeActor.id} onChange={e => { const next = e.target.value; const previous = activeActor.id; if (!next || (next !== previous && actors.some(actor => actor.id === next))) return; changeActor(previous, { id: next }); setNodeNumbers(current => { const updated = { ...current }; updated[next] = updated[previous]; delete updated[previous]; return updated; }); setSelectedActor(next); setSteps(current => current.map(step => ({ ...step, reverseFrom: step.reverseFrom === previous ? next : step.reverseFrom, reverseTo: step.reverseTo === previous ? next : step.reverseTo, actions: step.actions.map(action => ({ ...action, from: action.from === previous ? next : action.from, to: action.to === previous ? next : action.to })) }))); }}/></label>
     <label>表示名<input value={activeActor.name} onChange={e => changeActor(activeActor.id, { name: e.target.value })}/></label>
     <label className="editor-color-field"><span>ノード色</span><input type="color" aria-label="ノード色を選択" value={activeActor.color ?? '#20314a'} onChange={e => changeActor(activeActor.id, { color: e.target.value })}/><span className="editor-color-value">{activeActor.color ?? '#20314a'}</span></label>
     <label>関連資料（カンマ区切り）<input value={(activeActor.documents ?? []).join(', ')} onChange={e => changeActor(activeActor.id, { documents: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="設計書A, IF資料A"/></label>
     {/* 種類を選ぶだけで対応するアイコンが決まる。アイコンの個別設定は不要。 */}
     <div className="editor-icon-field">
      <span>ノードの種類</span>
      <div className="editor-icon-grid" role="group" aria-label="ノードの種類を選択">
       {NODE_TYPES.map(item => <button type="button" key={item.value}
        className={item.value === activeActor.type ? 'selected' : ''}
        title={item.label} aria-label={item.label} aria-pressed={item.value === activeActor.type}
        onClick={() => changeActor(activeActor.id, { type: item.value, icon: undefined })}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><NodeIcon type={item.value} x={16} y={16} size={25}/></svg>
        <small>{item.label}</small>
       </button>)}
      </div>
     </div>
     <label>説明<textarea value={activeActor.description ?? ''} onChange={e => changeActor(activeActor.id, { description: e.target.value })} placeholder="ノードの役割や処理内容"/></label>
     <label>環境<input value={activeActor.environment ?? ''} onChange={e => changeActor(activeActor.id, { environment: e.target.value })} placeholder="例: 開発 / 検証 / 本番"/></label>
     <label>接続先・URL<input value={activeActor.endpoint ?? ''} onChange={e => changeActor(activeActor.id, { endpoint: e.target.value })} placeholder="例: https://api.example.com"/></label>
     <label>インスタンス名<input value={activeActor.instanceName ?? ''} onChange={e => changeActor(activeActor.id, { instanceName: e.target.value })}/></label>
     <label>IPアドレス<input value={activeActor.ip ?? ''} onChange={e => changeActor(activeActor.id, { ip: e.target.value })}/></label>
     <label>タグ（カンマ区切り）<input value={(activeActor.tags ?? []).join(', ')} onChange={e => changeActor(activeActor.id, { tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder="例: 認証, 社内"/></label>
     <div className="editor-coordinates"><label>X<input type="number" value={Math.round(activeActor.position.x)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, x: Number(e.target.value) } })}/></label><label>Y<input type="number" value={Math.round(activeActor.position.y)} onChange={e => changeActor(activeActor.id, { position: { ...activeActor.position, y: Number(e.target.value) } })}/></label></div>
     <button type="button" className="editor-duplicate-node" onClick={() => duplicateActor(activeActor.id)}>ノードを複製</button>
     <button onClick={() => deleteActor(activeActor.id)}>ノードと関連通信を削除</button>
    </details>}
    {activeStep && <details className="editor-section" key={`step-${activeStep.id}`} open><summary>通信設定</summary>
     <label>接続方向<select value={activeStep.bidirectional ? 'both' : 'one'} onChange={e => changeDirection(activeStep.id, e.target.value === 'both')}><option value="one">片方向（1本）</option><option value="both">双方向（2本・1件で管理）</option></select></label>
     <label>接続線の形状<select value={activeStep.routing ?? 'straight'} onChange={e => changeStep(activeStep.id, { routing: e.target.value as 'straight' | 'orthogonal' })}><option value="straight">直線（標準）</option><option value="orthogonal">折れ線（ノードを迂回）</option></select></label>
      {activeStep.routing === 'orthogonal' && <div className="editor-waypoint-settings">
       <strong>折れ線の経由点（手動）</strong>
       <p>経由点を追加すると手動配線に切り替わります。オレンジ色の点をドラッグして位置を調整してください。</p>
       {(activeStep.waypoints ?? []).map((point, index) => <div key={index} className="editor-waypoint-row">
        <span>経由点 {index + 1}（{Math.round(point.x)}, {Math.round(point.y)}）</span>
        <button type="button" onClick={() => changeStep(activeStep.id, { waypoints: (activeStep.waypoints ?? []).filter((_, i) => i !== index) })}>削除</button>
       </div>)}
       <button type="button" disabled={(activeStep.waypoints?.length ?? 0) >= 100} onClick={() => {
        const action = activeStep.actions[0];
        if (!action) return;
        const points = routeConnection(actors, action.from, action.to, 'orthogonal');
        const point = pointOnRoute(points, .5);
        changeStep(activeStep.id, { waypoints: [...(activeStep.waypoints ?? []), point] });
       }}>＋ 経由点を追加</button>
       {Boolean(activeStep.waypoints?.length) && <button type="button" onClick={() => changeStep(activeStep.id, { waypoints: [] })}>自動配線に戻す</button>}
      </div>}
     {actors.some(actor => actor.type === 'decision' && activeStep.actions.some(action => action.from === actor.id)) && <label>分岐条件（例: Yes / No、成功 / 失敗）
      <input value={activeStep.branchLabel ?? ''} onChange={e => changeStep(activeStep.id, { branchLabel: e.target.value || undefined })} placeholder="この経路を通る条件"/>
     </label>}
     <label>処理名<input value={activeStep.title} onChange={e => changeStep(activeStep.id, { title: e.target.value })}/></label>
     <label>説明<textarea value={activeStep.description} onChange={e => changeStep(activeStep.id, { description: e.target.value })}/></label>
     <label>往路IF資料<input value={activeStep.forwardIf ?? ''} onChange={e => changeStep(activeStep.id, { forwardIf: e.target.value || undefined })} placeholder="例: IF-ORDER-001"/></label>
     <select value={interfaces.some(item => item.id === activeStep.forwardIf) ? activeStep.forwardIf : ''} onChange={e => changeStep(activeStep.id, { forwardIf: e.target.value || undefined })}><option value="">IF定義から選択</option>{interfaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{activeStep.forwardIf && <button type="button" onClick={() => setInterfacePanel(activeStep.forwardIf!)}>往路IFを表示</button>}
     {activeStep.bidirectional && <>
      <label>復路IF資料<input value={activeStep.reverseIf ?? ''} onChange={e => changeStep(activeStep.id, { reverseIf: e.target.value || undefined })} placeholder="例: IF-ORDER-002"/></label>
      <select value={interfaces.some(item => item.id === activeStep.reverseIf) ? activeStep.reverseIf : ''} onChange={e => changeStep(activeStep.id, { reverseIf: e.target.value || undefined })}><option value="">IF定義から選択</option>{interfaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{activeStep.reverseIf && <button type="button" onClick={() => setInterfacePanel(activeStep.reverseIf!)}>復路IFを表示</button>}
      <label>復路通信内容<textarea value={activeStep.reversePayload ?? ''} onChange={e => changeStep(activeStep.id, { reversePayload: e.target.value || undefined })} placeholder="例: 処理結果・応答データ"/></label>
     </>}
     {activeStep.actions.map((action, index) => <div key={index}>
      <label>往路送信元<select value={action.from} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, from: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label>往路送信先<select value={action.to} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, to: e.target.value } : a) })}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      {activeStep.bidirectional && <>
       <label>復路送信元<select value={activeStep.reverseFrom ?? ''} onChange={e => changeStep(activeStep.id, { reverseFrom: e.target.value })}><option value="">選択してください</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
       <label>復路送信先<select value={activeStep.reverseTo ?? ''} onChange={e => changeStep(activeStep.id, { reverseTo: e.target.value })}><option value="">選択してください</option>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      </>}
      <label>通信内容<input value={action.payload} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, payload: e.target.value } : a) })}/></label>
      <label>通信時間 (ms)<input type="number" min="1" value={action.durationMs} onChange={e => changeStep(activeStep.id, { actions: activeStep.actions.map((a, i) => i === index ? { ...a, durationMs: Number(e.target.value) } : a) })}/></label>
     </div>)}
     <button onClick={() => deleteStep(activeStep.id)}>通信を削除</button>
    </details>}

    </>
   </EditorPanel>
   {/* 再生順は設定フォームと独立した列に置き、長い設定欄のスクロールを不要にする。 */}
   <EditorPanel title="再生順" className="editor-order-panel" collapsed={orderCollapsed} onToggle={() => setOrderCollapsed(value => !value)}>
    <>
    <PlaybackOrderPanel steps={steps} selectedStep={selectedStep} onChange={setSteps} onSelect={id => { setSelectedStep(id); setSelectedActor(null); setSelectedGroup(null); }} onDelete={deleteStep}/>
    </>
   </EditorPanel>
  </div>
  {message && <p className="editor-message" role="status">{message}</p>}
 </div>;
}
