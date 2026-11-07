import { z } from 'zod';
import { parse } from 'yaml';
import { layoutActors } from './layout';
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

export async function loadScenario(path:string):Promise<Scenario>{
 const response=await fetch(path,{cache:'no-store'});
 if(!response.ok) throw new Error('Scenario load failed: '+path);
 const scenario = schema.parse(parse(await response.text()));
 return { ...scenario, actors: layoutActors(scenario) };
}
export async function listScenarios():Promise<string[]>{
 const response=await fetch('/scenarios/index.json',{cache:'no-store'});
 if(!response.ok) throw new Error('Scenario index load failed');
 return z.array(z.string()).parse(await response.json());
}
