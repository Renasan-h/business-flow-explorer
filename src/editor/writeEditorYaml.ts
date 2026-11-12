type FilePicker = {
 showSaveFilePicker?: (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
 }) => Promise<{
  createWritable: () => Promise<{
   write: (content: string) => Promise<void>;
   close: () => Promise<void>;
  }>;
 }>;
};

/** YAMLの保存先を選択し、非対応ブラウザではファイルをダウンロードする。 */
export async function writeEditorYaml(filename: string, yaml: string): Promise<'saved' | 'downloaded'> {
 const picker = (window as Window & FilePicker).showSaveFilePicker;
 if (picker) {
  const handle = await picker({
   suggestedName: filename,
   types: [{ description: 'YAML scenario', accept: { 'application/x-yaml': ['.yaml', '.yml'] } }],
  });
  const writable = await handle.createWritable();
  await writable.write(yaml);
  await writable.close();
  return 'saved';
 }

 // File System Access API非対応環境ではブラウザ標準のダウンロードを使用する。
 const url = URL.createObjectURL(new Blob([yaml], { type: 'application/x-yaml' }));
 try {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
 } finally {
  URL.revokeObjectURL(url);
 }
 return 'downloaded';
}
