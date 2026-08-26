import { SessionEntry } from "../types.ts";

export class SessionLog {
    private entries: SessionEntry[] = [];

    addEntry(entry:SessionEntry):void{
        this.entries.push(entry);
    }

    getAllEntries():SessionEntry[]{
        return [...this.entries];
    }

    getEntriesfromId(id:string):SessionEntry[]{
        const index = this.entries.findIndex(entry=>entry.id===id);

        if(index===-1){
            throw new Error(`SessionLog: no entry found with id "${id}"`);
        }

        return this.entries.slice(index)
    }
}