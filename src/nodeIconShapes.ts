/** 共通アイコンの描画命令。SVGとPixiJSで同じ形状を使うための小さなベクター定義。 */
export type IconCommand = ['line', number, number, number, number] | ['rect', number, number, number, number] | ['circle', number, number, number] | ['poly', ...number[]];
const icons: Record<string, IconCommand[]> = {
 person: [['circle',12,7,3],['poly',4,21,4,17,7,13,17,13,20,17,20,21]],
 server: [['rect',3,3,18,8],['rect',3,13,18,8],['circle',7,7,1],['circle',7,17,1]],
 database: [['poly',3,6,6,4,18,4,21,6,21,18,18,20,6,20,3,18,3,6],['line',3,10,21,10],['line',3,15,21,15]],
 service: [['circle',12,12,4],['circle',12,12,9],['line',12,1,12,5],['line',12,19,12,23],['line',1,12,5,12],['line',19,12,23,12]],
 browser: [['rect',2,3,20,18],['line',2,8,22,8],['circle',5,5.5,0.7],['circle',8,5.5,0.7]],
 api: [['line',3,8,20,8],['poly',16,4,20,8,16,12],['line',21,16,4,16],['poly',8,12,4,16,8,20]],
 cloud: [['poly',5,19,3,16,4,12,8,10,10,5,16,5,19,10,22,12,22,16,19,19,5,19]],
 network: [['circle',12,4,2],['circle',4,20,2],['circle',20,20,2],['line',12,6,4,18],['line',12,6,20,18],['line',6,20,18,20]],
 storage: [['rect',3,3,18,18],['line',3,9,21,9],['line',3,15,21,15],['circle',17,6,1],['circle',17,12,1],['circle',17,18,1]],
 queue: [['rect',2,4,6,6],['rect',16,4,6,6],['rect',9,15,6,6],['poly',8,7,12,7,12,15],['poly',16,7,12,7]],
 batch: [['poly',20,8,20,3,15,3],['poly',20,3,17,5],['poly',4,16,4,21,9,21],['poly',4,21,7,19],['poly',5,10,7,5,12,3,17,5,20,8],['poly',19,14,17,19,12,21,7,19,4,16]],
 external: [['rect',3,8,13,13],['poly',12,3,21,3,21,12],['line',21,3,10,14]],
 device: [['rect',3,3,18,14],['line',9,21,15,21],['line',12,17,12,21]],
 document: [['poly',5,2,15,2,20,7,20,22,5,22,5,2],['poly',15,2,15,7,20,7],['line',8,12,17,12],['line',8,16,17,16]],
 decision: [['poly',12,2,22,12,12,22,2,12,12,2],['line',12,7,12,14],['circle',12,18,1]],
 other: [['circle',12,12,9],['circle',8,12,1],['circle',12,12,1],['circle',16,12,1]],
};
export function iconCommands(type: string, icon?: string): IconCommand[] {
 return icons[icon ?? type] ?? icons.other;
}
