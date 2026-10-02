// IDs identify local demo actions only; they are never transactions or secrets.
export function createActionId():string {
 const bytes=new Uint8Array(16);
 globalThis.crypto.getRandomValues(bytes);
 return `demo-${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`;
}
