/** インポートしたノードへ表示番号を順に割り当てる。 */
export function importedNodeNumbers(
 existing: Record<string, number>,
 actorIds: string[],
 startNumber: number,
): Record<string, number> {
 const updated = { ...existing };
 actorIds.forEach((id, index) => {
  updated[id] = startNumber + index;
 });
 return updated;
}
