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
import ActorSettings from './editor/ActorSettings';
import StepSettings from './editor/StepSettings';
import EditorCanvas from './editor/EditorCanvas';
import EditorNodes from './editor/EditorNodes';
import EditorGroups from './editor/EditorGroups';
import EditorEdges from './editor/EditorEdges';
import PlaybackOrderMarkers from './editor/PlaybackOrderMarkers';
import EditorContextMenu, { type EditorContextMenuState } from './editor/EditorContextMenu';
import { resolveEditorSelection } from './editor/selection';
import { resolveWaypointHandle } from './editor/resolveWaypointHandle';
import { useEditorWheelZoom } from './editor/useEditorWheelZoom';
import { actorsInSelection, boundedGroupDelta, moveSelectedActors, selectionRectangle } from './editor/multiSelection';
import { useMultiSelectionPointerState } from './editor/useMultiSelectionPointerState';
import { resolveMultiSelectionStart } from './editor/multiSelectionPointerStart';
import { clampNodePosition, containsNodePoint } from './editor/nodeGeometry';
import { validateEditorScenario } from './editor/validateEditorScenario';
import { editorScenarioFilename } from './editor/editorScenarioFilename';
import { screenDragDelta, screenToWorldPoint } from './editor/coordinates';
import { boundedGroupOrigin, visibleCanvasCenter } from './editor/visibleCanvasPlacement';
import { insertWaypointBetweenNodes } from './editor/waypointInsertion';
import { clampWaypoint, moveWaypoint, waypointMenuState } from './editor/waypointEditing';

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
 // 複数選択の一時的なポインター状態は専用フックで管理する。
 const { marquee, marqueeEnd, setMarqueeEnd, multiDrag, reset: resetMultiSelectionPointer } = useMultiSelectionPointerState();
 const [source, setSource] = useState<string | null>(null);
 // ハンドルをドラッグ中だけ仮接続線を表示し、ドロップ時に正式なステップを作成する。
 const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
 const wirePointer = useRef<number | null>(null);
 // 経由点ドラッグはノード・キャンバスのドラッグとは排他的に処理する。
 const waypointDrag = useRef<{ pointerId: number; stepId: string; index: number; direction: 'forward' | 'reverse' } | null>(null);
 const [zoom, setZoom] = useState(1);
 const [offset, setOffset] = useState({ x: 0, y: 0 });
 const [message, setMessage] = useState('');
 const [preview, setPreview] = useState(false);
 // データ変更だけを追跡し、ズームや選択操作は未保存扱いしない。
 // 編集中の実データを基準に初期スナップショットを作る。
 // initial と編集用stateで配列の正規化状態が異なる場合も誤検知しない。
 const snapshot = () => JSON.stringify({ actors, steps, metadata, groups, interfaces, templateReferences });
 const savedSnapshot = useRef<string | null>(null);
 if (savedSnapshot.current === null) savedSnapshot.current = snapshot();
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
 const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);
 const svgRef = useRef<SVGSVGElement>(null);
 // 編集SVGの拡縮イベントは専用フックで管理する。
 useEditorWheelZoom({ svgRef, zoom, setZoom, setOffset, preview });
 // 削除後も番号を再利用せず、編集中の識別番号を維持する。
 const nextNodeNumber = useRef(initial.actors.length + 1);
 const [nodeNumbers, setNodeNumbers] = useState<Record<string, number>>(() =>
  Object.fromEntries(initial.actors.map((actor, index) => [actor.id, index + 1])));

 const drag = useRef<{ id: number; actorId: string | null; resizeActor?: boolean; groupId?: string; resizeGroup?: boolean; initialMembers?: { id: string; x: number; y: number }[]; initialSize?: { width: number; height: number }; x: number; y: number; initial: { x: number; y: number }; offset: { x: number; y: number } } | null>(null);
 const activeActor = actors.find(actor => actor.id === selectedActor);
 // 初期表示をワールド中央に合わせる。既存ノード座標や保存データは変更しない。
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2);
  canvas.scrollTop = Math.max(0, (canvas.scrollHeight - canvas.clientHeight) / 2);
 }, [preview]);
 const activeStep = steps.find(step => step.id === selectedStep);

 // ポインター座標を拡大率と移動量を考慮したワールド座標へ変換する。
 const toWorld = (x: number, y: number) => {
  const svg = svgRef.current;
  return svg ? screenToWorldPoint(svg, x, y, offset, zoom) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
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
 /** 接続元・接続先ノードの中点に経由点を追加する。 */
 const addWaypoint = (id: string, direction: 'forward' | 'reverse') => {
  const step = steps.find(item => item.id === id);
  if (!step) return;
  const action = step.actions[0];
  const fromId = direction === 'reverse' ? step.reverseFrom : action?.from;
  const toId = direction === 'reverse' ? step.reverseTo : action?.to;
  if (!fromId || !toId || (direction === 'reverse' && !step.bidirectional)) return;
  const from = actors.find(actor => actor.id === fromId);
  const to = actors.find(actor => actor.id === toId);
  if (!from || !to) return;
  const field = direction === 'reverse' ? 'reverseWaypoints' : 'waypoints';
  const existing = step[field] ?? [];
  if (existing.length >= 100) return;
  // 1点目はノード間の中点、2点目以降は最も長い未分割区間の中点に配置する。
  const waypoints = insertWaypointBetweenNodes(from.position, to.position, existing);
  if (waypoints.length === existing.length) return;
  changeStep(id, { routing: 'orthogonal', [field]: waypoints });
  setSelectedStep(id); setSelectedActor(null); setSelectedGroup(null); setContextMenu(null);
 };
 /** 指定方向の経由点を解除する。 */
 const removeWaypoints = (id: string, direction: 'forward' | 'reverse') => {
  changeStep(id, direction === 'reverse' ? { reverseWaypoints: [] } : { waypoints: [] });
  setContextMenu(null);
 };
 /** 一意なIDを生成してノードを追加し、追加直後に設定欄へフォーカスする。 */
 const addActor = () => {
  const id = 'actor-' + crypto.randomUUID().slice(0, 8);
  const number = nextNodeNumber.current++;
  setNodeNumbers(current => ({ ...current, [id]: number }));
  // ノードと領域の新規作成で、表示中キャンバスの中心座標を共通利用する。
  const center = visibleCanvasCenter(svgRef.current, canvasRef.current, offset, zoom, { x: WIDTH / 2, y: HEIGHT / 2 });
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
 const deleteActor = (id: string, skipConfirmation = false) => {
  const target = actors.find(actor => actor.id === id);
  if (!target || (!skipConfirmation && !window.confirm(`ノード「${target.name}」を削除しますか？\n関連する通信ステップも削除されます。`))) return;
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
 const deleteStep = (id: string, skipConfirmation = false) => {
  const target = steps.find(step => step.id === id);
  if (!target || (!skipConfirmation && !window.confirm(`再生ステップ「${target.title}」を削除しますか？\nこの操作は保存前の編集内容に反映されます。`))) return;
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
  // 保存ダイアログ表示中の状態変化に左右されないよう、保存対象を固定する。
  const snapshotAtSave = snapshot();
  setMessage('');
  const validationError = validateEditorScenario(actors, steps, groups);
  if (validationError) { setMessage(validationError); return false; }
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
  const filename = editorScenarioFilename(scenarioPath, metadata.id);
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
   savedSnapshot.current = snapshotAtSave;
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
 const addGroup = () => {
  const id = 'group-' + crypto.randomUUID().slice(0, 8);
  const size = { width: 600, height: 350 };
  const center = visibleCanvasCenter(svgRef.current, canvasRef.current, offset, zoom, { x: WIDTH / 2, y: HEIGHT / 2 });
  const origin = boundedGroupOrigin(center, size, { width: WIDTH, height: HEIGHT });
  setGroups(items => [...items, { id, name: '新しい領域', color: '#2563eb', ...origin, ...size }]);
  setSelectedGroup(id); setSelectedActor(null); setSelectedStep(null);
 };
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
 if (preview) return <FlowPreview actors={actors} steps={steps} interfaces={interfaces} title={metadata.title} onDeleteStep={deleteStep} onExit={requestExit} onClose={() => setPreview(false)}/>;
 return <div className="flow-editor" onPointerDown={event => {
  if (!(event.target as Element).closest('.editor-context-menu')) setContextMenu(null);
 }}>
  <div className="editor-header"><div><div className="editor-title-line"><h2>{isNew ? '新規フロー作成' : 'フローエディター'}</h2>{scenarioPath && <span className="editor-target-path">編集対象: {scenarioPath}</span>}</div><p>{isNew ? 'ノードを2件以上追加し、通信線を1件以上作成してからYAMLを保存してください。' : 'ノードをドラッグして配置し、右端の＋から別のノードへドラッグして通信線を作成できます。'}</p></div><div className="editor-header-actions"><button onClick={requestExit}>再生画面へ戻る</button><button onClick={() => setPreview(true)}>▶ プレビュー</button><button className="selected" onClick={() => void save()}>YAMLを保存…</button></div></div>
  <EditorToolbar tool={tool} setTool={setTool} source={source} setSource={setSource} actors={actors} selectedActors={selectedActors} setSelectedActors={setSelectedActors} clearSelection={() => { setSelectedActor(null); setSelectedStep(null); setSelectedGroup(null); }} addActor={addActor} addGroup={addGroup} addInterface={addInterface} openTemplate={() => { setTemplateImportOpen(true); setTemplateError(null); }} zoom={zoom} setZoom={setZoom} resetView={() => { setOffset({ x: 0, y: 0 }); const canvas = canvasRef.current; if (canvas) { canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2; canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2; } }} showLines={showLines} setShowLines={setShowLines} orderMode={orderMode} setOrderMode={setOrderMode} setOrderSource={setOrderSource}/>
  {templateImportOpen && <TemplateImportDialog path={templatePath} file={templateFile} error={templateError} onPathChange={setTemplatePath} onFileChange={setTemplateFile} onClose={() => setTemplateImportOpen(false)} onImport={mode => void importTemplate(mode)}/>}
  {interfacePanel && <InterfaceDefinitionDialog interfaceId={interfacePanel} interfaces={interfaces} setInterfaces={setInterfaces} onClose={() => setInterfacePanel(null)} onImportFields={importInterfaceFields}/>}
  <div className={`editor-layout${inspectorCollapsed ? " inspector-collapsed" : ""}${orderCollapsed ? " order-collapsed" : ""}`}>
   <EditorCanvas canvasRef={canvasRef} onContextMenu={event => {
     if ((event.target as Element).closest('.editor-context-menu')) return;
     event.preventDefault();
     const target = event.target as Element;
     const { actorId, groupId, stepId } = resolveEditorSelection(target);
     // メニューはfixed表示するため、スクロール位置に依存しない画面座標を使う。
     const menuWidth = 190;
     const menuHeight = actorId ? 150 : stepId ? 100 : 100;
     setContextMenu({
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - menuWidth)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - menuHeight)),
      actorId, stepId, groupId,
     });
     if (actorId) { setSelectedActor(actorId); setSelectedStep(null); setSelectedGroup(null); }
     else if (stepId) { setSelectedStep(stepId); setSelectedActor(null); setSelectedGroup(null); }
     else if (groupId) { setSelectedGroup(groupId); setSelectedActor(null); setSelectedStep(null); }
    }}>
    <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="編集可能なノード接続図"
     onPointerDown={event => {
      if (event.button !== 0) return;
      const target = event.target as Element;
      if (target.closest('[data-waypoint-index]')) {
       const waypoint = resolveWaypointHandle(target);
       if (waypoint) {
        waypointDrag.current = { pointerId: event.pointerId, ...waypoint };
        setSelectedStep(waypoint.stepId); setSelectedActor(null); setSelectedGroup(null);
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
       const actorId = target.closest('[data-actor-id]')?.getAttribute('data-actor-id') ?? null;
       const selection = resolveMultiSelectionStart(actorId, event.shiftKey, selectedActors, actors, toWorld(event.clientX, event.clientY));
       setSelectedActors(selection.selectedActors);
       // Shiftクリックは選択の反転のみ。ポインターをキャプチャしない。
       if (selection.kind === 'toggle') return;
       if (selection.kind === 'drag') {
        multiDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, initial: selection.initial };
       } else {
        marquee.current = { pointerId: event.pointerId, start: selection.start, additive: selection.additive };
        setMarqueeEnd(selection.start);
        if (selection.clearSingleSelection) {
         setSelectedActor(null);
         setSelectedStep(null);
         setSelectedGroup(null);
        }
       }
       event.currentTarget.setPointerCapture(event.pointerId);
       event.preventDefault();
       return;
      }
      if (tool !== 'move') return;
      const resizeActorId = target.closest('[data-node-resize]')?.getAttribute('data-node-resize');
      const resizeActor = actors.find(actor => actor.id === resizeActorId);
      if (resizeActor) {
       setSelectedActor(resizeActor.id);
       setSelectedStep(null); setSelectedGroup(null);
       drag.current = { id: event.pointerId, actorId: resizeActor.id, resizeActor: true,
        initialSize: { width: resizeActor.width ?? NODE_WIDTH, height: resizeActor.height ?? NODE_HEIGHT },
        x: event.clientX, y: event.clientY, initial: { ...resizeActor.position }, offset };
       event.currentTarget.setPointerCapture(event.pointerId);
       event.preventDefault();
       return;
      }
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
       const delta = boundedGroupDelta(active.initial, { x: dx, y: dy }, {
        width: WIDTH, height: HEIGHT, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT,
       }, actors);
       setActors(current => moveSelectedActors(current, active.initial, delta));
       return;
      }
      if (waypointDrag.current?.pointerId === event.pointerId) {
       const { stepId, index, direction } = waypointDrag.current;
       const position = clampWaypoint(toWorld(event.clientX, event.clientY), { width: WIDTH, height: HEIGHT });
       setSteps(current => current.map(step => step.id === stepId ? moveWaypoint(step, direction, index, position) : step));
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
      const delta = screenDragDelta(event.currentTarget, current.x, current.y, event.clientX, event.clientY, zoom);
      if (!delta) return;
      const { x: dx, y: dy } = delta;
      if (current.groupId) {
       const nextX = Math.max(0, current.initial.x + dx);
       const nextY = Math.max(0, current.initial.y + dy);
       setGroups(items => items.map(item => item.id === current.groupId ? current.resizeGroup ? { ...item, width: Math.max(200, (current.initialSize?.width ?? item.width) + dx), height: Math.max(120, (current.initialSize?.height ?? item.height) + dy) } : { ...item, x: nextX, y: nextY } : item));
       // 領域移動時は所属ノードだけをドラッグ開始時の座標から同量移動する。
       if (!current.resizeGroup && current.initialMembers?.length) {
        const memberPositions = new Map(current.initialMembers.map(item => [item.id, item]));
        setActors(items => items.map(actor => {
         const initial = memberPositions.get(actor.id);
         return initial ? { ...actor, position: clampNodePosition(actor, { x: initial.x + nextX - current.initial.x, y: initial.y + nextY - current.initial.y }, { width: WIDTH, height: HEIGHT }) } : actor;
        }));
       }
      } else if (current.actorId && current.resizeActor) {
       const size = current.initialSize;
       if (!size) return;
       changeActor(current.actorId, {
        width: Math.max(100, Math.min(800, size.width + dx * 2)),
        height: Math.max(60, Math.min(500, size.height + dy * 2)),
       });
      } else if (current.actorId) {
       const actor = actors.find(item => item.id === current.actorId);
       if (!actor) return;
       const position = clampNodePosition(actor, { x: current.initial.x + dx, y: current.initial.y + dy }, { width: WIDTH, height: HEIGHT });
       changeActor(current.actorId, { position });
      } else {
       setOffset({ x: current.offset.x + dx, y: current.offset.y + dy });
      }
     }}
     onPointerUp={event => {
      if (marquee.current?.pointerId === event.pointerId) {
       const selection = marquee.current;
       const end = toWorld(event.clientX, event.clientY);
       const matches = actorsInSelection(actors, selectionRectangle(selection.start, end), NODE_WIDTH, NODE_HEIGHT);
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
       const target = [...actors].reverse().find(actor => containsNodePoint(actor, point));
       if (wire && target) addConnection(wire.from, target.id);
       else if (wire) setMessage('接続先ノードの上でドロップしてください。');
       setWire(null);
       wirePointer.current = null;
      }
      if (drag.current?.id === event.pointerId) drag.current = null;
     }}
     onPointerCancel={() => { resetMultiSelectionPointer(); waypointDrag.current = null; drag.current = null; wirePointer.current = null; setWire(null); orderDrag.current = null; setOrderCursor(null); }}> 
     <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
      <EditorGroups groups={groups} selectedGroup={selectedGroup} tool={tool} onSelect={id => { setSelectedGroup(id); setSelectedActor(null); setSelectedStep(null); }}/>
      <PlaybackOrderMarkers orderMode={orderMode} steps={steps} orderCursor={orderCursor} orderDragSource={orderDrag.current?.source ?? null} orderSource={orderSource} orderPoint={orderPoint} onStartDrag={(stepId, pointerId, x, y) => { orderDrag.current = { pointerId, source: stepId, x, y, moved: false }; }} onChooseOrder={chooseOrder}/>
      <EditorEdges actors={actors} steps={steps} showLines={showLines} selectedStep={selectedStep} tool={tool} onSelect={id => { setSelectedStep(id); setSelectedActor(null); setSelectedGroup(null); }}/>
      {wire && (() => {
       const from = actors.find(actor => actor.id === wire.from);
       return from ? <line x1={from.position.x} y1={from.position.y} x2={wire.x} y2={wire.y}
        stroke="#22d3ee" strokeWidth="3" strokeDasharray="9 6" pointerEvents="none"/> : null;
      })()}
      {tool === 'multi' && marquee.current && marqueeEnd && <rect className="editor-selection-marquee" x={Math.min(marquee.current.start.x, marqueeEnd.x)} y={Math.min(marquee.current.start.y, marqueeEnd.y)} width={Math.abs(marqueeEnd.x - marquee.current.start.x)} height={Math.abs(marqueeEnd.y - marquee.current.start.y)} pointerEvents="none"/>}

       <EditorNodes actors={actors} selectedActors={selectedActors} tool={tool} source={source} selectedActor={selectedActor} nodeNumbers={nodeNumbers} onClickActor={clickActor} onDeleteActor={deleteActor}/>
     </g>
    </svg>
    <EditorContextMenu menu={contextMenu}
     onEditActor={id => { setSelectedActor(id); setSelectedStep(null); setSelectedGroup(null); setContextMenu(null); }}
     actorSize={{ width: actors.find(actor => actor.id === contextMenu?.actorId)?.width ?? NODE_WIDTH, height: actors.find(actor => actor.id === contextMenu?.actorId)?.height ?? NODE_HEIGHT }}
     onResizeActor={(id, width, height) => { changeActor(id, { width, height }); setContextMenu(null); }}
     onDuplicateActor={id => { duplicateActor(id); setContextMenu(null); }}
     onDeleteActor={id => { deleteActor(id, true); setContextMenu(null); }}
     onEditGroup={id => { setSelectedGroup(id); setSelectedActor(null); setSelectedStep(null); setContextMenu(null); }}
     onDeleteGroup={id => { setGroups(items => items.filter(item => item.id !== id)); setSelectedGroup(null); setContextMenu(null); }}
     onEditStep={id => { setSelectedStep(id); setSelectedActor(null); setSelectedGroup(null); setContextMenu(null); }}
     onDeleteStep={id => { deleteStep(id, true); setContextMenu(null); }}
     onAddWaypoint={addWaypoint}
     onRemoveWaypoints={removeWaypoints}
     waypointDirections={waypointMenuState(steps.find(step => step.id === contextMenu?.stepId))}
     onAddActor={() => { addActor(); setContextMenu(null); }}
     onResetView={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setContextMenu(null); }}/>
   </EditorCanvas>
   <EditorPanel title="設定" className="editor-inspector" collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)}>
    <>
    {!activeActor && !activeStep && !selectedGroup && <p className="editor-inspector-hint">ノード・通信・領域を選択すると、対応する設定が表示されます。</p>}
    {!activeActor && !activeStep && selectedGroup && groups.filter(group => group.id === selectedGroup).map(group => <GroupSettings key={group.id} group={group} actors={actors} setGroups={setGroups} onDelete={id => { setGroups(items => items.filter(item => item.id !== id)); setSelectedGroup(null); }}/>)}
    {!activeActor && !activeStep && !selectedGroup && <>
    <details className="editor-section"><summary>IF定義一覧（{interfaces.length}件）</summary>{interfaces.map(item => <button key={item.id} onClick={() => setInterfacePanel(item.id)}>{item.name}</button>)}<button onClick={addInterface}>＋ IF定義を追加</button></details>
    <ScenarioSettings metadata={metadata} onChange={setMetadata}/>
    </>}
    {activeActor && <ActorSettings activeActor={activeActor} actors={actors} nodeNumber={nodeNumbers[activeActor.id]} changeActor={changeActor} renameActor={(previous: string, next: string) => {
     if (!next || (next !== previous && actors.some(actor => actor.id === next))) return;
     changeActor(previous, { id: next });
     setNodeNumbers(current => { const updated = { ...current }; updated[next] = updated[previous]; delete updated[previous]; return updated; });
     setSelectedActor(next);
     setSteps(current => current.map(step => ({
      ...step, reverseFrom: step.reverseFrom === previous ? next : step.reverseFrom,
      reverseTo: step.reverseTo === previous ? next : step.reverseTo,
      actions: step.actions.map(action => ({ ...action, from: action.from === previous ? next : action.from, to: action.to === previous ? next : action.to }))
     })));
    }} duplicateActor={duplicateActor} deleteActor={deleteActor}/>} 
    {activeStep && <StepSettings activeStep={activeStep} actors={actors} interfaces={interfaces} changeStep={changeStep} changeDirection={changeDirection} openInterface={setInterfacePanel} deleteStep={deleteStep}/>} 

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
