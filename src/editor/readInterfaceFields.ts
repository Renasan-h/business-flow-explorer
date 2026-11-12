import { parse } from 'yaml';
import type { Scenario } from '../scenario';

type InterfaceField = NonNullable<NonNullable<Scenario['interfaces']>[number]['fields']>[number];

/** IF項目定義ファイルの拡張子・容量・内容を検証して読み込む。 */
export async function readInterfaceFields(file: File): Promise<InterfaceField[]> {
 if (!/\.(yaml|yml|json)$/i.test(file.name) || file.size > 2_000_000) {
  throw new Error('2MB以下のYAMLまたはJSONを選択してください');
 }
 const data: unknown = parse(await file.text());
 const candidate = Array.isArray(data)
  ? data
  : data && typeof data === 'object' && 'fields' in data ? data.fields : null;
 if (!Array.isArray(candidate)) {
  throw new Error('項目配列、またはfields配列を持つオブジェクトが必要です');
 }
 return candidate.map((item, index) => {
  if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.type !== 'string') {
   throw new Error('項目' + (index + 1) + 'にnameとtypeが必要です');
  }
  if (item.required !== undefined && typeof item.required !== 'boolean') {
   throw new Error('requiredはbooleanで指定してください');
  }
  if (item.description !== undefined && typeof item.description !== 'string') {
   throw new Error('descriptionは文字列で指定してください');
  }
  return {
   name: item.name as string,
   type: item.type as string,
   required: (item.required ?? false) as boolean,
   description: (item.description ?? '') as string,
  };
 });
}
