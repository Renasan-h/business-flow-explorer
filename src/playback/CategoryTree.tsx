export type CategoryNode = { scenarios: string[]; children: Map<string, CategoryNode> };
/** カテゴリを区切り文字ごとにツリーへ追加する。階層数に制限は設けない。 */
export function buildCategoryTree(paths: string[], categories: Record<string, string>): CategoryNode {
 const root: CategoryNode = { scenarios: [], children: new Map() };
 for (const path of paths) {
  const segments = (categories[path] || '未分類').split('/').map(segment => segment.trim()).filter(Boolean);
  let current = root;
  for (const segment of segments.length ? segments : ['未分類']) {
   if (!current.children.has(segment)) current.children.set(segment, { scenarios: [], children: new Map() });
   current = current.children.get(segment)!;
  }
  current.scenarios.push(path);
 }
 return root;
}
function categorySize(node: CategoryNode): number {
 return node.scenarios.length + [...node.children.values()].reduce((total, child) => total + categorySize(child), 0);
}
/** 自身の直下のシナリオと、子カテゴリを再帰的に表示する。 */
export default function CategoryTree({ node, selected, onSelect, titles, depth = 0 }: { node: CategoryNode; selected: string; onSelect: (path: string) => void; titles: Record<string, string>; depth?: number }) {
 return <>{node.scenarios.map(path => <button className={path === selected ? 'selected' : ''} key={path} onClick={() => onSelect(path)}>{titles[path] ?? path}</button>)}
  {[...node.children.entries()].map(([name, child]) => <details key={name} className={depth === 0 ? 'scenario-category' : 'scenario-subcategory'} open={depth === 0 ? true : undefined}>
   <summary>{name}（{categorySize(child)}）</summary>
   <CategoryTree node={child} selected={selected} onSelect={onSelect} titles={titles} depth={depth + 1}/>
  </details>)}
 </>;
}
