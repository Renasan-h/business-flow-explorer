import { z } from 'zod';
import { parse } from 'yaml';
const actor = z.object({ id:z.string(), name:z.string(), ip:z.string().optional(), instanceName:z.string().optional(), type:z.enum(['person','server','database','service']), position:z.object({x:z.number(),y:z.number()}).optional() });
const action = z.object({ type:z.literal('transfer'),from:z.string(),to:z.string(),payload:z.string(),durationMs:z.number().positive() });
const schema = z.object({
 schemaVersion:z.literal('1.0'),
 metadata:z.object({id:z.string(),title:z.string(),description:z.string(),category:z.string()}),
 actors:z.array(actor).min(2),
 steps:z.array(z.object({id:z.string(),title:z.string(),description:z.string(),actions:z.array(action).min(1)})).min(1)
}).superRefine((s,ctx)=>{
 const ids=new Set(s.actors.map(a=>a.id));
 if(ids.size!==s.actors.length) ctx.addIssue({code:'custom',message:'Duplicate actor IDs'});
 for(const [i,step] of s.steps.entries()) for(const a of step.actions)
 if(!ids.has(a.from)||!ids.has(a.to)) ctx.addIssue({code:'custom',path:['steps',i],message:'Unknown actor reference'});
});
type ParsedScenario = z.infer<typeof schema>;
export type Scenario = Omit<ParsedScenario, 'actors'> & {
 actors: (ParsedScenario['actors'][number] & { position: { x: number; y: number } })[];
};

// 記述順にノードを自動配置する。個別のposition指定があればそちらを優先する。
function assignPositions(scenario: ParsedScenario): Scenario {
 const count = scenario.actors.length;
 const columns = Math.min(3, count);
 const rows = Math.ceil(count / columns);
 const actors = scenario.actors.map((actor, index) => {
  const row = Math.floor(index / columns);
  const itemsInRow = Math.min(columns, count - row * columns);
  const column = index % columns;
  // ノード本体と上部の補足情報が画面端に重ならないよう余白を確保する。
  const x = 120 + (itemsInRow === 1 ? 0.5 : column / (itemsInRow - 1)) * 480;
  const y = rows === 1 ? 195 : 105 + (row / (rows - 1)) * 180;
  return { ...actor, position: actor.position ?? { x, y } };
 });
 return { ...scenario, actors };
}
export async function loadScenario(path:string):Promise<Scenario>{
 const response=await fetch(path,{cache:'no-store'});
 if(!response.ok) throw new Error('Scenario load failed: '+path);
 return assignPositions(schema.parse(parse(await response.text())));
}
export async function listScenarios():Promise<string[]>{
 const response=await fetch('/scenarios/index.json',{cache:'no-store'});
 if(!response.ok) throw new Error('Scenario index load failed');
 return z.array(z.string()).parse(await response.json());
}
